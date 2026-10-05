# Progress

## Current status

M1 sync sandbox is committed on branch `feat/m1-sync` (not pushed). Verified by Claude locally with the in-memory store: create room → 4-letter code → second player joins → shared counter + messages sync via polling within ~2s; refresh keeps identity; 20 concurrent increments lose nothing; 9 vitest tests pass.
NOT yet verified: Yuqi's own two-window test (blocked: dev server was not running — Yuqi must run `npm run dev` and keep that terminal open); `server/store/redis.js` against a real Upstash database; M1 on Vercel; real phone.
`main` = scaffold only, live at https://chaos-ten-hazel.vercel.app/ (`/api/health` OK).

## Decisions

- State store: Upstash Redis (single region, us-east-1) + polling; conditional writes via Lua on `version`
- LLM: behind an adapter (`server/llm/client.js`); Claude Haiku 4.5 candidate, compared against Gemini Flash in W1
- Language: JavaScript (+ JSDoc where types help)
- First story: B-59 submarine, Cuban Missile Crisis, Oct 1962
- AI voting: each AI seat has a numeric `lean` set by rules; each round an LLM structured judgment may shift it by at most ±1; the vote is a threshold on `lean`

## In progress

- Yuqi — branch `feat/m1-sync`: room create/join, seatToken auth, CAS writes, polling, per-player view

## Next (by priority)

1. Yuqi tests M1 locally: `npm run dev`, normal window + incognito window
2. Yuqi creates Upstash Redis via Vercel Storage (us-east-1, Free, no read regions), copies URL/TOKEN into local `.env`; re-test locally with Redis
3. Push `feat/m1-sync`, open PR, test on the Vercel Preview URL with laptop + real phone, merge
4. Write `docs/api.md` together (actions + per-seat view JSON + fixtures)
5. In parallel: `docs/spec.md` (first story script), Era Voice model comparison

## Milestones

- W1 (10/4–10/10): repo setup, M1 sync prototype deployed, story spec
- W2 (10/11–10/17): core loop — one full game playable online
- W3 (10/18–10/24): full seat model, edge cases, visual-novel UI, rate limits
- W4 (10/25–10/30): playtests, polish, freeze 10/27, submit 10/29

## Open questions / known issues

- Split of work between Yuqi and teammate (backend vs frontend)
- LLM billing account and daily budget cap
- Verify whether Upstash archives inactive free databases

## Log

- 2026-10-05 Claude — wrote HANDOFF.md (handoff to another AI tool).
- 2026-10-05 Yuqi — M1 sync sandbox: /api/room, /api/state, /api/action; memory + Redis stores; 9 tests.
- 2026-10-04 Yuqi — deployed scaffold to Vercel.
- 2026-10-04 Yuqi — scaffold: Vite 8, React 19, Tailwind 4, Prettier; local `/api` via Vite plugin.
- 2026-10-04 Yuqi — decided JavaScript, B-59 as first story, lean-based AI voting.
- 2026-10-04 Yuqi — design review & plan; added repo collaboration files.
