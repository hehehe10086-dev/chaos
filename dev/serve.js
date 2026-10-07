// `npm start`: a production-like local server. Serves the built client from dist/ and the
// /api functions, as one service. (Vercel deploys the same files without this script.)
//   npm run build && npm start      → http://localhost:3000  (PORT to change)

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { handleApi } from './api-dispatch.js';

try {
  process.loadEnvFile('.env');
} catch {
  // no .env: in-memory store and mock LLM
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

const server = createServer(async (req, res) => {
  if (await handleApi(req, res, loadModule)) return;

  const { pathname } = new URL(req.url, 'http://localhost');
  let file = path.resolve(dist, `.${decodeURIComponent(pathname)}`);
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
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`Chaos is running at http://localhost:${port}`));
