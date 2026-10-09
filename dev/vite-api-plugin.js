// Dev-only: serve files in /api inside the Vite dev server (see dev/api-dispatch.js).
// `vite --mode offline` (npm run dev:offline) forces the in-memory store and the mock LLM,
// so local testing never touches the real database or a paid API.

import { loadEnv } from 'vite';
import { handleApi } from './api-dispatch.js';

export function apiDevServer() {
  return {
    name: 'chaos-api-dev-server',
    apply: 'serve',
    configureServer(server) {
      // Expose .env values to API code via process.env, like Vercel does.
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''));
      if (server.config.mode === 'offline') {
        process.env.CHAOS_STORE = 'memory';
        process.env.LLM_PROVIDER = 'mock';
      }

      server.middlewares.use(async (req, res, next) => {
        // ssrLoadModule re-imports on change, so API edits apply without a restart.
        const handled = await handleApi(req, res, (path) => server.ssrLoadModule(path));
        if (!handled) next();
      });
    },
  };
}
