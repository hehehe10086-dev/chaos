// Room operations: load, create, join, and apply actions with conditional writes.

import { randomInt } from 'node:crypto';
import { hashToken, newId, newRoomCode, newToken } from './auth.js';
import { GameError, applyAction, createInitialState } from './engine/applyAction.js';
import { viewFor } from './engine/view.js';
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

/**
 * Read -> apply -> conditional write, retrying if someone else wrote in between.
 * @param {string} code
 * @param {(state: object) => object} update  pure function returning the new state
 */
export async function mutateRoom(code, update) {
  const store = getStore();
  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    const room = await loadRoom(code);
    const next = update(room.state);
    if (await store.cas(code, room.version, next)) {
      return { version: room.version + 1, state: next };
    }
    // Lost the race: back off exponentially (capped), with random jitter so the
    // retrying requests spread out instead of colliding again.
    const maxWait = Math.min(1000, 25 * 2 ** attempt);
    await new Promise((r) => setTimeout(r, randomInt(Math.floor(maxWait / 2), maxWait + 1)));
  }
  throw new GameError('The room is busy, please try again', 409);
}

export async function createRoom(name) {
  const store = getStore();
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = newRoomCode();
    const state = createInitialState({ code, now: Date.now() });
    if (await store.create(code, state)) return joinRoom(code, name);
  }
  throw new GameError('Could not create a room, please try again', 503);
}

export async function joinRoom(code, name) {
  const token = newToken();
  const player = {
    id: newId(),
    name,
    tokenHash: hashToken(token),
    secret: randomInt(10, 100), // M1 demo of private info: only this player may see it
  };
  const room = await mutateRoom(code, (state) =>
    applyAction(state, { type: 'join', player }, { now: Date.now() }),
  );
  return { code, token, playerId: player.id, view: viewFor(room.state, room.version, player.id) };
}

export async function performAction(code, token, action) {
  let playerId;
  const room = await mutateRoom(code, (state) => {
    playerId = authenticate(state, token).id;
    // Ids and the sender are set by the server, never trusted from the client.
    return applyAction(state, { ...action, id: newId() }, { playerId, now: Date.now() });
  });
  return { view: viewFor(room.state, room.version, playerId) };
}
