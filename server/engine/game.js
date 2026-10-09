// The Director: a pure, clock-driven timeline. advance() is called on every request
// ("lazy tick") and processes everything that is due, in time order. No timers, no I/O.

import { evaluate } from '../../shared/conditions.js';
import { TRAITS } from '../../shared/scenarioSchema.js';
import * as agents from './agents.js';
import { GameError } from './errors.js';
import { pickWeighted, randInt, randRange, shuffled } from './random.js';
import { addMessage } from './state.js';

/** The game clock stops while no human has polled for this long (nobody is watching). */
export const PAUSE_AFTER_MS = 10_000;
/** How long the ending waits for AI-written text before using the scenario's own text. */
export const EPILOGUE_WAIT_MS = 12_000;

/** Scenario seconds elapsed. */
export function gameTime(game, now) {
  return Math.max(0, (now - game.startedAt - game.pausedMs) / (1000 * game.timeScale));
}

/** The act currently running, with its variant (if any) applied. */
export function currentAct(scenario, game) {
  const started = game.acts.at(-1);
  if (!started) return null;
  return actWithVariant(scenario, started);
}

export function actWithVariant(scenario, started) {
  const act = scenario.acts.find((a) => a.id === started.id);
  const variant = started.variant == null ? null : act.variants[started.variant];
  const index = scenario.acts.indexOf(act);
  return {
    id: act.id,
    number: act.number,
    mark: act.mark,
    title: variant?.title ?? act.title,
    poem: variant?.poem ?? act.poem,
    startAt: act.startAt,
    endsAt: scenario.acts[index + 1]?.startAt ?? scenario.meta.durationSeconds,
  };
}

function randomTraits(seed, role) {
  return Object.fromEntries(
    TRAITS.map((trait) => {
      const [min, max] = role.traitRanges[trait];
      return [trait, randInt(seed, `trait:${role.id}:${trait}`, min, max)];
    }),
  );
}

/**
 * Seats players and starts a new game (mutates the draft). Players who picked a role keep it;
 * "Random" players get random free roles; every remaining role is played by AI.
 */
export function startGame(draft, scenario, { now, timeScale }) {
  const number = draft.gameCount + 1;
  const seed = `${draft.seed}:${number}`;
  const roleIds = scenario.roles.map((r) => r.id);
  const seats = Object.fromEntries(roleIds.map((id) => [id, null]));

  const waiting = [];
  for (const player of draft.players) {
    if (player.pick !== 'random' && seats[player.pick] === null) seats[player.pick] = player.id;
    else waiting.push(player);
  }
  const free = shuffled(
    seed,
    'seating',
    roleIds.filter((id) => seats[id] === null),
  );
  for (const player of waiting) {
    const roleId = free.shift();
    if (roleId) seats[roleId] = player.id;
  }

  const roles = {};
  const agentState = {};
  for (const role of scenario.roles) {
    roles[role.id] = {
      playerId: seats[role.id],
      traits: randomTraits(seed, role),
      minGap: randRange(seed, `gap:${role.id}`, 20, 30),
    };
    agentState[role.id] = { pending: null, lastSpokeAt: null, lines: 0, actsSpoken: [] };
  }

  draft.gameCount = number;
  draft.phase = 'playing';
  draft.messages = [];
  draft.game = {
    id: number,
    seed,
    timeScale,
    startedAt: now,
    pausedMs: 0,
    activeAt: now,
    roles,
    flags: { ...scenario.flags },
    cursor: 0,
    acts: [],
    openDecisions: [],
    resolved: [],
    agents: agentState,
    pendingSeq: 0,
    lastAiSpokeAt: null,
    aiLines: 0,
    ending: null,
  };
  processTimeline(draft, scenario, now);
}

/**
 * Brings the game up to date with the clock. Returns the same object if nothing changed,
 * otherwise a new state.
 * @param {number | null} presenceAt  latest time any human polled, before this request
 */
export function advance(state, scenario, now, presenceAt = null) {
  if (state.phase === 'ended') {
    const ending = state.game?.ending;
    if (ending?.status !== 'pending' || now < ending.deadline) return state;
    const draft = structuredClone(state);
    fillEndingText(draft, scenario, {});
    return draft;
  }
  if (state.phase !== 'playing') return state;

  const draft = structuredClone(state);
  const game = draft.game;
  let changed = false;

  // Nobody watching: stop the clock for the gap, so the story waits for the players.
  const lastActive = Math.max(presenceAt ?? 0, game.activeAt);
  if (now - lastActive > PAUSE_AFTER_MS) {
    game.pausedMs += now - lastActive;
    game.activeAt = now;
    changed = true;
  }

  if (processTimeline(draft, scenario, now)) changed = true;
  return changed ? draft : state;
}

/** Processes every due item in time order (mutates the draft). Returns whether anything happened. */
function processTimeline(draft, scenario, now) {
  const game = draft.game;
  const t = gameTime(game, now);
  const end = scenario.meta.durationSeconds;
  let changed = false;

  while (draft.phase === 'playing') {
    const item = scenario.timeline[game.cursor];
    const itemAt = item ? item.at : Infinity;
    const deadline = Math.min(Infinity, ...game.openDecisions.map((d) => d.deadline));
    if (Math.min(itemAt, deadline, end) > t) break;
    changed = true;

    // At equal times: a decision times out before the next item (it may change what comes next).
    if (deadline <= itemAt && deadline <= end) {
      const open = game.openDecisions.find((d) => d.deadline === deadline);
      const decision = scenario.decisionById.get(open.id);
      resolveDecision(draft, scenario, open.id, decision.historicalOptionId, {
        by: 'timeout',
        t: deadline,
        now,
      });
    } else if (itemAt <= end) {
      processItem(draft, scenario, item, now);
      game.cursor += 1;
    } else {
      endGame(draft, scenario, now);
    }
  }
  return changed;
}

