# Status — branch `mvp-caesar` (2026-10-08)

Spec: `CHAOS_MVP_BRIEF.md` · Plan: `PLAN.md` · Judgment calls: `DECISIONS.md` · Rules for AIs: `CLAUDE.md`
· **Who does what next, and the plan to the deadline: `HANDOFF.md`** · Test plan: `TESTING.md`

> 2026-10-08: development and testing are handed to a classmate; Yuqi keeps the repo, Vercel, keys and
> the submission. `mvp-caesar` is pushed to GitHub; the pull request into `main` is not merged yet.

## Summary

The MVP "The Ides of March" is **playable end to end on the mock LLM**: lobby → role card → 4 acts with
title cards → timed decisions → ending card with "History vs your timeline". All three M5 stretch goals are
built: **mid-game takeover** with a recap, **Tab assist** (suggested lines / intention in era voice) and
**voice input**. Built on the repo's existing stack (JavaScript, React/Vite/Tailwind, Vercel serverless
`api/`, Upstash Redis, polling) — see `DECISIONS.md`. **74 automated tests pass**, including full headless
playthroughs that reach all 6 endings. The one big unknown: **no real LLM has been called yet** (no API key).

## Milestones

|                    | State                                   | Evidence                                                                                                                                                                                                         |
| ------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 plan            | ✅ done                                 | `PLAN.md`, `DECISIONS.md`, `CHAOS_MVP_BRIEF.md`; commit `fb91363`                                                                                                                                                |
| M1 rooms & chat    | ✅ done, verified                       | Browser: two players on two origins joined one room, picked roles, chatted. `tests/game.test.js`                                                                                                                 |
| M2 scenario engine | ✅ done, verified                       | `tests/endings.test.js`: all 6 endings + "nobody answers → history_repeats" + act variants; solo all-AI game                                                                                                     |
| M3 LLM layer       | 🟡 code done; **real LLM never called** | Mock path fully exercised. Adapter, JSON retry, timeout, daily cap, fallbacks, OpenAI request shape tested with fakes (`tests/llm.test.js`). Model names checked against the providers' docs 2026-10-06          |
| M4 UI polish       | ✅ done, verified                       | Browser at desktop and 375×812: every screen, no horizontal overflow (DOM check); fixed lobby overflow, composer focus/placeholder, role-card height. `prefers-reduced-motion` rule checked in the built CSS     |
| M5 takeover        | ✅ done, verified                       | `tests/takeover.test.js` (9). Browser: a late joiner on another origin took over Antony (desktop) and Calpurnia (375 px); the other player's view showed both, no recap/secret leaked                            |
| M5 Tab assist      | ✅ done, verified                       | `tests/assist.test.js` (8). Browser: Tab, ↓+Enter, mouse click, intention → "Ways to say…", Esc then Tab leaves the box, phone layout                                                                            |
| M5 voice           | ✅ done, verified with a fake mic       | `tests/speech.test.js` (4). Browser: a fake recognizer injected into the page — listening state, words stream in, Enter sends through the era voice, blocked-mic message. **Never tried with a real microphone** |
| Done criteria      | ✅                                      | README (run / API key / new scenario); `npm run build && npm start` on real Redis (smoke test) and `npm run start:offline` (full solo game, then a takeover + Tab assist on the final build)                     |

## Verified vs not verified

**Verified today (2026-10-06):**

- `npm install`, `npm test` (74 pass), `npm run build`, `npm run dev:offline`, `npm start` (real Upstash,
  smoke test: create, start, AI lines arrive), `npm run start:offline` (full solo game → "The Scroll", Play
  again; later takeover + Tab assist on the final build).
- Phone width (375×812) for home, lobby, game tabs, act card, role card, decision modal, ending, takeover
  panel and recap card, Tab-assist popover, composer toolbar.
- Two players on two origins (`localhost` + `127.0.0.1`), including a takeover by a late joiner.

**Not verified:**

- Any real LLM call (Anthropic or OpenAI): era-voice rewrite, AI lines, decisions, epilogue, recap and
  suggestion prompts are only tested with the mock and with fake providers.
- Voice input with a real microphone, and on a real phone (iOS Safari / Android Chrome).
- Vercel: JSON import attributes in functions, `waitUntil` keeping the worker alive, the new actions.
- A real phone on the real URL (all phone checks were browser emulation).

