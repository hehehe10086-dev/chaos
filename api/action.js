// POST /api/action   (Authorization: Bearer <token>)
//   { code, action: { type: "pickRole", roleId } }        roleId or "random" (lobby)
//   { code, action: { type: "start" } }                    host starts the game
//   { code, action: { type: "say", text } }                lobby chat, or in-character speech
//   { code, action: { type: "decide", decisionId, optionId } }
//   { code, action: { type: "playAgain", gameId } }
// Returns { view } with the updated state, so the sender sees the change immediately.

import { bearerToken, normalizeRoomCode } from '../server/auth.js';
import { GameError } from '../server/engine/errors.js';
import { json, readJson, route } from '../server/http.js';
import { performAction } from '../server/rooms.js';

// Actions a client may send. "join" goes through /api/room instead.
const CLIENT_ACTIONS = new Set(['pickRole', 'start', 'say', 'decide', 'playAgain']);

export const POST = route(async (request) => {
  const body = await readJson(request);
  const code = normalizeRoomCode(body.code);
  if (!code) throw new GameError('Room codes are 4 letters');

  const action = body.action ?? {};
  if (!CLIENT_ACTIONS.has(action.type)) throw new GameError(`Unknown action: ${action.type}`);
  return json(await performAction(code, bearerToken(request), action));
});
