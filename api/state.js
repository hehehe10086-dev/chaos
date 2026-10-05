// GET /api/state?code=ABCD&since=<version>   (Authorization: Bearer <token>)
// Polling endpoint. Returns { changed: false } if nothing changed since `since`,
// otherwise { changed: true, view } — the view is filtered for this player.

import { bearerToken, normalizeRoomCode } from '../server/auth.js';
import { GameError } from '../server/engine/applyAction.js';
import { viewFor } from '../server/engine/view.js';
import { json, route } from '../server/http.js';
import { authenticate, loadRoom } from '../server/rooms.js';

export const GET = route(async (request) => {
  const params = new URL(request.url).searchParams;
  const code = normalizeRoomCode(params.get('code'));
  if (!code) throw new GameError('Room codes are 4 letters');

  const room = await loadRoom(code);
  const player = authenticate(room.state, bearerToken(request));

  if (Number(params.get('since')) === room.version) {
    return json({ changed: false, version: room.version });
  }
  return json({ changed: true, view: viewFor(room.state, room.version, player.id) });
});
