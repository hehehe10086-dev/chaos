// POST /api/action   (Authorization: Bearer <token>)
//   { code, action: { type: "increment" } }
//   { code, action: { type: "say", text } }
// Returns { view } with the updated state, so the sender sees the change immediately.

import { bearerToken, normalizeRoomCode } from '../server/auth.js';
import { GameError } from '../server/engine/applyAction.js';
import { json, readJson, route } from '../server/http.js';
import { performAction } from '../server/rooms.js';

// Actions a client may send. "join" goes through /api/room instead.
const CLIENT_ACTIONS = new Set(['increment', 'say']);

export const POST = route(async (request) => {
  const body = await readJson(request);
  const code = normalizeRoomCode(body.code);
  if (!code) throw new GameError('Room codes are 4 letters');

  const action = body.action ?? {};
  if (!CLIENT_ACTIONS.has(action.type)) throw new GameError(`Unknown action: ${action.type}`);

  return json(await performAction(code, bearerToken(request), action));
});
