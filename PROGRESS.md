# Progress

## Current status

Branch `mvp-caesar` (not pushed): the MVP "The Ides of March" from `CHAOS_MVP_BRIEF.md` — playable end to end on the mock LLM, plus all M5 stretch goals (mid-game takeover, Tab assist, voice input); 74 tests pass. No real LLM called yet (no key). See `STATUS.md` for details, what is verified, and "Needs Yuqi". `main` still has only the M1 sync sandbox (live at https://chaos-ten-hazel.vercel.app/).

## Decisions

- State store: Upstash Redis (single region, us-east-1) + polling; conditional writes via Lua on `version`
- LLM: behind an adapter (`server/llm/index.js`): Anthropic (Haiku 4.5 fast + Sonnet 5.5 smart) by default, OpenAI optional, deterministic mock offline
- Language: JavaScript (+ JSDoc where types help)
- First story: The Ides of March (the B-59 idea is shelved — see `DECISIONS.md`)
- Decisions instead of votes: at fixed points one character chooses (AI: persona-weighted or LLM choice); endings come from game rules, never from the LLM

## In progress

- Yuqi — review and push `mvp-caesar`, open the PR, test the Vercel Preview; add an Anthropic key

## Next (by priority)

1. Push + PR + Vercel Preview on a laptop and a real phone, then merge
2. With a real key: play a full game, read the transcript, tune prompts and check the cost
3. Real-phone checks: takeover from a second phone, "Ideas", voice input

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

- 2026-10-06 Claude (evening) — `npm start` verified (fixed: a malformed URL crashed it; added `start:offline`); phone-width pass (fixed lobby overflow, composer focus/placeholder, role card height); README run / API key / new scenario; OpenAI defaults → GPT-6 (+ reasoning-effort fix); M5: takeover with recap, Tab assist, voice input; fixed long era-voice rewrites being rejected and `tidyLine` dropping closing quotes. 74 tests.
- 2026-10-06 Claude — MVP on `mvp-caesar`: scenario JSON + schema, timeline engine, AI agents + worker, LLM adapter (mock/Anthropic/OpenAI), lobby/game/ending UI; STATUS.md written. Yuqi now works solo; B-59 shelved for the Ides of March.
- 2026-10-05 Claude — fixed Redis reads (hmget returns an array with automaticDeserialization off); CAS retries 10 with exponential backoff; Redis integration test.
- 2026-10-05 Claude — wrote HANDOFF.md (handoff to another AI tool).
- 2026-10-05 Yuqi — M1 sync sandbox: /api/room, /api/state, /api/action; memory + Redis stores; 9 tests.
- 2026-10-04 Yuqi — deployed scaffold to Vercel.
- 2026-10-04 Yuqi — scaffold: Vite 8, React 19, Tailwind 4, Prettier; local `/api` via Vite plugin.
- 2026-10-04 Yuqi — decided JavaScript, B-59 as first story, lean-based AI voting.
- 2026-10-04 Yuqi — design review & plan; added repo collaboration files.
