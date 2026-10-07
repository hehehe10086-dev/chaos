# Decisions (branch `mvp-caesar`)

One line each: decision — why. Newest at the bottom.

- Keep the existing stack (JavaScript, Vercel serverless `api/`, Upstash Redis, polling) instead of the brief's default (TypeScript, Express, Socket.IO, in-memory) — the brief says to keep an existing stack, it is already deployed, and the contest requires serverless hosting with an external store (no long-running WebSocket server).
- No TypeScript type-check step — Yuqi chose JavaScript on 2026-10-04; scenario data is validated at runtime with zod, logic is covered by tests, and the client is checked by `vite build`.
- "No database" is read as "no accounts/user database": room state stays in Redis (in-memory store locally and in tests), because serverless functions share no memory.
- Base `mvp-caesar` on `main`, not on the unmerged `docs/teammate-handoff` branch — Yuqi now works alone, so the teammate handoff is obsolete.
- Scenario #1 is "The Ides of March"; the B-59 story idea is shelved — the brief replaces it.
- Prompt templates live in `server/prompts/` (not `server/src/prompts/`) — the repo has no `src/` folder on the server side.
- M1 and M2 were built and committed together — the lobby's Start button needs the game engine; both milestone checks passed before the commit.
- Timed play on serverless: every request runs a pure `advance()` (lazy tick); AI work runs after the response in a background worker (`waitUntil` + Redis lock `lock:worker:<code>`, 30 s TTL, 20 s budget) — there is no server process to hold timers.
- The game clock pauses when no human has polled for 10 s — presence is kept per player in the room hash (`p:<id>`) without bumping the version; this also means AI never plays to an empty room.
- Scenario fields added beyond the brief: role `shortName`, `aliases`, `persona`, `bonds`, `sampleLines`; option `aiBias`; event/decision `concerns`; meta `setting`, `mockStyle`, `deathPoem.role` — needed for addressing, the mock provider and fallbacks. Role-level `historicalDefaults` is not duplicated: each decision has `historicalOptionId`.
- Adding a scenario = one JSON file + one import line in `scenarios/index.js` (static imports keep Vercel's file tracing simple).
- AI pacing: per-agent gap 20–30 s, but 12 s when a human addressed that character by name; global gap 8 s; max 90 AI lines per game — solo play felt unresponsive otherwise, and 6 s made the chat hard to read.
- If a human speaks without naming anyone, one of the two quietest AI characters usually answers — a solo player is never ignored.
- Players who join after the start are spectators until the M5 takeover exists; max 5 humans (one per role).
- "Play again" restarts at once with the same seats (Random pickers re-drawn) and new traits — fewest clicks for solo play.
- If the host has not polled for 20 s, anyone may start the game — covers "host left the lobby".
- AI decisions: mock = persona-weighted choice from per-option `aiBias`; LLM failure = historical option (as in the brief).
- Ending text: the worker writes the AI epilogue/death poem; after 12 s without it the scenario text is used. The death poem appears only for endings that have `fallbackDeathPoem` (Caesar died).
- No Anthropic server-side refusal-fallback beta — for Sonnet 5.5 it only reroutes cyber/frontier_llm declines, which do not apply here; our own fallbacks handle refusals.
- Anthropic calls: system prompt marked `cache_control: ephemeral` (stable per character per game); `effort: low` plus 1024 tokens of headroom on models that think; no `temperature` (Sonnet 5.5 rejects it); Haiku gets no effort setting.
- OpenAI is called over fetch (no SDK); default models `gpt-5.4-nano` / `gpt-5.4-mini` are unverified — sources disagreed.
- `LLM_DAILY_CAP` (default 3000 real calls/day, counted in Redis) protects the public URL from running up a bill.
- `npm start` is `dev/serve.js`, not a root `server.js` — Vercel treats a root `server.js` as a Node server entrypoint.
- `npm run dev:offline` / `CHAOS_STORE=memory` for testing without touching Redis or a paid LLM.
- Tests use a fixed seed (`options.seed`); real rooms use a random seed.
- No images and no Wikimedia downloads: portraits are SVG coins (metal derived from `portraitKey`) — downloading third-party files needs Yuqi's explicit OK, and the brief marks it optional.
- Anti-spam cooldown (1.5 s per player) ignores out-of-order clocks, so a retried write or another server's clock never counts as spam.
- `npm run start:offline` (= `node dev/serve.js --offline`): the production build with the in-memory store + mock LLM, reading `.env.offline.local` first — `.env` holds the real Redis credentials, and verifying the build should not need them.
- `dev/serve.js` answers a malformed URL (e.g. `/%`) with 400 and wraps every request in try/catch — one bad request used to crash `npm start` (unhandled rejection).
