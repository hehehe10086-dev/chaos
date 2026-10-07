# MVP Plan — "The Ides of March" (branch `mvp-caesar`)

Spec: `CHAOS_MVP_BRIEF.md`. Deviations and judgment calls: `DECISIONS.md`.

## Starting point

The repo already has a working, deployed stack (M1 sync sandbox, live on Vercel):
JavaScript (ES modules) · React 19 + Vite 8 + Tailwind 4 · Vercel serverless functions in `api/` ·
Upstash Redis with compare-and-set writes (in-memory store locally) · polling every ~1.5 s ·
anonymous seat tokens · `server/engine/view.js` as the single per-player visibility filter · Vitest.

The brief says to keep an existing stack, so the MVP is built on it (no Socket.IO / Express / TypeScript).

## How a serverless, polling game runs on a timer

- **Game clock** = `(now − startedAt − pausedMs) / (1000 × timeScale)` scenario-seconds.
  The clock pauses while no human is polling (presence is tracked per player in Redis).
- **Lazy tick:** every poll runs a pure `advance(state, now)` that processes everything now due, in time order:
  decision timeouts → acts (variant chosen when the act starts) → events → decisions → end.
  Conditions are evaluated when an item comes due. It is deterministic and has no I/O.
- **AI work** (agent speech, AI decisions, epilogue/death poem, recaps) is slow, so it runs _after_ the poll
  response in a background worker (`waitUntil` on Vercel), one worker per room guarded by a Redis lock.
  Each result is applied with a compare-and-set write that re-checks it is still relevant.
- **Fallbacks everywhere:** every LLM call has an 8 s timeout and a non-LLM fallback; the epilogue has a deadline
  after which the scenario text is used, so the ending can never hang.

## Modules

```
scenarios/ides-of-march.json   all Rome content (roles, facts, acts, events, decisions, endings, comparison)
scenarios/index.js             registry of scenario files
shared/scenarioSchema.js       zod schema + cross-reference checks
shared/conditions.js           { all, any, not, flag+eq, flag+in } evaluator
server/engine/                 pure logic: lobby actions, game timeline, agent scheduling, view filter, seeded RNG
server/llm/                    adapter: anthropic | openai | mock, timeouts, JSON helper with one retry
server/prompts/                all prompt templates
server/ai/                     LLM tasks (rewrite, speak, decide, epilogue, recap, suggest) + background worker
server/rooms.js                load / mutate (CAS) / poll (tick + presence + kick worker)
api/                           thin handlers: room, state, action, health
src/                           React client: lobby, role card, game screen, act card, decision modal, ending card
tests/                         engine, scenario, view (no leaks), LLM adapter, full playthroughs of all 6 endings
```

## Milestones

- **M0** this plan, brief saved, dependencies (zod, Anthropic SDK, @vercel/functions).
- **M1** lobby: create/join, pick role or Random, host starts; chat in lobby and game. _Check:_ two windows chat.
- **M2** scenario JSON + schema, timeline engine, decisions with timeouts, flags, endings, ending card.
  _Check:_ headless playthroughs reach all 6 endings; a no-answer run gives `history_repeats`.
- **M3** LLM layer: rewrite, agents, AI decisions, epilogue, death poem — all with fallbacks; mock by default.
- **M4** UI polish: Roman look, act title card, medallion portraits, decision modal, ending card, mobile.
- **M5** (stretch, in order) mid-game takeover with recap · Tab assist · voice input.
- **Done** README (run / API key / new scenario), STATUS.md, DECISIONS.md, `npm start` for a production-like local run.