## How to run

```bash
npm install
npm run dev:offline   # http://localhost:5173 — in-memory store + mock LLM, safest for testing
npm run dev           # same, but uses Upstash Redis (and a real LLM) from .env if configured
npm test              # 74 tests (redis.test.js hits real Upstash only if .env has credentials)
npm run build && npm start   # production-like server on http://localhost:3000 (uses .env: real Redis)
npm run start:offline        # the same build, in-memory store + mock LLM
```

- A faster day for testing: put `TIME_SCALE=0.2` in `.env.offline.local` (gitignored; read by `dev:offline`
  and `start:offline`) → a 2-minute game. Delete it afterwards. At 0.2 a decision window is only 4–6 s.
- Solo play: create a room, pick a role (or Random), "Start the day". Every other role is AI.
- Second player on the same computer: an incognito window, or another origin (`127.0.0.1` vs `localhost`) —
  two normal tabs share localStorage and count as the same player.
- Takeover: start a game in one window, then join the same room from the second window → "Join the story".

## What works

- **Lobby:** create room (4-letter code, no I/O), join by code or invite link, pick a role or Random
  (exclusive picks), host starts; if the host is away > 20 s anyone can start; max 5 humans; lobby chat.
- **Game:** private role card (secret, goal, known facts, how to talk); shared chat; narrator lines
  centered/italic, private ones marked "Only you know"; carved-stone act card with 起承转合 seal (~3 s);
  act + day countdowns; cast list with coin portraits and Human/AI badges; decision modal with countdown —
  timeout = historical option; "X must decide" banner for others; phone layout with Story / Cast / role tabs.
- **Era voice:** player text → `rewriteLine` (fast model; mock = word swap); original shown only to the
  sender via "Show what I typed".
- **Takeover (M5):** someone who joins after the start sees "Join the story" (JOIN tab on phones) and can
  take any AI character that is not deciding; the role card opens with "Previously…" + secret + goal
  (fast model; fallback = act + last two narrator lines + the card). "Play again" keeps the role.
- **Tab assist (M5):** Tab (or "Ideas") → three in-character lines; with text typed → three ways to say
  it in era voice. ↑↓/Tab choose, Enter or click says it — instantly, exactly as shown. 3 s cooldown,
  30 per player per game.
- **Voice (M5):** "Speak" (where the browser has the Web Speech API) fills the box; you send it like text.
- **AI characters:** scheduled by `server/engine/agents.js` (addressed by name, events that concern them,
  at least once per act, a reply when a solo human speaks); per-agent gap 20–30 s (12 s when a human
  addressed them), global gap 8 s, ≤ 90 lines/game; produced by the background worker.
- **Ending:** highest-priority matching ending; AI epilogue + death poem (fallback after 12 s); comparison
  table; every secret revealed; choices list; "Play again"; transcript.
- **Robustness:** compare-and-set writes with backoff; clock pauses when nobody polls for 10 s; every LLM
  call 8 s timeout + fallback; daily LLM cap; anti-spam; views never leak secrets/traits/tokens/recaps/
  suggestions (tested); `npm start` survives malformed URLs.

## Code map

```
scenarios/ides-of-march.json  all story content      scenarios/index.js  registry (one import per scenario)
shared/scenarioSchema.js      zod schema + reference checks      shared/conditions.js  {all,any,not,eq,in}
server/scenarios.js           load + validate + sorted timeline
server/engine/                pure logic: applyAction (lobby/game actions incl. takeover, suggest), game
                              (timeline, decisions, endings, pause), agents (when AI speaks), aiResults,
                              view (visibility allowlist), state, random
server/ai/                    tasks (rewrite, agentLine, aiDecision, endingText, takeoverRecap, suggestLines
                              — all with fallbacks), worker (background, Redis lock), mockStyle, text
server/llm/                   index (provider choice, timeout, JSON retry, daily cap), anthropic, openai
server/prompts/               rewrite, agent, epilogue, traits, recap (takeover), suggest (Tab assist)
server/rooms.js               create / join / poll / act; PREPARE = LLM work before the write (say,
                              takeover, suggest); lazy tick, presence, kick worker
server/roomData.js            loadRoom, authenticate, mutateRoom (CAS)   server/store/  memory | redis
api/                          room, state, action, health (thin)
dev/                          api-dispatch (shared), vite-api-plugin (dev, offline mode), serve.js (npm start)
src/                          pages: Home, Room, Lobby, Game, Ending · components: Medallion, ActCard,
                              RoleCard, DecisionModal, Chat (MessageList, Composer + Tab assist + voice),
                              TakeoverPanel, CharacterList, RulesDialog, ui · hooks · lib/speech.js
tests/                        setup (memory + mock), harness (fake clock, full playthroughs), *.test.js
```

