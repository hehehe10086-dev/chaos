// Room operations behind the API: create, join, poll, act.
// Every request brings the game up to date first (lazy tick), and kicks the background AI
// worker when an AI job is due.

import { randomInt } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { rewriteLine } from './ai/tasks.js';
import { runWorker } from './ai/worker.js';
import { hashToken, newId, newRoomCode, newToken } from './auth.js';
import { readyTask } from './engine/agents.js';
import { applyAction, tooSoon } from './engine/applyAction.js';
import { GameError } from './engine/errors.js';
import { advance, gameTime } from './engine/game.js';
import { cleanText, createRoomState, roleOfPlayer } from './engine/state.js';
import { viewFor } from './engine/view.js';
import { authenticate, latestPresence, loadRoom, mutateRoom } from './roomData.js';
import { getScenario } from './scenarios.js';
import { getStore } from './store/index.js';

const TOUCH_EVERY_MS = 3000; // presence is refreshed at most this often per player
const HOST_AWAY_MS = 20_000; // after this, anyone may start the game

/** TIME_SCALE env: multiplies every scenario timing (0.1 = a 1-minute game). */
export function envTimeScale() {
  const value = Number(process.env.TIME_SCALE);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.max(value, 0.001), 10) : 1;
}

/**
 * @typedef {object} RequestOptions
 * @property {number} [now]  current time (injectable for tests)
 * @property {(promise: Promise<unknown>) => void} [background]  keeps background work alive
 * @property {() => number} [clock]  clock for the background worker (tests)
 * @property {number} [timeScale]  overrides TIME_SCALE when a game starts (tests)
 * @property {string} [seed]  fixed randomness for a new room (tests)
 */

function kickWorker(code, state, now, options) {
  const t = state.game ? gameTime(state.game, now) : 0;
  if (!readyTask(state, t)) return;
  const work = runWorker(code, { clock: options.clock });
  (options.background ?? waitUntil)(work);
}

function view(room, playerId, now) {
  const scenario = getScenario(room.state.scenarioId);
  return viewFor(room.state, room.version, playerId, { scenario, now, presence: room.presence });
}

export async function createRoom(name, options = {}) {
  const now = options.now ?? Date.now();
  const store = getStore();
  const scenario = getScenario();
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = newRoomCode();
    const seed = options.seed ?? String(randomInt(1e9)); // tests pass a fixed seed
    const state = createRoomState({ code, now, scenarioId: scenario.meta.id, seed });
    if (await store.create(code, state)) return joinRoom(code, name, options);
  }
  throw new GameError('Could not create a room, please try again', 503);
}

export async function joinRoom(code, name, options = {}) {
  const now = options.now ?? Date.now();
  const token = newToken();
  const player = { id: newId(), name, tokenHash: hashToken(token) };
  const room = await mutateRoom(code, (state, r) => {
    const scenario = getScenario(state.scenarioId);
    const current = advance(state, scenario, now, latestPresence(r.presence));
    return applyAction(current, { type: 'join', player }, { scenario, now });
  });
  await getStore().touch(code, player.id, now);
  room.presence = { ...room.presence, [player.id]: now };
  return { code, token, playerId: player.id, view: view(room, player.id, now) };
}

/**
 * Polling. Advances the game clock, refreshes presence, and returns the player's view —
 * or { changed: false } if the client already has this version.
 */
export async function pollRoom(code, token, since, options = {}) {
  const now = options.now ?? Date.now();
  let playerId;
  const room = await mutateRoom(code, (state, r) => {
    playerId = authenticate(state, token).id; // before anything is written
    return advance(state, getScenario(state.scenarioId), now, latestPresence(r.presence));
  });

  if (now - (room.presence[playerId] ?? 0) >= TOUCH_EVERY_MS) {
    await getStore().touch(code, playerId, now);
    room.presence = { ...room.presence, [playerId]: now };
  }
  kickWorker(code, room.state, now, options);

  if (since != null && since === room.version) return { changed: false, version: room.version };
  return { changed: true, view: view(room, playerId, now) };
}

/** Rewrites an in-game line into the era voice before the (fast) state update. */
async function prepareSay(code, token, action, now) {
  const { state } = await loadRoom(code);
  const player = authenticate(state, token);
  if (tooSoon(player, now)) throw new GameError('Slow down a little', 429);
  const text = cleanText(action.text);
  const roleId = state.phase === 'playing' ? roleOfPlayer(state.game, player.id) : null;
  if (!roleId) return { type: 'say', text };
  const scenario = getScenario(state.scenarioId);
  const rewritten = await rewriteLine(scenario, scenario.roleById.get(roleId), text);
  return { type: 'say', text: rewritten, original: text };
}

export async function performAction(code, token, action, options = {}) {
  let now = options.now ?? Date.now();
  if (action.type === 'say') {
    action = await prepareSay(code, token, action, now);
    if (options.now == null) now = Date.now(); // the rewrite took time
  }

  let playerId;
  const room = await mutateRoom(code, (state, r) => {
    const scenario = getScenario(state.scenarioId);
    playerId = authenticate(state, token).id;
    const current = advance(state, scenario, now, latestPresence(r.presence));
    const hostSeen = r.presence[state.hostId] ?? 0;
    return applyAction(current, action, {
      scenario,
      now,
      playerId,
      timeScale: options.timeScale ?? envTimeScale(),
      hostAway: now - hostSeen > HOST_AWAY_MS,
    });
  });
  kickWorker(code, room.state, now, options);
  return { view: view(room, playerId, now) };
}
