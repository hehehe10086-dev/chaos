# Chaos

> Step into history's tipping points. Everything you say is rewritten in the voice of the era.
> Change what happened — or make sure it never changes.

**Status:** ✅ Playable MVP — **_The Ides of March_** (Rome, 44 BC): 1–5 players, the AI plays every empty role, about 10 minutes, on phones and laptops. Runs fully offline with a built-in mock AI; add an API key for real AI characters ([how](#add-an-api-key-real-ai)).
Built for the **Handshake AI Skills Studio Multiplayer Game Challenge** (deadline: Oct 30, 2026).

---

## What is Chaos?

Chaos is a browser-based multiplayer role-playing game. Each story drops players into a moment where history could have gone either way — a single conversation, a single decision, a single accident that changed everything.

Every player takes a role, receives private information and a **secret objective**, and has a few rounds of conversation to steer the outcome.

**The twist:** you type in plain, modern language, and the game rewrites every line into the voice of the era — a royal court, a 1940s front line, a Cold War command room. You control *what* you mean, but not exactly *how* it sounds.

You can play with friends, with strangers, or alone. **Any empty role is played by AI**, and a real player can take over an AI role at any time.

No login. No install. Works on phones and laptops.

---

## Core Ideas

| Idea | What it means |
|---|---|
| **Era Voice** | Every message is rewritten by an LLM into period speech before anyone else sees it. |
| **Never wait for players** | Empty roles are filled by AI characters. A human can join mid-game and take over an AI role. |
| **Secret objectives** | Everyone has something to hide or achieve, so every line of conversation has stakes. |
| **AI performs, rules decide** | The LLM handles voice, narration, and AI characters. Endings and win conditions are decided by explicit votes and game state — never by the LLM. |

---

## How a Game Plays

1. **Pick a story** from the lobby — or join friends with a room code / invite link.
2. **Get your role.** A briefing card tells you who you are, what is happening, what only you know, and your secret objective.
3. **Talk in rounds.** Each round, every role says one line before the timer runs out. Lines are rewritten in Era Voice and revealed at the same time. The narrator then advances the story with a new event.
4. **Make the call.** At the key decision point, choices are made by secret vote or action buttons — not by chat.
5. **Ending & reveal.** The game state determines which ending happens. The narrator tells it, all secret objectives are revealed, and scores are shown.

Target session length: **10–15 minutes**.

> **In the MVP** the conversation is free-flowing rather than strict rounds: a Director fires historical events on a 10-minute clock across four acts, and at decision points one character must choose (only they see the options; if time runs out, history chooses). The ending compares **History** with **Your timeline**.
>
> Also built: **join late** and take over any AI character, with a three-line recap of what you missed · **press Tab** (or tap *Ideas*) for three in-character lines — or type what you mean ("I want to stall him") and get three ways to say it in period voice · **speak instead of typing** where the browser supports it.

### Era Voice example

| You type | Royal court | 1940s front line |
|---|---|---|
| "I'm starving. Is there anything to eat?" | *"Pray, my stomach doth wage a most ungracious war — is there naught upon this table to appease it?"* | *"Sarge, rations ran dry two days back. Anything left in that crate?"* |

---

## Players & Seats

Every role in a story is a **seat**. A seat is always in one of three states:

| Seat state | When it happens | What others see |
|---|---|---|
| 🤖 **AI** | No human has taken the role | An AI badge next to the role name |
| 👤 **Human** | A player joins and picks the role | "🎭 *The Queen* is now played by a human" |
| 🤖⏸ **AI stand-in** | The human disconnects or misses the round timer | "*The Queen* is temporarily played by AI" — the human reclaims the seat on return |

**Rules for joining and leaving**

- **Join mid-game:** take over an AI seat and read a short AI-generated recap ("Previously…") plus your briefing card before playing.
- **Disconnect or timeout:** the AI stands in so the game never stalls.
- **Final round locked:** once the decisive vote begins, newcomers can only spectate.
- **Spectators:** see the public conversation; all secrets are revealed at the ending.
- **Wildcard seat** *(planned)*: when an extra human joins a full story, they can enter as a hidden wildcard role, randomly drawn from a pre-written pool for that story, with its own secret objective. The other players only learn that "someone else seems to be here…"

---

## Lobby

- The lobby shows **stories**, not rooms. Each story card has a cover image, player count, a one-line pitch, and a **Play now** button.
- **Automatic room assignment:** players are placed in a room that already has humans and an open AI seat; otherwise a new room is created with AI filling the other roles.
- **Popular stories scale automatically** — multiple rooms of the same story can run at once.
- **Private rooms:** every room has a 4-letter code and an invite link for playing with friends.
- Rooms with no humans **pause or close** — AI characters never play to an empty room.

---

## Scoring *(draft — finalized per story)*

| Action | Points |
|---|---|
| Complete your secret objective | ✔ |
| Correctly guess another player's secret objective | ✔ |
| In-character bonus (AI-judged, small weight) | ✔ |

The in-character bonus is the only AI-judged score. Endings and objectives are resolved by game state and votes.

---

## Design Principles

- **AI performs, rules decide.** Predictable, fair outcomes; easy to debug; resistant to prompt injection.
- **30-second onboarding.** One briefing card, one clear goal, one action per round.
- **Fun with a single human.** AI fills every empty seat.
- **Mobile-first.** Short messages, 2–3 AI-suggested lines per round, large tap targets.
- **Never stall.** Timeouts, AI stand-ins, and fallbacks keep every room moving.

---

## Architecture

```
Browser (phone / laptop)
   │  POST /api/room      create / join → a secret player token (the server keeps only its hash)
   │  POST /api/action    pick a role, start, speak, decide, take over, suggest lines, play again
   │  GET  /api/state     polling (~1.5 s) → this player's view, filtered on the server
   ▼
Vercel serverless functions (api/*.js are thin; logic lives in server/)
   ├─ Engine (pure): applyAction(state, action), advance(state, now) — "lazy tick", no server timers
   ├─ AI worker: character lines, AI decisions, epilogue — runs after the response (waitUntil + Redis lock)
   └─ Compare-and-set write on `version`
   ▼
Upstash Redis — one hash per room (in-memory store when developing locally)
```

- **Server is the single source of truth.** Clients only submit actions and render state.
- **Per-seat views.** Hidden information (secret objectives, private clues) is filtered on the server, never just hidden in the UI.
- **Conditional writes.** Every room state has a version number; a write only succeeds if the version hasn't changed, preventing race conditions.
- **Polling.** Round-based play tolerates 1–2 seconds of latency, so no persistent WebSocket server is needed.
- **Stories are data.** Each story is a config file (roles, briefings, secret objectives, decision points, endings, wildcard pool). Adding a story means adding a file, not writing code.
- **LLM API keys live on the server only.**

**Tech stack:** React 19 + Vite + Tailwind 4 · Vercel serverless functions · Upstash Redis (polling + compare-and-set) · Anthropic Claude or OpenAI behind one adapter, with a deterministic mock for offline play · zod-validated story files · Vitest

---

## Safety & Cost Controls

- **Rate limits** per player and per room, plus a daily usage cap.
- **No humans, no AI:** rooms without human players pause, so the LLM is never called for an empty room.
- **Content moderation** on player input; system prompts constrain all AI output, and sensitive historical themes are handled with care.
- **Prompt-injection resistant:** player text is treated as content only, and outcomes are never decided by the LLM.
- **Fallback:** if an LLM call fails or times out, the original message is sent so the conversation never freezes.

---

## Roadmap

**P0 — Core (must ship)**
- [x] Room code / invite link *(a lobby that lists several stories comes with the second story)*
- [ ] Seat model: AI fill-in ✅, human takeover ✅ *(with a recap)*, AI stand-in on disconnect
- [x] Conversation with Era Voice *(free-flowing on a clock rather than strict rounds)*
- [x] Decision points, endings, reveal *(no scoring yet)*
- [x] One complete story, playable end to end on phone and laptop

**P1 — Experience**
- [ ] Multiple rooms per story with automatic assignment
- [x] Spectator mode *(people who join after the start watch the game)*
- [x] AI-suggested lines for mobile *(Tab or "Ideas"; also voice input)*
- [ ] 2–3 stories with different player counts

**P2 — Extras**
- [ ] Wildcard seat with hidden roles
- [ ] More stories

---

## Stories

### The Ides of March — Rome, 15 March 44 BC

> *You know how it ends. Change it.*

Julius Caesar will attend the Senate today; some of the men he trusts most have knives under their togas. Five roles — **Caesar, Brutus, Cassius, Calpurnia, Mark Antony** — each with a secret and a goal. Four acts (起 承 转 合), five decision points, six endings, from *History Repeats* to *The Scroll*. Every AI character gets a random personality each game, so the same morning goes differently every time.

All of it lives in one data file: [`scenarios/ides-of-march.json`](scenarios/ides-of-march.json).

---

## Local Development

### Run locally

Requirements: **Node 24** (see `package.json` → `engines`).

```bash
npm install
npm run dev:offline
```

Open http://localhost:5173. `dev:offline` uses an in-memory store and the mock AI — no Redis, no API key, no cost.

| Command | What it does |
|---|---|
| `npm run dev` | Same as above, but uses Upstash Redis and a real LLM when `.env` configures them |
| `npm test` | Vitest — games run on the in-memory store and the mock AI (full playthroughs reach all 6 endings); `tests/redis.test.js` also checks the real Upstash connection when `.env` has credentials |
| `npm run build` then `npm start` | Production-like server on http://localhost:3000 (`npm run start:offline`: no Redis, mock AI) |
| `npm run format` | Prettier |

Tips:

- **Two players on one computer:** use a normal window and an incognito window. Two normal tabs share `localStorage`, so they count as the same player.
- **Phone on the same Wi-Fi:** the dev server listens on your LAN — open `http://<your computer's IP>:5173` on the phone.
- **A faster day for testing:** create `.env.offline.local` (gitignored) with `TIME_SCALE=0.2` → the 10-minute day takes 2 minutes. Delete it afterwards.
- **Upstash Redis:** set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env` (see `.env.example`). On Vercel the Upstash integration provides them. Without them, local runs use the in-memory store.
- **Manual test plan** (what to check on real devices, how to report a bug): [`TESTING.md`](TESTING.md).

### Add an API key (real AI)

Without a key the game is fully playable on the **mock AI**: characters say scripted in-character lines and the "era voice" is a simple word swap. With a key, the AI characters improvise from their secrets, goals and personalities, and every line you type is rewritten in the voice of the era.

1. Create an API key — **Anthropic** (recommended, https://console.anthropic.com) or OpenAI — and set a **monthly spend limit** in that console.
2. **Locally:** copy `.env.example` to `.env` and set:
   ```bash
   LLM_PROVIDER=anthropic
   ANTHROPIC_API_KEY=your-key-here
   ```
   (or `LLM_PROVIDER=openai` and `OPENAI_API_KEY=…`). Restart `npm run dev`.
3. **On Vercel:** Project → Settings → Environment Variables → add the same two variables for **Production** and **Preview**, then redeploy.

Never commit `.env` or put a key in frontend code — this repository is public. If `LLM_PROVIDER` is unset or its key is missing, the game falls back to the mock AI.

| `LLM_PROVIDER` | Fast model — era voice, suggestions, recaps | Smart model — AI characters, decisions, epilogue |
|---|---|---|
| `anthropic` | `claude-haiku-4-5-20251001` | `claude-sonnet-5-5` |
| `openai` | `gpt-6-luna` | `gpt-6.1-sol` |

Override with `MODEL_FAST` / `MODEL_SMART`. Model names were checked against the providers' docs on 2026-10-06; the OpenAI path has not been tried with a real key yet (the previous OpenAI generation, `gpt-5.4-nano` / `gpt-5.4-mini`, is still available if you prefer it).

**Cost and safety:** with the Anthropic defaults, a 10-minute game costs roughly **$0.3–0.6** (an estimate — mostly the AI characters' lines, at most 90 per game). `LLM_DAILY_CAP` (default 3000 calls per day, across all rooms) protects the public URL. Every AI call has an 8-second timeout and a non-AI fallback — scripted lines, the historical choice, the story's own epilogue — so the game never stalls waiting for a model.

### Add a new scenario

The engine knows nothing about Rome: a story is one JSON file.

1. Copy `scenarios/ides-of-march.json` to `scenarios/<your-story>.json` and edit it: `meta` (title, intro, `speechStyle` for the era voice, `durationSeconds`), `roles` (secret, goal, personality ranges, sample lines), `facts`, `acts`, `events`, `decisions`, `endings`, `historyComparison`. Times are seconds from the start of the day.
2. Register it in `scenarios/index.js` — one `import` line, and add it to `scenarioFiles`. There is no story picker yet: to play it, point `DEFAULT_SCENARIO_ID` at its `meta.id`.
3. Run `npm test`. Every scenario is validated when it loads (`shared/scenarioSchema.js`, zod plus cross-reference checks: unknown roles, flags, facts or options, a missing default ending, events after the end …); the error lists exactly what is wrong.

No engine code changes are needed. (The landing page, `src/pages/Home.jsx`, still describes The Ides of March.)