function processItem(draft, scenario, item, now) {
  const game = draft.game;
  if (item.type === 'act') {
    const act = scenario.acts[item.index];
    const variant = act.variants.findIndex((v) => evaluate(v.condition, game.flags));
    const started = { id: act.id, variant: variant >= 0 ? variant : null, t: item.at };
    game.acts.push(started);
    const shown = actWithVariant(scenario, started);
    addMessage(draft, {
      kind: 'act',
      actId: act.id,
      text: `Act ${act.number} · ${shown.title}`,
      source: 'director',
      t: item.at,
      at: now,
    });
    agents.onActStart(draft, scenario, act);
    return;
  }

  if (item.type === 'event') {
    const event = scenario.events[item.index];
    if (!evaluate(event.condition, game.flags)) return; // checked when it comes due
    const message = addMessage(draft, {
      kind: 'narration',
      eventId: event.id,
      text: event.text,
      visibleTo: event.visibility,
      source: 'director',
      t: item.at,
      at: now,
    });
    Object.assign(game.flags, event.setsFlags ?? {});
    agents.onNarration(draft, scenario, message, event.concerns);
    return;
  }

  const decision = scenario.decisions[item.index];
  if (!evaluate(decision.condition, game.flags)) return;
  const open = {
    id: decision.id,
    roleId: decision.role,
    openedAt: item.at,
    deadline: item.at + decision.timeoutSeconds,
    aiDueAt: null,
  };
  if (agents.isAi(game, decision.role)) {
    // An AI takes a few seconds to "think", but always answers well before the deadline.
    const delay = randRange(game.seed, `decide:${decision.id}`, 4, 10);
    open.aiDueAt = item.at + Math.min(delay, decision.timeoutSeconds * 0.6);
  }
  game.openDecisions.push(open);
}

/**
 * Resolves an open decision (mutates the draft): sets flags and tells everyone the narration.
 * @param {{by: 'human'|'ai'|'timeout', t: number, now: number, line?: string}} how
 */
export function resolveDecision(draft, scenario, decisionId, optionId, { by, t, now, line }) {
  const game = draft.game;
  const open = game.openDecisions.find((d) => d.id === decisionId);
  if (!open) throw new GameError('That decision is already over', 409);
  const decision = scenario.decisionById.get(decisionId);
  const option =
    decision.options.find((o) => o.id === optionId) ??
    decision.options.find((o) => o.id === decision.historicalOptionId);

  game.openDecisions = game.openDecisions.filter((d) => d !== open);
  if (line && by === 'ai') {
    addMessage(draft, {
      kind: 'speech',
      roleId: decision.role,
      text: line,
      to: 'all',
      source: 'ai',
      t,
      at: now,
    });
    agents.recordAiLine(draft, decision.role, t);
  }
  Object.assign(game.flags, option.setsFlags ?? {});
  game.resolved.push({ id: decision.id, roleId: decision.role, optionId: option.id, by, t });
  const message = addMessage(draft, {
    kind: 'narration',
    decisionId: decision.id,
    text: option.narration,
    source: 'director',
    t,
    at: now,
  });
  agents.onNarration(draft, scenario, message, decision.concerns);
}

/** Persona-weighted choice used by the mock AI and when the LLM fails to answer usefully. */
export function personaChoice(scenario, game, decisionId) {
  const decision = scenario.decisionById.get(decisionId);
  const traits = game.roles[decision.role].traits;
  const weights = decision.options.map((option) => {
    let weight = 1;
    for (const [trait, bias] of Object.entries(option.aiBias))
      weight += (bias * (traits[trait] - 3)) / 2;
    return Math.max(0.15, weight);
  });
  return pickWeighted(game.seed, `choice:${decisionId}`, decision.options, weights).id;
}

function endGame(draft, scenario, now) {
  const game = draft.game;
  const end = scenario.meta.durationSeconds;
  for (const open of [...game.openDecisions]) {
    const decision = scenario.decisionById.get(open.id);
    resolveDecision(draft, scenario, open.id, decision.historicalOptionId, {
      by: 'timeout',
      t: Math.min(open.deadline, end),
      now,
    });
  }
  const ending = scenario.endingsByPriority.find((e) => evaluate(e.condition, game.flags));
  Object.assign(game.flags, ending.setsFlags ?? {});
  for (const agent of Object.values(game.agents)) agent.pending = null;
  game.ending = {
    id: ending.id,
    t: end,
    at: now,
    epilogue: null,
    deathPoem: null,
    status: 'pending', // pending → done (AI text) | fallback (scenario text)
    deadline: now + EPILOGUE_WAIT_MS,
  };
  draft.phase = 'ended';
}

/** Sets the ending's epilogue / death poem, using the scenario's text for anything missing. */
export function fillEndingText(draft, scenario, { epilogue, deathPoem }) {
  const ending = draft.game.ending;
  if (ending.status !== 'pending') return false;
  const def = scenario.endings.find((e) => e.id === ending.id);
  ending.epilogue = epilogue || def.fallbackEpilogue;
  ending.deathPoem = def.fallbackDeathPoem ? deathPoem || def.fallbackDeathPoem : null;
  ending.status = epilogue ? 'done' : 'fallback';
  return true;
}
