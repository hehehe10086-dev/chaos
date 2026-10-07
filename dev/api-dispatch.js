// Serves /api/<name> from api/<name>.js the way Vercel does: each file exports Web-standard
// handlers (GET, POST, ...) that take a Request and return a Response. Used by the Vite dev
// server (dev/vite-api-plugin.js) and by `npm start` (dev/serve.js); on Vercel the same files
// run as functions.

import { existsSync } from 'node:fs';
import { Readable } from 'node:stream';

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {(path: string) => Promise<Record<string, Function>>} loadModule  e.g. "/api/state.js"
 * @returns {Promise<boolean>} whether the request was an /api request (and was answered)
 */
export async function handleApi(req, res, loadModule) {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  if (!url.pathname.startsWith('/api/')) return false;

  const match = url.pathname.match(/^\/api\/([\w-]+)\/?$/);
  if (!match || !existsSync(`api/${match[1]}.js`)) {
    res.statusCode = 404;
    res.end('Not found');
    return true;
  }

  try {
    const mod = await loadModule(`/api/${match[1]}.js`);
    const handler = mod[req.method];
    if (typeof handler !== 'function') {
      res.statusCode = 405;
      res.end(`Method ${req.method} not allowed`);
      return true;
    }

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: hasBody ? Readable.toWeb(req) : undefined,
      duplex: hasBody ? 'half' : undefined,
    });

    const response = await handler(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal error (see server console)');
  }
  return true;
}
