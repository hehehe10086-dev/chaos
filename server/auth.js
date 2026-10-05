// Player identity without login: each player gets a random secret token on join.
// The client keeps the token; the server stores only its hash.

import { createHash, randomBytes, randomInt } from 'node:crypto';

export function newToken() {
  return randomBytes(24).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('base64url');
}

export function newId() {
  return randomBytes(6).toString('base64url');
}

// No I or O, so codes can't be confused with 1 or 0.
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function newRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_LETTERS[randomInt(CODE_LETTERS.length)];
  return code;
}

/** Normalizes user input like " abcd " to "ABCD"; returns null if it can't be a room code. */
export function normalizeRoomCode(input) {
  const code = String(input ?? '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{4}$/.test(code) ? code : null;
}

/** Reads "Authorization: Bearer <token>". */
export function bearerToken(request) {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer (\S+)$/);
  return match ? match[1] : null;
}