## Known issues / limitations

- **Mock mode feels scripted:** AI lines cycle through 8 `sampleLines` per role; the mock era voice is a
  crude word swap; the mock takeover recap repeats the role's original goal even when the day has moved
  on. A real API key fixes all three.
- Real-LLM prompts (`server/prompts/`) are untested against a real model; tune after the first real game.
- OpenAI defaults (`gpt-6-luna`, `gpt-6.1-sol`) were checked against OpenAI's docs but never called.
- With a real LLM the sender waits up to 8 s for a rewrite ("The scribe is writing…"); Tab assist and a
  takeover recap also wait up to 8 s.
- A human who leaves mid-game: their character goes silent and their decisions time out to history
  (the design's "AI stand-in on disconnect" is not built). A sixth person is refused.
- The act card only shows if you load the page within 6 s of an act starting.
- Voice: Chrome sends audio to an online recognition service (browser feature); on a phone it needs the
  HTTPS URL (an `http://` LAN address is not a secure context, so the mic is refused).
- The landing page (`src/pages/Home.jsx`) describes The Ides of March; there is no story picker yet.
- Polling cost: ~1.5 Redis commands per poll per player. A 10-minute game ≈ 600–900 commands per human;
  Upstash Free = 500K/month.
- No TypeScript type-check (Yuqi chose JavaScript); `vite build` + tests are the checks.

## Next steps

The dated plan to the deadline is in `HANDOFF.md`, section 3. In short: push and open the PR → test the
Vercel Preview on a laptop and a real phone (`TESTING.md`) → merge → add the API key in Vercel and playtest
with real AI, tuning the prompts → playtest with someone new → feature freeze 10/27 → submit 10/29.
Optional if time allows: AI stand-in on disconnect; a short hint for first-time spectators; a second story
with a story picker.

## Needs Yuqi (owner-only — details in `HANDOFF.md`, section 1)

1. ~~Push the branch~~ (done 2026-10-08). Open the PR `mvp-caesar → main` — or let the classmate do it.
2. **Invite the classmate** as a collaborator on GitHub.
3. **Vercel** (Hobby plan: no team seats): share Preview links with the classmate; read logs on request.
4. **Anthropic API key** with a monthly spend limit → Vercel env vars `LLM_PROVIDER=anthropic` +
   `ANTHROPIC_API_KEY` (Production + Preview) → redeploy. Estimate: roughly $0.3–0.6 per 10-minute game.
   Locally, the old `.env` line `LLM_MODE=mock` does nothing — use `LLM_PROVIDER`.
5. Submit on Handshake (`docs/submission.md`). Optional: delete the old remote branches
   `docs/teammate-handoff` and `feat/m1-sync`.

## Pitfalls for whoever continues

- `advance()` must return the **same object** when nothing changed — that is what keeps polls from writing.
- Pending AI jobs are re-checked when applied (`server/engine/aiResults.js`); keep that when adding jobs.
- LLM work that must happen before a write goes in `PREPARE` (`server/rooms.js`): load → `advance()` →
  check (fail fast) → LLM → return a server-built action; the engine re-checks everything.
- `cleanText` is for what players type (≤ 200 chars, throws); `cleanLine` is for server-written speech.
- `@upstash/redis` with `automaticDeserialization: false` returns raw arrays (HGETALL = flat array).
- Claude Sonnet 5.5: no `temperature`; thinking tokens count toward `max_tokens`; Haiku 4.5 rejects `effort` —
  `server/llm/anthropic.js` handles all three. OpenAI: every gpt-5-or-later model gets `reasoning_effort`.
- Browser testing in the Claude app: a background tab does not poll (`document.hidden`), so read another
  player's state with `fetch('/api/state…')`; under phone emulation, click coordinates can be off — check
  with `document.elementFromPoint` or use `form_input`. The "offline" launch config runs on port 5174.
