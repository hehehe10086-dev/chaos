// Pure game logic: (state, action) -> new state. No I/O, no randomness, no clock —
// anything like that is passed in, so this is easy to test.
// M1 sandbox: a shared counter and a message list, to prove sync works.

export const MAX_PLAYERS = 8;
export const MAX_NAME_LENGTH = 20;
export const MAX_MESSAGE_LENGTH = 200;
const KEEP_MESSAGES = 50;

export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function cleanName(name) {
  const clean = String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!clean) throw new GameError('Please enter a name');
  if (clean.length > MAX_NAME_LENGTH)
    throw new GameError(`Name must be at most ${MAX_NAME_LENGTH} characters`);
  return clean;
}

/** @param {{code: string, now: number}} params */
export function createInitialState({ code, now }) {
  return { code, createdAt: now, players: [], counter: 0, messages: [] };
}

/**
 * @param {object} state
 * @param {{type: string, [key: string]: any}} action
 * @param {{playerId?: string, now: number}} ctx  playerId is the authenticated sender
 */
export function applyAction(state, action, ctx) {
  switch (action.type) {
    case 'join': {
      // action.player is built by the server (id, tokenHash, secret), not by the client.
      if (state.players.length >= MAX_PLAYERS) throw new GameError('This room is full', 409);
      const player = { ...action.player, name: cleanName(action.player.name), joinedAt: ctx.now };
      return { ...state, players: [...state.players, player] };
    }

    case 'increment': {
      requirePlayer(state, ctx.playerId);
      return { ...state, counter: state.counter + 1 };
    }

    case 'say': {
      requirePlayer(state, ctx.playerId);
      const text = String(action.text ?? '').trim();
      if (!text) throw new GameError('Message is empty');
      if (text.length > MAX_MESSAGE_LENGTH)
        throw new GameError(`Message must be at most ${MAX_MESSAGE_LENGTH} characters`);
      const message = { id: action.id, playerId: ctx.playerId, text, at: ctx.now };
      return { ...state, messages: [...state.messages, message].slice(-KEEP_MESSAGES) };
    }

    default:
      throw new GameError(`Unknown action: ${action.type}`);
  }
}

function requirePlayer(state, playerId) {
  if (!state.players.some((p) => p.id === playerId))
    throw new GameError('You are not in this room', 403);
}
