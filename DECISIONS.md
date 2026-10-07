# Decisions (branch `mvp-caesar`)

One line each: decision — why. Newest at the bottom.

- Keep the existing stack (JavaScript, Vercel serverless `api/`, Upstash Redis, polling) instead of the brief's default (TypeScript, Express, Socket.IO, in-memory) — the brief says to keep an existing stack, it is already deployed, and the contest requires serverless hosting with an external store (no long-running WebSocket server).
- No TypeScript type-check step — Yuqi chose JavaScript on 2026-10-04; scenario data is validated at runtime with zod, logic is covered by tests, and the client is checked by `vite build`.
- "No database" is read as "no accounts/user database": room state stays in Redis (in-memory store locally and in tests), because serverless functions share no memory.
- Base `mvp-caesar` on `main`, not on the unmerged `docs/teammate-handoff` branch — Yuqi now works alone, so the teammate handoff is obsolete.
- Scenario #1 is "The Ides of March"; the B-59 story idea is shelved — the brief replaces it.
- Prompt templates live in `server/prompts/` (not `server/src/prompts/`) — the repo has no `src/` folder on the server side.
