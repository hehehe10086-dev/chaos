# Chaos — MVP Build Brief

**Scenario #1: "The Ides of March" (Rome, 44 BC)**

> Saved verbatim from Yuqi's message on 2026-10-06. This is the spec for branch `mvp-caesar`.
> Where the build deviates (e.g. keeping the existing JavaScript + Vercel serverless stack), see `DECISIONS.md`.

---

## 0. How to work (read this first)

Yuqi (the owner) is busy today and will not be watching. Work autonomously from start to finish.

- **Do not ask questions.** When something is ambiguous, pick the simplest reasonable option, log it in `DECISIONS.md` (one line: decision + why), and keep going.
- **Never block on secrets.** If an API key is missing, use the built-in mock LLM so everything still runs. List anything Yuqi must do by hand in `STATUS.md` under "Needs Yuqi".
- **Inspect the repo first.** If code already exists, build on it and keep its stack and conventions. Don't delete or rewrite working code without a clear reason (log it). If the repo is empty, use the default stack below.
- **Git:** create branch `mvp-caesar`. Commit after each milestone with clear messages. Never force-push, never rewrite history, and don't push to the remote (Yuqi will review and push). Never commit `.env` or keys.
- **Scope discipline:** finish milestones in order. A rough end-to-end playable game beats a polished half-game. Don't start stretch goals until M1–M4 pass their checks. No accounts, no auth, no database.
- **Verify, don't assume:** after each milestone run the build, the type-check and the tests. The final check is an automated full playthrough of every ending (see M2).
- **When done**, write `STATUS.md`: what works, how to run it, known issues, suggested next steps, and "Needs Yuqi".

---

## 1. The game in one paragraph

Chaos is a multiplayer, chat-based historical role-play game. Players take roles in a famous historical moment, and AI agents play every role no human picked. Each AI character gets randomized personality traits, so the same history unfolds differently every game. Players type plainly; the server rewrites their lines into era-style speech. A Director system fires fixed historical events on a timer ("history is fixed, people are not") and asks key characters to make decisions. After about 10 minutes the game ends with an ending card comparing **History** with **Your timeline**.

Tagline: **"You know how it ends. Change it."**

Audience: English-speaking (US) players. All in-game text is English.

---

## 2. Default stack (use the existing stack instead if the repo already has one)

- TypeScript everywhere. npm workspaces: `client/`, `server/`, `shared/` (shared types, including the scenario schema).
- Client: React + Vite + Tailwind.
- Server: Node + Express + Socket.IO. All game state in memory.
- Production: `npm run build && npm start` — the server serves the built client, so it deploys as one service.
- Dev: `npm run dev` runs client and server with hot reload.
- Tests: Vitest.

---

## 3. LLM layer

