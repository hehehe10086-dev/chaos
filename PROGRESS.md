# Progress

> Teammate starting now? Read `HANDOFF.md` first.

## Current status

**M1 (sync sandbox) is done, merged to `main` (PR #3), and live** at https://chaos-ten-hazel.vercel.app/ — create room → 4-letter code → others join by code/link → shared counter + messages sync via polling (~1.5 s); private per-player "secret number"; refresh keeps identity. Backed by Upstash Redis in production. 10 tests pass. Verified by Yuqi locally (in-memory + Redis), on the Vercel Preview with a laptop + real phone, and on production after merge.

**On hold:** the B-59 story spec (`docs/spec.md`) — Yuqi wants a careful discussion with the teammate before anything is written.

## Decisions

- State store: Upstash Redis (us-east-1, no read regions; created via Vercel Storage as `upstash-kv-emerald-car`) + polling; conditional writes via Lua on `version`
- LLM: behind an adapter (`server/llm/client.js`, not built); Claude Haiku 4.5 candidate, to be compared against Gemini Flash
- Language: JavaScript (+ JSDoc where types help)
- First story: B-59 submarine, Cuban Missile Crisis, Oct 1962
- AI voting: each AI seat has a numeric `lean` set by rules; each round an LLM structured judgment may shift it by at most ±1; the vote is a threshold on `lean`
- Merging: use "Create a merge commit" (not squash) — Vercel Hobby only deploys commits authored by the owner (unverified for our project, see `HANDOFF.md` §6)

## In progress

- Nobody. Handoff docs on branch `docs/teammate-handoff`, waiting to be merged.

## Next (by priority)

1. Yuqi: add the teammate as a GitHub collaborator; merge the handoff PR; delete remote branch `feat/m1-sync`
2. Story spec discussion (Yuqi + teammate) → `docs/spec.md`
3. `docs/api.md` + `shared/fixtures/` (after the spec)
4. Teammate, not blocked by the spec: visual-novel UI shell with placeholders, `docs/art-list.md` style guide, rules page skeleton, slower polling when idle
5. Era Voice model comparison (needs LLM billing decision)

## Milestones

- W1 (10/4–10/10): repo setup ✅, M1 sync prototype deployed ✅, story spec (on hold)
- W2 (10/11–10/17): core loop — one full game playable online
- W3 (10/18–10/24): full seat model, edge cases, visual-novel UI, rate limits
- W4 (10/25–10/30): playtests, polish, freeze 10/27, submit 10/29

## Open questions / known issues

- Split of work between Yuqi and teammate (backend vs frontend)
- LLM billing account and daily budget cap
- Vercel Hobby: teammate's commits probably won't get Preview deploys — OK, or move/upgrade?
- Verify whether Upstash archives inactive free databases

## Log

- 2026-10-05 Claude — rewrote HANDOFF.md for the teammate (English); story spec put on hold.
- 2026-10-05 Yuqi — merged PR #3; M1 live in production.
- 2026-10-05 Yuqi — tested M1 on Vercel Preview with laptop + real phone.
- 2026-10-05 Yuqi — created Upstash Redis via Vercel Storage, configured local `.env`; found the "writes work, reads say Room not found" bug via the Upstash data browser; verified the fix and restart persistence.
- 2026-10-05 Claude — fixed Redis reads (hmget returns an array with automaticDeserialization off); CAS retries 10 with exponential backoff; Redis integration test.
- 2026-10-05 Yuqi — tested M1 locally with normal + incognito windows.
- 2026-10-05 Claude — M1 sync sandbox: /api/room, /api/state, /api/action; memory + Redis stores; 9 tests.
- 2026-10-04 Yuqi — created the Vercel project and deployed the scaffold.
- 2026-10-04 Claude — scaffold: Vite 8, React 19, Tailwind 4, Prettier; local `/api` via Vite plugin.
- 2026-10-04 Yuqi — decided JavaScript, B-59 as first story, lean-based AI voting.
- 2026-10-04 Yuqi — design review & plan; added repo collaboration files.
