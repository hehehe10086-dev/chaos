# Status — branch `mvp-caesar` (2026-10-06)

Spec: `CHAOS_MVP_BRIEF.md` · Plan: `PLAN.md` · Judgment calls: `DECISIONS.md` · Rules for AIs: `CLAUDE.md`

## Summary

The MVP "The Ides of March" is **playable end to end on the mock LLM**: lobby → role card → 4 acts with
title cards → timed decisions → ending card with "History vs your timeline". Built on the repo's existing
stack (JavaScript, React/Vite/Tailwind, Vercel serverless `api/`, Upstash Redis, polling), not the brief's
default stack — see `DECISIONS.md`. **48 automated tests pass**, including full headless playthroughs that
reach all 6 endings. Not yet done: README update, a check of `npm start`, a mobile pass, real-LLM testing
(no API key available), and the M5 stretch goals.

## Milestones

|                    | State                                   | Evidence                                                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M0 plan            | ✅ done                                 | `PLAN.md`, `DECISIONS.md`, `CHAOS_MVP_BRIEF.md`; commit `fb91363`                                                                                                                                                                                                  |
| M1 rooms & chat    | ✅ done, verified                       | Browser: two players on two origins (`localhost:5174` + `127.0.0.1:5174`) joined one room, picked roles (sync shown), chatted. `tests/game.test.js` lobby tests                                                                                                    |
| M2 scenario engine | ✅ done, verified                       | `tests/endings.test.js`: all 6 endings + "nobody answers → history_repeats" + act variants + late departure; solo all-AI game. Also 40 random seeds × full solo games: all ended with an epilogue                                                                  |
| M3 LLM layer       | 🟡 code done; **real LLM never called** | Mock path fully exercised. Adapter, JSON retry, timeout, daily cap and fallbacks tested with a fake provider (`tests/llm.test.js`). No `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` in `.env`, so no real game was played                                                |
| M4 UI polish       | 🟡 mostly done                          | Seen in the browser (desktop width): home, lobby, role card, game screen, decision modal, ending card. **Not checked yet:** act title card screenshot, phone width (375 px), `prefers-reduced-motion`, the last two tweaks (home cast row, buttons no longer wrap) |
| M5 stretch         | ⬜ not started                          | takeover / Tab assist / voice                                                                                                                                                                                                                                      |
| Done criteria      | 🟡                                      | README not updated; `npm run build && npm start` not run yet                                                                                                                                                                                                       |

## How to run

```bash
npm install
npm run dev:offline   # http://localhost:5173 — in-memory store + mock LLM, safest for testing
npm run dev           # same, but uses Upstash Redis from .env if configured
npm test              # 48 tests (redis.test.js hits real Upstash only if .env has credentials)
npm run build && npm start   # production-like server on http://localhost:3000 (NOT yet verified)
```

- A faster day for testing: put `TIME_SCALE=0.2` in `.env.offline.local` (gitignored) → a 2-minute game.
  Delete it afterwards. At 0.2 a decision window is only 4–6 s.
- Solo play: create a room, pick a role (or Random), "Start the day". Every other role is AI.
- Second player on the same computer: use an incognito window, or another origin (`127.0.0.1` vs `localhost`) —
  two normal tabs share localStorage and count as the same player.

## What works

- **Lobby:** create room (4-letter code, no I/O), join by code or invite link, pick a role or Random
  (exclusive picks), host starts; if the host is away > 20 s anyone can start; max 5 humans; lobby chat.
- **Game:** private role card (secret, goal, known facts); shared chat; narrator lines centered/italic,
  private ones marked "Only you know"; act divider + full-screen carved-stone act card with 起承转合 seal
  (~3 s); act countdown + day countdown; cast list with coin portrait and Human/AI badge; secret/goal panel;
  decision modal (blood-red) with countdown — timeout = historical option; "X must decide" banner for others.
- **Era voice:** player text → `rewriteLine` (LLM fast model; mock = word swap from `meta.mockStyle`);
  original shown only to the sender via "Show what I typed".
- **AI characters:** scheduled by `server/engine/agents.js` (addressed by name/alias, events that concern
  them, at least once per act, ambient reply so a solo human is never ignored); per-agent gap 20–30 s
  (12 s when a human addressed them), global gap 8 s, ≤ 90 lines/game. Lines/decisions/epilogue are produced
  by the background worker; mock = scripted `sampleLines` + persona-weighted decisions (`aiBias`).
- **Ending:** highest-priority matching ending; AI epilogue + death poem (fallback text after 12 s);
  comparison table with changed rows; every secret revealed; choices list; "Play again" (same seats,
  new traits); transcript toggle.
- **Robustness:** compare-and-set writes with backoff; clock pauses when nobody polls for 10 s; every LLM call
  8 s timeout + fallback; daily LLM cap; anti-spam cooldown; views never leak secrets/traits/tokens (tested).

## Code map

