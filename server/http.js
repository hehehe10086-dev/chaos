// Helpers shared by the /api handlers.

import { GameError } from './engine/applyAction.js';

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new GameError('Request body must be JSON');
  }
}

/** Wraps a handler so GameErrors become JSON error responses and crashes become 500s. */
export function route(handler) {
  return async (request) => {
    try {
      return await handler(request);
    } catch (err) {
      if (err instanceof GameError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: 'Something went wrong on the server' }, 500);
    }
  };
}
