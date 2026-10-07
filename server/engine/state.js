// Room state: constructors and small helpers shared by the engine modules.
// Engine functions work on a structuredClone "draft" of the state and mutate it freely;
// callers only ever see the old state or the finished new one.

import { GameError } from './errors.js';

export const MAX_NAME_LENGTH = 20;
export const MAX_MESSAGE_LENGTH = 200;
const KEEP_MESSAGES = 300;

export function cleanName(name) {
  const clean = String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!clean) throw new GameError('Please enter a name');
  if (clean.length > MAX_NAME_LENGTH)
    throw new GameError(`Name must be at most ${MAX_NAME_LENGTH} characters`);
  return clean;
}

export function cleanText(text) {
  const clean = String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!clean) throw new GameError('Message is empty');
  if (clean.length > MAX_MESSAGE_LENGTH)
    throw new GameError(`Message must be at most ${MAX_MESSAGE_LENGTH} characters`);
  return clean;
}

/** @param {{code: string, now: number, scenarioId: string, seed: string}} params */
export function createRoomState({ code, now, scenarioId, seed }) {
  return {
    code,
    createdAt: now,
    scenarioId,
    seed,
    phase: 'lobby', // lobby | playing | ended
    hostId: null,
    seq: 0, // message id counter
    gameCount: 0,
    players: [],
    messages: [],
    game: null,
  };
}

/**
 * Appends a message (mutates the draft) and returns it.
 * kind: chat (lobby/after the game) | speech (in character) | narration | act | system
 * visibleTo: 'all' or a list of role ids (private narrator lines).
 */
export function addMessage(draft, message) {
  draft.seq += 1;
  const full = { id: `m${draft.seq}`, visibleTo: 'all', ...message };
  draft.messages.push(full);
  if (draft.messages.length > KEEP_MESSAGES)
    draft.messages.splice(0, draft.messages.length - KEEP_MESSAGES);
  return full;
}

export function findPlayer(state, playerId) {
  return state.players.find((p) => p.id === playerId) ?? null;
}

export function requirePlayer(state, playerId) {
  const player = findPlayer(state, playerId);
  if (!player) throw new GameError('You are not in this room', 403);
  return player;
}

/** The role this player controls in the current game, or null (lobby, spectator). */
export function roleOfPlayer(game, playerId) {
  if (!game || !playerId) return null;
  for (const [roleId, seat] of Object.entries(game.roles)) {
    if (seat.playerId === playerId) return roleId;
  }
  return null;
}
