// POST /api/room
//   { op: "create", name }        -> creates a room and joins it
//   { op: "join", code, name }    -> joins an existing room
// Both return { code, token, playerId, view }.

import { normalizeRoomCode } from '../server/auth.js';
import { GameError } from '../server/engine/errors.js';
import { cleanName } from '../server/engine/state.js';
import { json, readJson, route } from '../server/http.js';
import { createRoom, joinRoom } from '../server/rooms.js';

export const POST = route(async (request) => {
  const body = await readJson(request);
  const name = cleanName(body.name);

  if (body.op === 'create') return json(await createRoom(name));

  if (body.op === 'join') {
    const code = normalizeRoomCode(body.code);
    if (!code) throw new GameError('Room codes are 4 letters');
    return json(await joinRoom(code, name));
  }

  throw new GameError('op must be "create" or "join"');
});
