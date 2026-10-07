# Chaos — Project Rules

Multiplayer historical role-play party game for the Handshake AI Skills Studio Multiplayer Game Challenge.
**Deadline: 2026-10-30 11:59 PM PT.** Feature freeze 10/27, target submission 10/29.
Yuqi builds it alone (the teammate is credited but not active).

## Where things are

- `STATUS.md` — **read first**: what works, what's verified, next steps, what Yuqi must do by hand.
- `CHAOS_MVP_BRIEF.md` — the MVP spec (scenario #1 "The Ides of March"). `PLAN.md` — how it is built.
- `DECISIONS.md` — every judgment call, one line each. Add to it when you decide something.
- `README.md` — original design doc. `README.zh-CN.md` is a personal translation; do not keep it in sync.
- `PROGRESS.md` — short dated log. `HANDOFF.md` — pointer for a new AI/tool taking over.
- `scenarios/*.json` — all story content (validated by `shared/scenarioSchema.js`).

## Commands

- `npm install` — install dependencies (Node 24)
- `npm run dev` — frontend + `/api` at http://localhost:5173 (uses Redis from `.env` if present)
- `npm run dev:offline` — same, but in-memory store + mock LLM (never touches Redis or a paid API)
- `npm test` — Vitest (tests force memory store + mock; `tests/redis.test.js` uses real Upstash if `.env` has it)
- `npm run build` then `npm start` — production-like local server at http://localhost:3000 (`dev/serve.js`)
- `npm run format` — Prettier

`/api/*.js` export Web-standard handlers (`export const GET = route(async (request) => Response)`).
Locally they are served by `dev/api-dispatch.js`; on Vercel the same files run as functions.

## Architecture rules (non-negotiable)

- The server is the single source of truth. Clients only submit actions and render state.
- Hidden information is filtered on the server, in one place (`server/engine/view.js`, an allowlist).
- Players are authenticated by a random token (server stores only its hash), never by name/id alone.
- Every state write is a compare-and-set on `version` (`server/roomData.js` → `mutateRoom`).
- Endings and decisions are decided by game rules and buttons. The LLM only performs. Never infer decisions or flags from chat.
- LLM prompts never contain another role's secrets. The epilogue sees only the public transcript.
- Every LLM call has a timeout and a non-LLM fallback (`server/ai/tasks.js`), so the game never stalls.
- No server timers: every request runs `advance()` (lazy tick); slow AI work runs in a background worker (`server/ai/worker.js`, `waitUntil` + Redis lock).

## Code conventions

- JavaScript (ES modules), JSDoc for shared shapes. No TypeScript.
- `api/` holds thin handlers only; logic lives in `server/` (every file in `api/` becomes a Vercel function).
- Never add a root `server.js` — Vercel would treat it as a Node server entrypoint.
- Engine (`server/engine/`) is pure: clone, mutate the draft, return it — or return the _same_ object when nothing changed (then no write happens).
- The engine knows nothing about Rome: story content lives in `scenarios/*.json`; register new files in `scenarios/index.js`.
- Only `server/llm/` knows which LLM provider is used. Prompt templates live in `server/prompts/`.

## Secrets (this repo is PUBLIC)

- API keys live only in `.env` (gitignored) and in Vercel env vars. Never commit them, never put them in frontend code.
- `.env.example` lists variable names only, no values.

## Git workflow

- `main` is always playable. Work on branches and merge via Pull Request.
- Commit after each working step. Message format: `feat: …`, `fix: …`, `docs: …`, `chore: …`.
- Ask Yuqi before pushing. Never force-push or rewrite history.
- Line endings are enforced by `.gitattributes` (LF).

## Working with Yuqi

- Reply in Chinese; keep technical terms in English.
- Yuqi is learning git: explain each git operation and key decision in one or two sentences.
- Small steps: after each step, give localhost verification steps.
- For anything that changes over time (pricing, model names, free tiers, API usage), look it up — don't rely on memory.

## Art

- MVP has no generated images: portraits are SVG coins (`src/components/Medallion.jsx`).
- If images are added later, list them in `docs/art-list.md` (purpose, size/ratio, filename, folder, description) and use placeholders until they arrive.
