# Progress

## Current status
Design phase. No game code yet.

## Decisions
- State store: Upstash Redis (single region, us-east-1) + polling; conditional writes via Lua on `version`
- LLM: behind an adapter (`server/llm/client.js`); Claude Haiku 4.5 candidate, compared against Gemini Flash in W1
- Language: JavaScript (+ JSDoc where types help)
- First story: B-59 submarine, Cuban Missile Crisis, Oct 1962
- AI voting: each AI seat has a numeric `lean` set by rules; each round an LLM structured judgment may shift it by at most ±1; the vote is a threshold on `lean`

## In progress
- Yuqi — branch `chore/repo-setup`: `.gitattributes`, `CLAUDE.md`, `PROGRESS.md`

## Next (by priority)
1. Decide open questions (below)
2. Scaffold Vite + React + Tailwind (+ Vercel functions)
3. Write `docs/api.md` together (actions + per-seat view JSON + fixtures)
4. M1 sync prototype: create room → 4-letter code → second device joins → shared state updates ≤2s; deploy to Vercel and test on a real phone
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
- 2026-10-04 Yuqi — decided JavaScript, B-59 as first story, lean-based AI voting.
- 2026-10-04 Yuqi — design review & plan; added repo collaboration files.
