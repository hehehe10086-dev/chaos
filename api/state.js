// GET /api/state?code=ABCD&since=<version>   (Authorization: Bearer <token>)
// Polling endpoint. Also advances the game clock (lazy tick) and starts the background AI
// worker when an AI job is due. Returns { changed: false } if nothing changed since
// `since`, otherwise { changed: true, view } — the view is filtered for this player.

import { bearerToken, normalizeRoomCode } from '../server/auth.js';
import { GameError } from '../server/engine/errors.js';
import { json, route } from '../server/http.js';
import { pollRoom } from '../server/rooms.js';

export const GET = route(async (request) => {
  const params = new URL(request.url).searchParams;
  const code = normalizeRoomCode(params.get('code'));
  if (!code) throw new GameError('Room codes are 4 letters');
  const since = params.get('since') ? Number(params.get('since')) : null;
  return json(await pollRoom(code, bearerToken(request), since));
});
