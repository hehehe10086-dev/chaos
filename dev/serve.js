// `npm start`: a production-like local server. Serves the built client from dist/ and the
// /api functions, as one service. (Vercel deploys the same files without this script.)
//   npm run build && npm start      → http://localhost:3000  (PORT to change)
//   npm run start:offline           → the same, but in-memory store + mock LLM (like dev:offline);
//                                     also reads .env.offline.local first (e.g. TIME_SCALE=0.2)

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { handleApi } from './api-dispatch.js';

const offline = process.argv.includes('--offline');
// loadEnvFile never overwrites a variable that is already set, so earlier files (and the shell) win.
for (const file of offline ? ['.env.offline.local', '.env'] : ['.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // no such file: in-memory store and mock LLM
  }
}
if (offline) {
  process.env.CHAOS_STORE = 'memory';
  process.env.LLM_PROVIDER = 'mock';
}

const root = process.cwd();
const dist = path.join(root, 'dist');
if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('No build found. Run `npm run build` first.');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

const loadModule = (p) => import(pathToFileURL(path.join(root, p)).href);

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.statusCode = 400; // e.g. "/%" — malformed percent-encoding
    res.end('Bad request');
    return;
  }
  let file = path.resolve(dist, `.${pathname}`);
  if (file !== dist && !file.startsWith(dist + path.sep)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  // Client-side routes like /room/ABCD get the app shell.
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(dist, 'index.html');

  res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  if (file.includes(`${path.sep}assets${path.sep}`)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  // One bad request must never take the whole server down.
  try {
    if (!(await handleApi(req, res, loadModule))) serveStatic(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () =>
  console.log(`Chaos is running at http://localhost:${port}${offline ? ' (offline mode)' : ''}`),
);
