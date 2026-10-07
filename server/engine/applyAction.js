// Pure player actions: (state, action, ctx) -> new state. Throws GameError for invalid moves.
// The caller runs advance() first, so actions always see an up-to-date timeline.

import * as agents from './agents.js';
import { GameError } from './errors.js';
import { gameTime, resolveDecision, startGame } from './game.js';
import { addMessage, cleanName, cleanText, requirePlayer, roleOfPlayer } from './state.js';

/** Minimum real time between two messages from the same player (anti-spam). */
export const SAY_COOLDOWN_MS = 1500;

/** Out-of-order clocks (two servers, a retried write) never count as spam. */
export function tooSoon(player, now) {
  const elapsed = now - player.lastSaidAt;
  return elapsed >= 0 && elapsed < SAY_COOLDOWN_MS;
}

/**
 * Throws unless this player may take over this role now: the game is running, the role is
 * played by the AI and is not in the middle of a decision, and the player has no role yet.
 * The server also calls it before writing the recap, so a doomed request never reaches the LLM.
 */
export function checkTakeover(state, scenario, playerId, roleId) {
  if (state.phase !== 'playing') {
    throw new GameError('You can take over a character only while the day is running', 409);
  }
  const role = scenario.roleById.get(roleId);
  if (!role) throw new GameError('Unknown role');
  const game = state.game;
  const mine = roleOfPlayer(game, playerId);
  if (mine) throw new GameError(`You already play ${scenario.roleById.get(mine).name}`, 409);
  if (!agents.isAi(game, roleId)) {
    const holder = state.players.find((p) => p.id === game.roles[roleId].playerId);
    throw new GameError(`${holder?.name ?? 'Someone'} already plays ${role.name}`, 409);
  }
  if (game.openDecisions.some((d) => d.roleId === roleId)) {
    throw new GameError(`${role.shortName} is making a decision — try again in a moment`, 409);
  }
}

/**
 * @param {object} state
 * @param {{type: string, [key: string]: any}} action
 * @param {{scenario: object, now: number, playerId?: string, timeScale?: number, hostAway?: boolean}} ctx
 *   playerId is the authenticated sender; hostAway lets others start when the host is gone.
 */
export function applyAction(state, action, ctx) {
  const draft = structuredClone(state);
  const { scenario, now } = ctx;

  switch (action.type) {
    case 'join': {
      // action.player is built by the server (id, tokenHash), never by the client.
      if (draft.players.length >= scenario.roles.length) {
        throw new GameError(`This room is full (${scenario.roles.length} players)`, 409);
      }
      const player = {
        id: action.player.id,
        tokenHash: action.player.tokenHash,
        name: cleanName(action.player.name),
        joinedAt: now,
        pick: 'random',
        lastSaidAt: 0,
      };
      draft.players.push(player);
      draft.hostId ??= player.id;
      addMessage(draft, { kind: 'system', text: `${player.name} joined.`, at: now, t: null });
      return draft;
    }

    case 'pickRole': {
      const player = requirePlayer(draft, ctx.playerId);
      if (draft.phase !== 'lobby') throw new GameError('Roles are picked in the lobby', 409);
      const pick = action.roleId;
      if (pick !== 'random') {
        if (!scenario.roleById.has(pick)) throw new GameError('Unknown role');
        const holder = draft.players.find((p) => p.pick === pick && p.id !== player.id);
        if (holder) throw new GameError(`${holder.name} already picked that role`, 409);
      }
      player.pick = pick;
      return draft;
    }

    case 'start': {
      requirePlayer(draft, ctx.playerId);
      if (draft.phase !== 'lobby') throw new GameError('The game has already started', 409);
      if (ctx.playerId !== draft.hostId && !ctx.hostAway) {
        throw new GameError('Only the host can start the game', 403);
      }
      startGame(draft, scenario, { now, timeScale: ctx.timeScale ?? 1 });
      return draft;
    }

    case 'playAgain': {
      requirePlayer(draft, ctx.playerId);
      // gameId makes a double click (or two players clicking) start only one new game.
      if (draft.phase !== 'ended' || draft.game?.id !== action.gameId) {
        throw new GameError('A new game has already started', 409);
      }
      startGame(draft, scenario, { now, timeScale: ctx.timeScale ?? 1 });
      return draft;
    }

    case 'say': {
      const player = requirePlayer(draft, ctx.playerId);
      if (tooSoon(player, now)) throw new GameError('Slow down a little', 429);
      player.lastSaidAt = Math.max(player.lastSaidAt, now);

      if (draft.phase !== 'playing') {
        addMessage(draft, {
          kind: 'chat',
          playerId: player.id,
          text: cleanText(action.text),
          at: now,
          t: null,
        });
        return draft;
      }
      const roleId = roleOfPlayer(draft.game, player.id);
      if (!roleId) throw new GameError('Spectators cannot speak during the game', 403);
      const t = gameTime(draft.game, now);
      // action.text is the era-voice rewrite, done by the server before this runs.
      const message = addMessage(draft, {
        kind: 'speech',
        roleId,
        playerId: player.id,
        text: cleanText(action.text).slice(0, 400),
        original: action.original ? cleanText(action.original) : undefined,
        to: 'all',
        source: 'human',
        t,
        at: now,
      });
      agents.onSpeech(draft, scenario, message);
      return draft;
    }

    case 'takeover': {
      // A player who joined after the start takes an AI role. action.recap is written by the
      // server (rooms.js prepareTakeover), never taken from the client.
      const player = requirePlayer(draft, ctx.playerId);
      checkTakeover(draft, scenario, player.id, action.roleId);
      const game = draft.game;
      const role = scenario.roleById.get(action.roleId);
      game.roles[role.id].playerId = player.id;
      game.roles[role.id].recap = action.recap ?? null;
      game.agents[role.id].pending = null; // a line the AI was about to say is dropped
      player.pick = role.id; // "Play again" keeps the role
      addMessage(draft, {
        kind: 'system',
        text: `${player.name} takes over ${role.name}.`,
        t: gameTime(game, now),
        at: now,
      });
      return draft;
    }

    case 'decide': {
      const player = requirePlayer(draft, ctx.playerId);
      if (draft.phase !== 'playing') throw new GameError('The game is not running', 409);
      const roleId = roleOfPlayer(draft.game, player.id);
      const open = draft.game.openDecisions.find((d) => d.id === action.decisionId);
      if (!open) throw new GameError('That decision is already over', 409);
      if (open.roleId !== roleId) throw new GameError('This decision is not yours to make', 403);
      const decision = scenario.decisionById.get(open.id);
      if (!decision.options.some((o) => o.id === action.optionId))
        throw new GameError('Unknown option');
      resolveDecision(draft, scenario, open.id, action.optionId, {
        by: 'human',
        t: gameTime(draft.game, now),
        now,
      });
      return draft;
    }

    default:
      throw new GameError(`Unknown action: ${action.type}`);
  }
}
