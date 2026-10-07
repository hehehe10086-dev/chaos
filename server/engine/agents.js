// AI characters, the pure part: deciding WHEN each AI role should speak.
// Generating WHAT they say is done by server/ai/ (LLM or mock) in a background worker,
// which asks readyTask() for the next job and hands the result to applyAgentSpeech().
//
// Rules (from the brief): an AI role speaks when addressed by name or role, after Director
// events that concern it, and at least once per act; at most one line per 20–30 s per agent,
// plus a global gap so the chat stays readable; a small random delay so it feels human.
// All times are scenario seconds, so TIME_SCALE scales them too.

import { rand, randRange } from './random.js';
import { addMessage } from './state.js';

export const GLOBAL_GAP = 8; // seconds between any two AI lines
export const MAX_AI_LINES = 90; // per game, a hard cap on LLM spend and chat noise
const REPLY_DELAY = [3, 8];
/** A human who asks an AI character something directly waits at most this long between its lines. */
const HUMAN_REPLY_GAP = 12;
const REACT_DELAY = [4, 10];
const PRIORITY = { act: 0, ambient: 1, event: 2, addressed: 3 };

export function isAi(game, roleId) {
  return Boolean(game.roles[roleId]) && !game.roles[roleId].playerId;
}

export function aiRoleIds(game) {
  return Object.keys(game.roles).filter((roleId) => isAi(game, roleId));
}

