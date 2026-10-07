// The ONLY place that decides what a player is allowed to see.
// Views are built from an allowlist of fields — never send the raw state and delete secrets.
// Hidden here: token hashes, AI traits, other roles' secrets/goals/facts, private narrator
// lines meant for other roles, other players' original (pre-rewrite) text, AI scheduling.

import { currentAct, gameTime } from './game.js';
import { roleOfPlayer } from './state.js';

export const ONLINE_WITHIN_MS = 15_000;

function canSee(message, roleId) {
  return message.visibleTo === 'all' || (roleId != null && message.visibleTo.includes(roleId));
}

/**
 * @param {object} state  full room state
 * @param {number} version
 * @param {string} playerId  the player asking
 * @param {{scenario: object, now: number, presence?: Record<string, number>}} ctx
 */
export function viewFor(state, version, playerId, { scenario, now, presence = {} }) {
  const game = state.game;
  const myRoleId = roleOfPlayer(game, playerId);
  const nameOf = (id) => state.players.find((p) => p.id === id)?.name ?? null;

  return {
    code: state.code,
    version,
    phase: state.phase,
    hostId: state.hostId,
    scenario: {
      id: scenario.meta.id,
      title: scenario.meta.title,
      tagline: scenario.meta.tagline,
      setting: scenario.meta.setting,
      intro: scenario.meta.intro,
      durationSeconds: scenario.meta.durationSeconds,
    },
    you: { id: playerId, name: nameOf(playerId), roleId: myRoleId },
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      pick: p.pick,
      roleId: roleOfPlayer(game, p.id),
      online: now - (presence[p.id] ?? 0) < ONLINE_WITHIN_MS,
    })),
    roles: scenario.roles.map((role) => {
      const seat = game?.roles[role.id];
      return {
        id: role.id,
        name: role.name,
        shortName: role.shortName,
        publicIdentity: role.publicIdentity,
        portraitKey: role.portraitKey,
        controller: seat ? (seat.playerId ? 'human' : 'ai') : null,
        playerName: seat?.playerId ? nameOf(seat.playerId) : null,
        pickedBy:
          state.phase === 'lobby'
            ? nameOf(state.players.find((p) => p.pick === role.id)?.id)
            : null,
      };
    }),
    messages: state.messages
      .filter((m) => canSee(m, myRoleId))
      .map((m) => ({
        id: m.id,
        kind: m.kind,
        text: m.text,
        roleId: m.roleId ?? null,
        playerId: m.playerId ?? null,
        to: m.to && m.to !== 'all' ? m.to : null,
        private: m.visibleTo !== 'all',
        t: m.t ?? null,
        actId: m.actId ?? null,
        // What the sender typed before the era rewrite — only for the sender.
        original: m.playerId === playerId ? (m.original ?? null) : null,
      })),
    game: game ? gameView(state, scenario, now, playerId, myRoleId) : null,
  };
}

function gameView(state, scenario, now, playerId, myRoleId) {
  const game = state.game;
  const ended = state.phase === 'ended';
  const role = myRoleId ? scenario.roleById.get(myRoleId) : null;
  const t = ended ? scenario.meta.durationSeconds : gameTime(game, now);
  const myDecision = game.openDecisions.find((d) => d.roleId === myRoleId);
  const recap = role ? game.roles[role.id].recap : null;

  return {
    id: game.id,
    clock: { t, scale: game.timeScale, duration: scenario.meta.durationSeconds, running: !ended },
    act: currentAct(scenario, game),
    myRole: role && {
      id: role.id,
      name: role.name,
      publicIdentity: role.publicIdentity,
      secret: role.secret,
      goal: role.goal,
      facts: role.knows.map((id) => scenario.factById.get(id).text),
      // "Previously…" for a player who took this role over from the AI mid-game.
      recap: recap ? { happened: recap.happened, secret: recap.secret, goal: recap.goal } : null,
    },
    decision: myDecision ? decisionView(scenario, myDecision) : null,
    // Public: who is deciding right now (not the options).
    deciding: game.openDecisions.map((d) => ({ roleId: d.roleId, deadline: d.deadline })),
    ending: ended ? endingView(state, scenario) : null,
  };
}

function decisionView(scenario, open) {
  const decision = scenario.decisionById.get(open.id);
  return {
    id: decision.id,
    prompt: decision.prompt,
    options: decision.options.map((o) => ({ id: o.id, label: o.label })),
    openedAt: open.openedAt,
    deadline: open.deadline,
  };
}

function endingView(state, scenario) {
  const game = state.game;
  const ending = game.ending;
  const def = scenario.endings.find((e) => e.id === ending.id);
  const label = (c, value) => c.labels[String(value)] ?? String(value);
  const nameOf = (id) => state.players.find((p) => p.id === id)?.name ?? null;
  return {
    id: ending.id,
    title: def.title,
    status: ending.status,
    epilogue: ending.status === 'pending' ? null : ending.epilogue,
    deathPoem: ending.status === 'pending' ? null : ending.deathPoem,
    comparison: scenario.historyComparison.map((c) => ({
      question: c.question,
      history: label(c, c.history),
      yours: label(c, game.flags[c.flag]),
      changed: game.flags[c.flag] !== c.history,
    })),
    // At the end every secret is revealed.
    reveal: scenario.roles.map((r) => ({
      roleId: r.id,
      name: r.name,
      secret: r.secret,
      goal: r.goal,
      playedBy: game.roles[r.id].playerId ? nameOf(game.roles[r.id].playerId) : null,
    })),
    decisions: game.resolved.map((d) => {
      const decision = scenario.decisionById.get(d.id);
      return {
        roleId: d.roleId,
        prompt: decision.prompt,
        choice: decision.options.find((o) => o.id === d.optionId).label,
        by: d.by,
      };
    }),
  };
}