```
scenarios/ides-of-march.json  all story content      scenarios/index.js  registry (one import per scenario)
shared/scenarioSchema.js      zod schema + reference checks      shared/conditions.js  {all,any,not,eq,in}
server/scenarios.js           load + validate + sorted timeline
server/engine/                pure logic: applyAction (lobby/game actions), game (timeline, decisions, endings,
                              pause), agents (when AI speaks), aiResults, view (visibility), state, random
server/ai/                    tasks (rewrite, agentLine, aiDecision, endingText — all with fallbacks),
                              worker (background, Redis lock), mockStyle, text
server/llm/                   index (provider choice, timeout, JSON retry, daily cap), anthropic, openai
server/prompts/               rewrite, agent (persona + transcript + decision), epilogue, traits
server/rooms.js               create / join / poll / act (lazy tick, presence, kick worker)
server/roomData.js            loadRoom, authenticate, mutateRoom (CAS)   server/store/  memory | redis
api/                          room, state, action, health (thin)
dev/                          api-dispatch (shared), vite-api-plugin (dev, offline mode), serve.js (npm start)
src/                          pages: Home, Room, Lobby, Game, Ending · components: Medallion, ActCard,
                              RoleCard, DecisionModal, Chat, CharacterList, RulesDialog, ui · hooks
tests/                        setup (memory + mock), harness (fake clock, full playthroughs), *.test.js
```

## Known issues / limitations

- **Mock mode feels scripted:** AI lines cycle through 8 `sampleLines` per role, sometimes prefixed with a
  name ("Antony, …"). The mock rewrite is a crude word swap ("Hark friends, …"). A real API key fixes both.
- Real-LLM prompts (`server/prompts/`) are untested against a real model; tune after the first real game.
- OpenAI default model names (`gpt-5.4-nano`, `gpt-5.4-mini`) are unverified — sources disagreed.
- With a real LLM the sender waits up to 8 s for the rewrite before the line appears ("The scribe is writing…").
- People who join after the start are spectators (M5 "takeover" is not built). A sixth person is refused.
- The act card only shows if you load the page within 6 s of an act starting.
- Polling cost: ~1.5 Redis commands per poll per player (1 HGETALL + throttled presence + occasional writes).
  A 10-minute game ≈ 600–900 commands per human; Upstash Free = 500K/month.
- No TypeScript type-check (Yuqi chose JavaScript); `vite build` + tests are the checks.
- Not verified on Vercel yet: JSON import attributes in functions, `waitUntil` keeping the worker alive.

## Next steps (in order)

1. `npm run build && npm start` → open http://localhost:3000, play a solo game; fix `dev/serve.js` if needed.
2. M4 checks: phone width 375 px for home / lobby / game (tabs Story-Cast-Your role) / ending; act card
   look; reduced motion; home cast row; buttons no longer wrap. Fix what's off.
3. README.md: update "Status", add "Run locally", "Add an API key" (LLM_PROVIDER + key, Vercel env vars),
   "Add a new scenario" (copy the JSON, register it in `scenarios/index.js`, run `npm test`), OpenAI defaults.
4. Commit (milestone M3/M4), then M5 in order:
   - **Takeover:** action `takeover {roleId}` (playing, role is AI, no open decision for it, player has no
     role) → set `game.roles[roleId].playerId`, clear that agent's `pending`; 3-line recap (what happened /
     secret / goal) via an LLM task with a fallback, like `prepareSay` in `server/rooms.js`; add to
     `CLIENT_ACTIONS` in `api/action.js`; spectator panel in `src/pages/Game.jsx` gets "Take over" buttons; tests.
   - **Tab assist:** Tab in the composer → 3 short in-character lines (fast model, mock = sample lines);
     typed intention ("I want to stall him") → phrased in era voice; click/Enter sends.
   - **Voice:** Web Speech API in `Composer` (feature-detect), feeding the same send path.
5. With a real key (after Yuqi adds one): play one full game, read the transcript, tune prompts.

## Needs Yuqi

1. **Review and push** this branch: `git push -u origin mvp-caesar`, open a PR on GitHub, test the Vercel
   Preview on a laptop + phone, then merge.
2. **Real AI (recommended for judging):** create an Anthropic API key, set a monthly spend limit in the
   console, then add `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=…` to the local `.env` **and** to Vercel →
   Settings → Environment Variables (Production + Preview), and redeploy. Never paste the key into chat.
   Cost estimate with Haiku 4.5 + Sonnet 5.5: roughly $0.3–0.5 per 10-minute game.
3. Delete the obsolete remote branches `docs/teammate-handoff` and `feat/m1-sync`.
4. A `npm run dev` started earlier may still be running on port 5173 (it uses the real Redis); stop it
   with Ctrl+C when not needed.

## Pitfalls for whoever continues

- `advance()` must return the **same object** when nothing changed — that is what keeps polls from writing.
- Pending AI jobs are re-checked when applied (`server/engine/aiResults.js`); keep that when adding jobs.
- `@upstash/redis` with `automaticDeserialization: false` returns raw arrays (HGETALL = flat array).
- Claude Sonnet 5.5: no `temperature`; thinking tokens count toward `max_tokens`; Haiku 4.5 rejects `effort` —
  `server/llm/anthropic.js` handles all three.
- Browser testing in the Claude app: screenshots time out when the window is hidden — use `get_page_text` /
  `find`. The "offline" launch config runs on port 5174 because 5173 may be taken.
