// Loading and safely updating a room. Shared by rooms.js (requests) and ai/worker.js.

import { randomInt } from 'node:crypto';
import { hashToken } from './auth.js';
import { GameError } from './engine/errors.js';
import { getStore } from './store/index.js';

const MAX_CAS_RETRIES = 10;

export async function loadRoom(code) {
  const room = await getStore().get(code);
  if (!room) throw new GameError('Room not found', 404);
  return room;
}

/** Finds the player that owns this token, or throws 401. */
export function authenticate(state, token) {
  const tokenHash = token ? hashToken(token) : null;
  const player = tokenHash && state.players.find((p) => p.tokenHash === tokenHash);
  if (!player) throw new GameError('Not a player in this room', 401);
  return player;
}

/** Latest time any player polled, or null. */
export function latestPresence(presence) {
  const times = Object.values(presence ?? {});
  return times.length ? Math.max(...times) : null;
}

/**
 * Read -> update -> conditional write, retrying if someone else wrote in between.
 * If `update` returns the state unchanged (same object), nothing is written.
 * @param {string} code
 * @param {(state: object, room: {version: number, presence: Record<string, number>}) => object} update
 * @returns {Promise<{version: number, state: object, presence: Record<string, number>}>}
 */
export async function mutateRoom(code, update) {
  const store = getStore();
  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    const room = await loadRoom(code);
    const next = update(room.state, room);
    if (next === room.state) return room;
    if (await store.cas(code, room.version, next)) {
      return { version: room.version + 1, state: next, presence: room.presence };
    }
    // Lost the race: back off exponentially (capped), with random jitter so the
    // retrying requests spread out instead of colliding again.
    const maxWait = Math.min(1000, 25 * 2 ** attempt);
    await new Promise((r) => setTimeout(r, randomInt(Math.floor(maxWait / 2), maxWait + 1)));
  }
  throw new GameError('The room is busy, please try again', 409);
}
