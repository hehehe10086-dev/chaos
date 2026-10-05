# Progress

## Current status
Design phase. No game code yet. Plan agreed: Upstash Redis + polling, LLM behind an adapter (Claude Haiku 4.5 candidate, to be compared against Gemini Flash in W1).

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
- AI voting: rule-based initial lean + LLM-judged ±1 per round, or fixed by secret objective?
- Split of work between Yuqi and teammate (backend vs frontend)
- JavaScript (+JSDoc) or TypeScript?
- LLM billing account and daily budget cap
- First story: B-59 (1962)?
- Verify whether Upstash archives inactive free databases

## Log
- 2026-10-04 Yuqi — design review & plan; added repo collaboration files.
