// Dev-only: serve files in /api the same way Vercel does, inside the Vite dev server.
// Each api/<name>.js exports Web-standard handlers (GET, POST, ...) that take a
// Request and return a Response — the same code runs unchanged on Vercel.

import { existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { loadEnv } from 'vite';

export function apiDevServer() {
  return {
    name: 'chaos-api-dev-server',
    apply: 'serve',
    configureServer(server) {
      // Expose .env values to API code via process.env, like Vercel does.
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const match = url.pathname.match(/^\/api\/([\w-]+)\/?$/);
        if (!url.pathname.startsWith('/api/')) return next();
        if (!match || !existsSync(`api/${match[1]}.js`)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        try {
          // ssrLoadModule re-imports on change, so API edits apply without a restart.
          const mod = await server.ssrLoadModule(`/api/${match[1]}.js`);
          const handler = mod[req.method];
          if (typeof handler !== 'function') {
            res.statusCode = 405;
            res.end(`Method ${req.method} not allowed`);
            return;
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
          res.end('Internal error (see dev server console)');
        }
      });
    },
  };
}
