# Progress

## Current status

Branch `mvp-caesar` (not pushed): the MVP "The Ides of March" from `CHAOS_MVP_BRIEF.md` — playable end to end on the mock LLM; 48 tests pass. See `STATUS.md` for details and next steps. `main` still has only the M1 sync sandbox (live at https://chaos-ten-hazel.vercel.app/).

## Decisions

- State store: Upstash Redis (single region, us-east-1) + polling; conditional writes via Lua on `version`
- LLM: behind an adapter (`server/llm/client.js`); Claude Haiku 4.5 candidate, compared against Gemini Flash in W1
- Language: JavaScript (+ JSDoc where types help)
- First story: B-59 submarine, Cuban Missile Crisis, Oct 1962
- AI voting: each AI seat has a numeric `lean` set by rules; each round an LLM structured judgment may shift it by at most ±1; the vote is a threshold on `lean`

## In progress

- Yuqi — branch `feat/m1-sync`: room create/join, seatToken auth, CAS writes, polling, per-player view

## Next (by priority)

1. PR for `feat/m1-sync` is open and Redis is connected to the Vercel project: redeploy the Preview, test with laptop + real phone, then merge
2. Write `docs/api.md` together (actions + per-seat view JSON + fixtures)
3. In parallel: `docs/spec.md` (first story script), Era Voice model comparison

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

- 2026-10-06 Claude — MVP on `mvp-caesar`: scenario JSON + schema, timeline engine, AI agents + worker, LLM adapter (mock/Anthropic/OpenAI), lobby/game/ending UI; STATUS.md written. Yuqi now works solo; B-59 shelved for the Ides of March.
- 2026-10-05 Claude — fixed Redis reads (hmget returns an array with automaticDeserialization off); CAS retries 10 with exponential backoff; Redis integration test.
- 2026-10-05 Claude — wrote HANDOFF.md (handoff to another AI tool).
- 2026-10-05 Yuqi — M1 sync sandbox: /api/room, /api/state, /api/action; memory + Redis stores; 9 tests.
- 2026-10-04 Yuqi — deployed scaffold to Vercel.
- 2026-10-04 Yuqi — scaffold: Vite 8, React 19, Tailwind 4, Prettier; local `/api` via Vite plugin.
- 2026-10-04 Yuqi — decided JavaScript, B-59 as first story, lean-based AI voting.
- 2026-10-04 Yuqi — design review & plan; added repo collaboration files.