export function currentActId(game) {
  return game.acts.at(-1)?.id ?? null;
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Role ids whose name or alias appears in the text as a whole word. */
export function addressedRoles(scenario, text) {
  const found = [];
  for (const role of scenario.roles) {
    const words = [role.name, role.shortName, ...role.aliases].map(escapeRegExp).join('|');
    if (new RegExp(`\\b(?:${words})\\b`, 'i').test(text)) found.push(role.id);
  }
  return found;
}

/** Gives an AI role a pending line. A more important reason replaces a less important one. */
function schedule(draft, roleId, { reason, dueAt, replyTo = null, fromHuman = false }) {
  const game = draft.game;
  const agent = game.agents[roleId];
  if (!agent || !isAi(game, roleId)) return;
  const current = agent.pending;
  if (current && PRIORITY[current.reason] >= PRIORITY[reason]) {
    if (dueAt < current.dueAt && current.reason === reason) current.dueAt = dueAt;
    if (fromHuman && current.reason === reason) current.fromHuman = true;
    return;
  }
  game.pendingSeq += 1;
  agent.pending = {
    id: `p${game.pendingSeq}`,
    reason,
    dueAt: current ? Math.min(current.dueAt, dueAt) : dueAt,
    replyTo,
    fromHuman,
  };
}

/** Every AI role gets a line somewhere in the first part of each act. */
export function onActStart(draft, scenario, act) {
  const game = draft.game;
  const index = scenario.acts.findIndex((a) => a.id === act.id);
  const nextStart = scenario.acts[index + 1]?.startAt ?? scenario.meta.durationSeconds;
  const length = nextStart - act.startAt;
  for (const roleId of aiRoleIds(game)) {
    const offset = length * randRange(game.seed, `act:${act.id}:${roleId}`, 0.08, 0.55);
    schedule(draft, roleId, { reason: 'act', dueAt: act.startAt + offset });
  }
}

/** AI roles a narrator line concerns (and can see) react to it, usually. */
export function onNarration(draft, scenario, message, concerns = []) {
  const game = draft.game;
  const roles = new Set([...concerns, ...addressedRoles(scenario, message.text)]);
  if (message.visibleTo !== 'all') message.visibleTo.forEach((r) => roles.add(r));
  for (const roleId of roles) {
    if (message.visibleTo !== 'all' && !message.visibleTo.includes(roleId)) continue;
    if (rand(game.seed, `react:${message.id}:${roleId}`) > 0.8) continue;
    const delay = randRange(game.seed, `react-delay:${message.id}:${roleId}`, ...REACT_DELAY);
    schedule(draft, roleId, { reason: 'event', dueAt: message.t + delay });
  }
}

/** Someone spoke in character: whoever they addressed answers; a solo human is never ignored. */
export function onSpeech(draft, scenario, message) {
  const game = draft.game;
  const targets = new Set(addressedRoles(scenario, message.text));
  if (message.to && message.to !== 'all') targets.add(message.to);
  targets.delete(message.roleId);

  const aiTargets = [...targets].filter((roleId) => isAi(game, roleId));
  for (const roleId of aiTargets) {
    // AI-to-AI exchanges only sometimes, so two agents don't talk forever.
    if (message.source === 'ai' && rand(game.seed, `ai-ai:${message.id}:${roleId}`) > 0.5) continue;
    const delay = randRange(game.seed, `reply:${message.id}:${roleId}`, ...REPLY_DELAY);
    schedule(draft, roleId, {
      reason: 'addressed',
      dueAt: message.t + delay,
      replyTo: message.id,
      fromHuman: message.source === 'human',
    });
  }

  if (message.source === 'human' && targets.size === 0) {
    const quietest = aiRoleIds(game)
      .filter((roleId) => roleId !== message.roleId)
      .sort((a, b) => (game.agents[a].lastSpokeAt ?? -1) - (game.agents[b].lastSpokeAt ?? -1))
      .slice(0, 2);
    if (quietest.length && rand(game.seed, `ambient:${message.id}`) < 0.75) {
      const roleId =
        quietest[Math.floor(rand(game.seed, `ambient-pick:${message.id}`) * quietest.length)];
      const delay = randRange(game.seed, `ambient-delay:${message.id}`, ...REPLY_DELAY);
      schedule(draft, roleId, { reason: 'ambient', dueAt: message.t + delay, replyTo: message.id });
    }
  }
}

/** Bookkeeping after an AI role says anything (a chat line or a decision line). */
export function recordAiLine(draft, roleId, t) {
  const game = draft.game;
  const agent = game.agents[roleId];
  agent.lastSpokeAt = t;
  agent.lines += 1;
  const actId = currentActId(game);
  if (actId && !agent.actsSpoken.includes(actId)) agent.actsSpoken.push(actId);
  game.lastAiSpokeAt = t;
  game.aiLines += 1;
}

/**
 * The next AI job that is due now, or null. Pure: reads the state, changes nothing.
 * @returns {null | {type: 'decide', decisionId: string, roleId: string}
 *               | {type: 'speak', roleId: string, pendingId: string, reason: string, replyTo: string|null}
 *               | {type: 'ending'}}
 */
export function readyTask(state, t) {
  const game = state.game;
  if (state.phase === 'ended')
    return game?.ending?.status === 'pending' ? { type: 'ending' } : null;
  if (state.phase !== 'playing') return null;

  const decision = game.openDecisions.find(
    (d) => isAi(game, d.roleId) && d.aiDueAt != null && d.aiDueAt <= t,
  );
  if (decision) return { type: 'decide', decisionId: decision.id, roleId: decision.roleId };

  if (game.aiLines >= MAX_AI_LINES) return null;
  let best = null;
  for (const roleId of aiRoleIds(game)) {
    const agent = game.agents[roleId];
    if (!agent.pending) continue;
    const gap = agent.pending.fromHuman
      ? Math.min(game.roles[roleId].minGap, HUMAN_REPLY_GAP)
      : game.roles[roleId].minGap;
    const ready = Math.max(
      agent.pending.dueAt,
      agent.lastSpokeAt == null ? -Infinity : agent.lastSpokeAt + gap,
      game.lastAiSpokeAt == null ? -Infinity : game.lastAiSpokeAt + GLOBAL_GAP,
    );
    if (ready <= t && (!best || ready < best.ready))
      best = { ready, roleId, pending: agent.pending };
  }
  if (!best) return null;
  return {
    type: 'speak',
    roleId: best.roleId,
    pendingId: best.pending.id,
    reason: best.pending.reason,
    replyTo: best.pending.replyTo,
  };
}

/**
 * Posts an AI line produced for a 'speak' task (mutates the draft). Ignored if the task went
 * stale meanwhile (a human took the role, or a more important line was scheduled).
 * @returns {boolean} whether anything changed
 */
export function applyAgentSpeech(draft, scenario, task, result, t, now) {
  const game = draft.game;
  const agent = game.agents[task.roleId];
  if (draft.phase !== 'playing' || !agent?.pending || agent.pending.id !== task.pendingId)
    return false;
  agent.pending = null;
  if (!isAi(game, task.roleId) || !result?.speech) return true;
  const to = result.to && game.roles[result.to] && result.to !== task.roleId ? result.to : 'all';
  const message = addMessage(draft, {
    kind: 'speech',
    roleId: task.roleId,
    text: result.speech,
    to,
    source: 'ai',
    t,
    at: now,
  });
  recordAiLine(draft, task.roleId, t);
  onSpeech(draft, scenario, message);
  return true;
}
