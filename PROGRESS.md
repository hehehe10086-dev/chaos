# Progress

## Current status

Branch `mvp-caesar` (not pushed): the MVP "The Ides of March" from `CHAOS_MVP_BRIEF.md` — playable end to end on the mock LLM, plus all M5 stretch goals (mid-game takeover, Tab assist, voice input); 74 tests pass. No real LLM called yet (no key). Since 2026-10-08 a classmate develops and tests — see `HANDOFF.md`. `main` still has only the M1 sync sandbox (live at https://chaos-ten-hazel.vercel.app/).

## Decisions

- State store: Upstash Redis (single region, us-east-1) + polling; conditional writes via Lua on `version`
- LLM: behind an adapter (`server/llm/index.js`): Anthropic (Haiku 4.5 fast + Sonnet 5.5 smart) by default, OpenAI optional, deterministic mock offline
- Language: JavaScript (+ JSDoc where types help)
- First story: The Ides of March (the B-59 idea is shelved — see `DECISIONS.md`)
- Decisions instead of votes: at fixed points one character chooses (AI: persona-weighted or LLM choice); endings come from game rules, never from the LLM

## In progress

- Yuqi — owner-only steps in `HANDOFF.md` §1: push `mvp-caesar`, invite the classmate, share Vercel Previews, API key
- Classmate — from 2026-10-08: setup and local testing (`HANDOFF.md` §2, `TESTING.md`)

## Next (by priority)

The dated plan is in `HANDOFF.md` §3: Preview test on a laptop + real phone → merge → real-AI playtests and
prompt tuning → playtest with someone new → feature freeze 10/27 → submit 10/29.

## Milestones

- W1 (10/4–10/10): repo setup, M1 sync prototype deployed, story spec
- W2 (10/11–10/17): core loop — one full game playable online
- W3 (10/18–10/24): full seat model, edge cases, visual-novel UI, rate limits
- W4 (10/25–10/30): playtests, polish, freeze 10/27, submit 10/29

## Open questions / known issues

- ~~Split of work between Yuqi and teammate~~ — 2026-10-08: the classmate develops and tests, Yuqi owns accounts (`HANDOFF.md`)
- LLM billing account and daily budget cap (Yuqi; `LLM_DAILY_CAP` defaults to 3000 calls/day)
- Verify whether Upstash archives inactive free databases

## Log

- 2026-10-08 Claude — handoff to a classmate: `HANDOFF.md` rewritten for a human teammate (owner-only steps, day one, dated plan), `TESTING.md` (manual test plan + bug template + log), `docs/submission.md` + `docs/art-list.md` (title, description, cover image brief). Nothing pushed yet.
- 2026-10-06 Claude (evening) — `npm start` verified (fixed: a malformed URL crashed it; added `start:offline`); phone-width pass (fixed lobby overflow, composer focus/placeholder, role card height); README run / API key / new scenario; OpenAI defaults → GPT-6 (+ reasoning-effort fix); M5: takeover with recap, Tab assist, voice input; fixed long era-voice rewrites being rejected and `tidyLine` dropping closing quotes. 74 tests.
- 2026-10-06 Claude — MVP on `mvp-caesar`: scenario JSON + schema, timeline engine, AI agents + worker, LLM adapter (mock/Anthropic/OpenAI), lobby/game/ending UI; STATUS.md written. Yuqi now works solo; B-59 shelved for the Ides of March.
- 2026-10-05 Claude — fixed Redis reads (hmget returns an array with automaticDeserialization off); CAS retries 10 with exponential backoff; Redis integration test.
- 2026-10-05 Claude — wrote HANDOFF.md (handoff to another AI tool).
- 2026-10-05 Yuqi — M1 sync sandbox: /api/room, /api/state, /api/action; memory + Redis stores; 9 tests.
- 2026-10-04 Yuqi — deployed scaffold to Vercel.
- 2026-10-04 Yuqi — scaffold: Vite 8, React 19, Tailwind 4, Prettier; local `/api` via Vite plugin.
- 2026-10-04 Yuqi — decided JavaScript, B-59 as first story, lean-based AI voting.
- 2026-10-04 Yuqi — design review & plan; added repo collaboration files.
