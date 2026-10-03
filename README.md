# Chaos

> Step into history's tipping points. Everything you say is rewritten in the voice of the era.
> Change what happened — or make sure it never changes.

**Status:** 🚧 Design phase — not yet implemented.
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

## Architecture *(planned)*

```
Browser (phone / laptop)
   │  POST /api/action                 join, speak, vote
   │  GET  /api/state?room=…&seat=…    polling, per-seat view
   ▼
Serverless API
   ├─ Game engine: applyAction(state, action) → newState   (pure, deterministic)
   ├─ LLM calls: Era Voice, AI characters, narrator, recaps
   └─ Conditional write (version check)
   ▼
State store (strongly consistent)
```

- **Server is the single source of truth.** Clients only submit actions and render state.
- **Per-seat views.** Hidden information (secret objectives, private clues) is filtered on the server, never just hidden in the UI.
- **Conditional writes.** Every room state has a version number; a write only succeeds if the version hasn't changed, preventing race conditions.
- **Polling.** Round-based play tolerates 1–2 seconds of latency, so no persistent WebSocket server is needed.
- **Stories are data.** Each story is a config file (roles, briefings, secret objectives, decision points, endings, wildcard pool). Adding a story means adding a file, not writing code.
- **LLM API keys live on the server only.**

**Tech stack (tentative):** React + Vite + Tailwind · serverless functions (Vercel) · state store TBD (e.g. Upstash Redis or Supabase) · LLM provider TBD

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
- [ ] Story lobby + room code / invite link
- [ ] Seat model: AI fill-in, human takeover, AI stand-in on disconnect
- [ ] Round-based conversation with Era Voice
- [ ] Decision point, endings, reveal, scoring
- [ ] One complete story, playable end to end on phone and laptop

**P1 — Experience**
- [ ] Multiple rooms per story with automatic assignment
- [ ] Spectator mode
- [ ] AI-suggested lines for mobile
- [ ] 2–3 stories with different player counts

**P2 — Extras**
- [ ] Wildcard seat with hidden roles
- [ ] More stories

---

## Stories

*Coming soon.*

---

## Local Development

*Coming soon.*