- One adapter interface: `complete(system, messages, opts) → text`, plus a JSON helper that validates output and retries once.
- Provider chosen by env `LLM_PROVIDER = anthropic | openai | mock`. If unset, or the matching key is missing → `mock`.
- Env vars: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MODEL_FAST` (speech rewriting, suggestions), `MODEL_SMART` (agents, decisions, epilogue).
  - Anthropic defaults: `MODEL_FAST=claude-haiku-4-5-20251001`, `MODEL_SMART=claude-sonnet-5-5`.
  - OpenAI: choose sensible current defaults and document them in the README.
- The **mock provider** returns deterministic, in-character canned output (a simple style transform for rewrites, persona-weighted choices for decisions, fixed text for epilogues) so the whole game and all tests run offline.
- Every LLM call has a timeout (~8 s), a small max-token limit, and a **non-LLM fallback**:
  - rewrite fails → send the original text
  - decision fails → historical default option
  - epilogue / death poem fails → text from the scenario file
- The game must never hang waiting on the LLM.
- Keep all prompt templates in `server/src/prompts/`.
- Provide `.env.example`.

---

## 4. Data-driven scenario engine

The engine must know nothing about Rome. Everything scenario-specific lives in `scenarios/ides-of-march.json`, validated at load time (zod) against a schema in `shared/`. Adding a new scenario later (e.g. Japan or China) should mean adding one JSON file, not changing engine code.

Schema concepts (rename fields if you like, keep the concepts):

| Key | Contents |
|---|---|
| `meta` | id, title, tagline, intro, durationSeconds, speechStyle (instructions for the era rewrite) |
| `roles[]` | id, name, publicIdentity, secret, goal, portraitKey, traitRanges (min/max per trait), knows[] (fact ids), historicalDefaults |
| `facts[]` | id, text — private knowledge given to the roles listed in `knows` |
| `acts[]` | id, number, mark (起 / 承 / 转 / 合), title, startAt (s), poem (2 lines), optional `variants[]` with condition + title + poem |
| `events[]` | id, at (s), text, visibility (`"all"` or role ids), optional condition, optional setsFlags |
| `decisions[]` | id, at (s), role, prompt, options[{id, label, narration, setsFlags}], timeoutSeconds, historicalOptionId, optional condition |
| `endings[]` | id, priority, title, condition, fallbackEpilogue, optional fallbackDeathPoem, setsFlags |
| `historyComparison[]` | question, flag, historyValue, display labels |

Conditions use a tiny, testable format, e.g. `{ "all": [ { "flag": "caesarWent", "eq": true }, { "flag": "plotExposed", "eq": false } ] }` with `all`, `any`, `not`, `eq`, `in`.

**Personality traits** (each 1–5, randomized per game within the role's `traitRanges`): `intelligence`, `loyalty`, `ambition`, `lovestruck`, `obedience`. The agent prompt must translate levels into behavior, for example:

- low intelligence: takes words at face value, misses hints, trusts easily
- high intelligence: notices contradictions, uses known secrets strategically
- high obedience: follows orders literally even when circumstances change
- high lovestruck: decisions bend toward the person they love

Global env `TIME_SCALE` (default `1`; tests use e.g. `0.02`) multiplies every timing.

---

## 5. Features (MVP)

### Lobby
- Create room → short room code. Others join with code + display name.
- Each player picks a role or "Random". Host clicks Start. Every unfilled role becomes AI.
- **Solo play must work** (1 human + 4 AI). This is the main demo path.

### Role card (private, shown at start)
Name, public identity, secret, goal. Never show trait numbers to players.

### Game screen
- One shared chat (all speech is public in the MVP).
- Narrator / Director messages styled clearly differently from character speech; private narrator lines visible only to their target roles.
- **Act title card:** full-screen overlay for ~3 seconds at each act start, showing act number, the mark (起 / 承 / 转 / 合), title and the 2-line poem.
- Countdown for the current act; character list with portrait, name and a Human / AI badge.
- Side panel: "Your secret" and "Your goal".
- **Decision modal** for the deciding player: prompt, option buttons, countdown. If time runs out, the historical option is chosen. After resolution, everyone sees the option's narration line.
- Decisions are made **only** at decision points. Never infer decisions or flags by parsing chat.

### Speech rewriting
- Player types plain text → server rewrites it in character, following `meta.speechStyle` and the speaker's role → broadcast.
- Rewrite rules: keep the meaning; never add new facts, decisions or actions; at most 2 sentences; readable to a modern player.
- The sender can toggle "Show what I typed". If the rewrite fails, send the original.

### AI characters
- Each AI role is an agent with: role card, randomized traits, known facts, recent transcript (last ~30 messages), current act, goal.
- It speaks when addressed by name or role, after Director events that concern it, and at least once per act.
- Rate limit ~1 message per 20–30 s per agent plus a global cap so the chat stays readable; add a small random delay so it feels human.
- Output strict JSON: `{ "speech": "...", "to": "roleId | all" }`. Speech is already in era style.
- AI decisions: persona + goal + transcript + options → `{ "optionId": "...", "line": "..." }`. Mock: persona-weighted random.

### Director
- Runs the timeline: acts (with variants), events, decisions, conditional branches by flags.
- Each event posts a narrator message.

### Ending
- At the end, choose the highest-priority ending whose condition matches.
- Ending card shows:
  - title
  - epilogue (AI-written from the transcript, 3–4 sentences; fallback from JSON)
  - death poem if Caesar died (AI, 2 lines; fallback from JSON)
  - **"History vs Your timeline"** table from `historyComparison`
  - "Play again" button (new random traits)

### Content rules
PG-13 historical political drama. Violence is described, never dwelt on; no gore. The rewrite step tones down hateful or out-of-scope input instead of amplifying it. AI agents always stay in character.

---

## 6. Scenario content: "The Ides of March"

Use this as the content of `scenarios/ides-of-march.json`. Timings are in seconds at `TIME_SCALE=1` (total 600 s).

### meta
- **title:** The Ides of March
- **tagline:** You know how it ends. Change it.
- **intro:** "Rome, 15 March, 44 BC. Julius Caesar, dictator for life, will attend the Senate today. Some of the men he trusts most have hidden knives under their togas. History has already written this day. You have not."
- **speechStyle:** "Elevated, Shakespeare-inspired English with Roman color (the gods, the Senate, Rome, honor). Dramatic but readable to a modern player. Use 'thou/thee' sparingly at most. Never modern slang."

### roles

| id | name | public identity | secret | goal | trait ranges |
|---|---|---|---|---|---|
| `caesar` | Julius Caesar | Dictator of Rome for life. | You have heard whispers of a plot, but showing fear before the Senate would make you look weak. | Appear at the Senate today and leave with even more power. | ambition 4–5, intelligence 2–5, loyalty 2–4, lovestruck 1–4, obedience 1–2 |
| `brutus` | Marcus Brutus | A respected senator. Caesar treats you almost like a son. | You are at the heart of the conspiracy. Rumor says Caesar may truly be your father. | Save the Republic — or stop the knives at the last moment. | intelligence 3–5, loyalty 2–5, ambition 1–3, lovestruck 2–4, obedience 2–4 |
| `cassius` | Gaius Cassius | A senator and veteran soldier. | You organized the conspiracy. Without Brutus's name, it falls apart. | Caesar must die today, and Brutus must strike. | ambition 4–5, intelligence 3–5, loyalty 1–3, lovestruck 1–2, obedience 1–2 |
| `calpurnia` | Calpurnia | Caesar's wife. | Last night you dreamed you held Caesar's bloodied body in your arms. | Keep Caesar home today. | lovestruck 4–5, loyalty 4–5, intelligence 2–5, ambition 1–2, obedience 2–4 |
| `antony` | Mark Antony | Caesar's right hand and consul. | You sense something is wrong, but you have no proof. | Keep Caesar alive. | loyalty 4–5, intelligence 2–4, ambition 2–4, lovestruck 1–3, obedience 2–5 |

Brutus's agent prompt should carry his core tension: *"Not that I loved Caesar less, but that I loved Rome more."*

### facts (private knowledge)
- `plot` — "Several senators will strike Caesar with hidden knives when the Senate meets in the Theatre of Pompey." → known by `brutus`, `cassius`
- `dream` — "Calpurnia dreamed she held Caesar's bloodied body." → known by `calpurnia`
- `whispers` — "There are vague rumors of a plot against Caesar; no names." → known by `caesar`

### acts

| # | mark | title | startAt | poem | variant (condition → title / poem) |
|---|---|---|---|---|---|
| 1 | 起 | Dawn | 0 | A dream of blood at dawn. / The sun rises anyway. | — |
| 2 | 承 | The House | 120 | She holds his sleeve. / Rome holds his name. | — |
| 3 | 转 | The Road | 300 | A note in his hand. / The crowd presses closer. | `caesarWent = false` → **The Visitor** / A friend at the door. / A smile with no warmth. |
| 4 | 合 | The Senate | 480 | The doors close softly. / Marble does not choose sides. | `caesarWent = false` → **The Locked Door** / The house is quiet. / The knives are patient. |

### flags (initial values)
`caesarWent=false`, `caesarStayedFirm=false`, `readNote=false`, `antonyPresent=false`, `brutusChoice=null`, `plotExposed=false`, `caesarAlive=true`

### timeline: events and decisions

| at | type | id / who | text or prompt | condition |
|---|---|---|---|---|
| 0 | event (all) | `nightmare` | Before dawn, Calpurnia wakes screaming from a nightmare. | — |
| 0 | event (calpurnia) | `nightmare_private` | In your dream, Caesar lay bleeding in your arms. | — |
| 30 | event (brutus, cassius) | `knives_ready` | The knives are hidden. The others will be waiting at the Theatre of Pompey. | — |
| 90 | event (all) | `soothsayer` | In the street, a soothsayer cries out: "Beware the Ides of March." | — |
| 210 | event (all) | `messenger` | A messenger arrives: the Senate is waiting for Caesar. | — |
| 270 | **decision** (caesar) | `go_to_senate` | The Senate is waiting. Will you go? — timeout 30, historical: `go` | — |
| 310 | event (all) | `decimus` | Decimus, a friend Caesar trusts, arrives at the house: "Shall the Senate say Caesar stays home because of his wife's dreams?" | `caesarWent = false` |
| 330 | **decision** (caesar) | `second_chance` | Decimus is waiting. Go after all? — timeout 25, historical: `go_after_all` | `caesarWent = false` |
| 380 | event (all) | `artemidorus` | On the way, a Greek scholar named Artemidorus pushes a small scroll into Caesar's hand: "Read this alone, and quickly." | `caesarWent = true` |
| 390 | **decision** (caesar) | `read_note` | A scroll is in your hand and the crowd is pressing in. Read it now? — timeout 20, historical: `later` | `caesarWent = true` |
| 420 | event (all) | `antony_drawn_aside` | At the Senate steps, a senator takes Antony by the arm and draws him aside to talk. | `caesarWent = true` |
| 430 | **decision** (antony) | `antony_stays` | A senator wants a word with you, away from Caesar. — timeout 20, historical: `follow` | `caesarWent = true` |
| 490 | event (all) | `doors_close` | The Senate doors close. Senators crowd around Caesar with a petition. Casca's hand moves beneath his toga. | `caesarWent = true` and `plotExposed = false` |
| 490 | event (all) | `names` | Caesar unrolls the scroll. Names. Familiar names. He looks up at the men around him. | `readNote = true` |
| 490 | event (all) | `quiet_house` | The house is quiet. Outside, Cassius waits for news that will not come. | `caesarStayedFirm = true` |
| 500 | **decision** (brutus) | `brutus_choice` | The knives are out. Caesar's eyes find yours. — timeout 20, historical: `strike` | `caesarWent = true` and `plotExposed = false` |
| 600 | end | — | — | — |

### decision options

| decision | option id | label | narration (shown to all) | sets |
|---|---|---|---|---|
| `go_to_senate` | `go` | Go to the Senate | Caesar laughs off the dream and calls for his litter. | `caesarWent=true` |
| `go_to_senate` | `stay` | Stay home | Caesar sends word that he is unwell and will not come today. | — |
| `second_chance` | `go_after_all` | Go after all | Stung by the word "fear", Caesar calls for his litter after all. | `caesarWent=true` |
| `second_chance` | `stay_firm` | Stay with Calpurnia | Caesar sends Decimus away and stays with his wife. | `caesarStayedFirm=true` |
| `read_note` | `read` | Read it now | Caesar steps out of the crowd and unrolls the scroll. | `readNote=true`, `plotExposed=true` |
| `read_note` | `later` | Read it later | Caesar tucks the scroll among his papers, unread. | — |
| `antony_stays` | `follow` | Go with the senator | Antony lets himself be led away, deep in conversation. | `antonyPresent=false` |
| `antony_stays` | `stay` | Stay at Caesar's side | Antony shakes off the senator's hand and stays at Caesar's side. | `antonyPresent=true` |
| `brutus_choice` | `strike` | Strike | Brutus draws his knife. | `brutusChoice="strike"` |
| `brutus_choice` | `warn` | Warn Caesar | Brutus shouts: "Caesar — the knives!" | `brutusChoice="warn"`, `plotExposed=true` |
| `brutus_choice` | `hesitate` | Do nothing | Brutus's hand does not move. | `brutusChoice="hesitate"` |

Note: if Caesar goes after all at 330, the road events at 380–430 still fire because their condition is checked when they come due.

### endings (highest priority first)

| priority | id | title | condition | fallback epilogue | sets |
|---|---|---|---|---|---|
| 1 | `the_scroll` | The Scroll | `readNote = true` | Caesar read the names in time. By nightfall the conspirators were in chains, and the Republic's last defenders were branded traitors. Caesar lived — and ruled with a hand that grew heavier every year. | `caesarAlive=true` |
| 2 | `betrayer_betrayed` | The Betrayer Betrayed | `brutusChoice = "warn"` | At the last moment Brutus cried out a warning. The plot collapsed. Caesar lived; Brutus was spared — and hated by both sides for the rest of his life. | `caesarAlive=true` |
| 3 | `stayed_home` | The Man Who Stayed Home | `caesarStayedFirm = true` | Caesar listened to his wife. The Ides passed quietly. Somewhere in Rome, Cassius began planning a second day. | `caesarAlive=true` |
| 4 | `antonys_blade` | Antony's Blade | `antonyPresent = true` and `brutusChoice in ["strike","hesitate"]` | Antony was at Caesar's side when the knives came out. Caesar survived, badly wounded. Rome fell into civil war a year early. | `caesarAlive=true` |
| 5 | `history_almost` | History Repeats (Almost) | `brutusChoice = "hesitate"` | Brutus never raised his knife. Caesar died anyway, with twenty-three wounds. History will still remember Brutus as his murderer. | `caesarAlive=false` |
| 6 | `history_repeats` | History Repeats | default | Caesar fell at the foot of Pompey's statue with twenty-three wounds. "You too, my child?" The Republic did not survive its saving. | `caesarAlive=false` |

Fallback death poem (endings 5 and 6): *"I crossed the Rubicon. / I could not cross this room."*

### historyComparison

| question | flag | history |
|---|---|---|
| Did Caesar go to the Senate? | `caesarWent` | Yes |
| Did Caesar read the warning? | `readNote` | No |
| Was Antony at his side? | `antonyPresent` | No |
| What did Brutus do? | `brutusChoice` | Struck |
| Did Caesar survive? | `caesarAlive` | No |

---

## 7. Art and visual direction

- **No AI-generated images in the MVP.** Portraits are SVG medallions in the style of Roman coins, showing the character's initial.
- Optional, only if network access works: download public-domain paintings from Wikimedia Commons (e.g. Jean-Léon Gérôme, *The Death of Caesar*, 1867) for the intro and ending screens, and record title, artist, source URL and license in `CREDITS.md`. If a license is unclear, skip it.
- **Subject:** a Roman political thriller on one morning. Materials: marble, bronze, wax tablets, imperial purple, dried blood.
- **Palette:** porphyry purple, aged bronze, marble white, stone-dark ink, plus one blood-red accent reserved for danger (decision modals, the ending). Avoid generic cream-and-terracotta and neon-on-black looks.
- **Type:** a Roman-inscription display face for titles and act cards (e.g. Cinzel) and a highly readable serif for chat (e.g. EB Garamond or Cormorant Garamond), loaded from Google Fonts with fallbacks.
- **One memorable moment:** the act title card — a carved-stone inscription with the mark (起 / 承 / 转 / 合) as a small seal stamp. Keep everything else quiet and disciplined.
- **This is a reading game:** comfortable line length in chat, clear speaker names, narrator lines centered and italic.
- Responsive down to mobile width, visible keyboard focus, respects `prefers-reduced-motion`.

---

## 8. Milestones

**M0 — Explore and plan (short).** Inspect the repo, write a brief `PLAN.md` (no approval needed), set up the workspace.

**M1 — Rooms and chat.** Create / join / pick role / start; chat broadcast; no AI yet.
*Check:* two browser tabs can join one room and chat.

**M2 — Scenario engine on the mock LLM.** JSON + schema validation, timeline, acts and variants, events, decisions with timeouts and defaults, flags, endings, ending card.
*Check:* a headless test runs complete games at a tiny `TIME_SCALE`, forcing decision choices to reach **every one of the 6 endings**, and asserts the correct ending each time. Also one run where nobody answers any decision → `history_repeats`.

**M3 — Real LLM.** Rewriting, AI agents, AI decisions, epilogue, death poem, all with timeouts and fallbacks.
*Check:* game fully playable on mock. If a real key exists in `.env`, also play one game with it; if not, note it in `STATUS.md`.

**M4 — UI polish.** Act cards, narrator styling, portraits, decision modal, ending card, responsive layout.
*Check:* build passes; a solo game is playable end to end.

**M5 — Stretch goals, in this order, only after M1–M4 pass:**
1. **Mid-game takeover:** a new player joins an in-progress room and takes over an AI role. They get a 3-line recap: what has happened, their secret, their goal (AI summary with a simple fallback).
2. **Tab assist:** pressing Tab in the input shows 3 short in-character suggested lines; click or Enter to send. The player can also type an intention ("I want to stall him") and get it phrased in era style.
3. **Voice input:** browser Web Speech API where supported, feeding the same rewrite pipeline.

---

## 9. Definition of done

- `npm install`, `npm run dev`, `npm test`, and `npm run build && npm start` all work.
- Solo game with **zero API keys**: lobby → role card → 4 acts → decisions → ending card, about 10 minutes at `TIME_SCALE=1`.
- Tests cover all 6 endings and pass.
- `README.md`: how to run, how to add an API key, how to add a new scenario.
- `STATUS.md` and `DECISIONS.md` written; work committed on branch `mvp-caesar`.
