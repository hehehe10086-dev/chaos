# Testing — Chaos: The Ides of March

How to test the game by hand, what to check, and how to report bugs. The automated tests (`npm test`, 74)
cover the rules; this plan covers what only a person on real devices can judge. Tick a box (`- [x]`) when a
check passes and add a note or an issue link when it fails.

## Where to test

| Where                   | How                                                                      | Use it for                                                        |
| ----------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Local, offline          | `npm run dev:offline` → http://localhost:5173                            | everything except real AI and real Redis — free, needs no secrets |
| Local, production build | `npm run build`, then `npm run start:offline` → http://localhost:3000    | a quick check of the built app                                    |
| Vercel Preview          | the link Vercel posts on the pull request (one per pushed branch)        | real Redis, real phones, real AI once the key is in Vercel        |
| Production              | https://chaos-ten-hazel.vercel.app/ (shows `main` — the MVP once merged) | the final checks before submitting                                |

- **Two players on one computer:** a normal window + an incognito window. Two normal tabs share
  `localStorage`, so they count as the same player. Locally, `localhost` in one window and `127.0.0.1` in
  the other also works.
- **A phone on the same Wi-Fi (local):** `http://<your computer's IP>:5173` (find the IP with `ipconfig`).
  Voice input needs HTTPS, so test voice on the Vercel link.
- **A shorter day:** create `.env.offline.local` with `TIME_SCALE=0.3` (a 3-minute day; decision windows
  6–9 s), restart `npm run dev:offline`, and delete the file afterwards. The on-screen clocks then run
  faster than real time — expected. Check timers and "feel" at normal speed.
- **Server logs:** locally, the terminal that runs `npm run dev…`. On Vercel only Yuqi can see them (the
  Hobby plan has no team seats) — send Yuqi the room code and the time.
- The offline store forgets every room when the dev server restarts; on Vercel rooms expire after 24 h.

## 5-minute smoke test (after every deploy or merge)

- [ ] **S1** Incognito window → the URL loads the home page, no error.
- [ ] **S2** Create a room, pick a role, "Start the day" → your role card, then the act card "ACTUS I · DAWN".
- [ ] **S3** Type a line → it appears (rewritten) within a few seconds; an AI character answers within ~20 s.
- [ ] **S4** A second window joins with the room code → sees the same chat and can take over an AI character.
- [ ] **S5** On a phone, open the room → it fits the screen; you can read and type.

## Full test plan

### A. Rooms and lobby

- [ ] **A1 Join by code** — window 1 creates a room, window 2 joins with the 4-letter code → both "In the
      room" lists update within ~2 s; lobby chat works both ways.
- [ ] **A2 Invite link** — "Copy link" in window 1, open it in window 2 → the join form for that room.
- [ ] **A3 Exclusive roles** — both pick the same role → the second sees "… already picked that role".
      "Random role" works.
- [ ] **A4 Host** — only the host sees "Start the day"; the other sees "Waiting for … to start…". Close the
      host's window, wait 30 s → the other player can start.
- [ ] **A5 Full room** — a 6th person joins → "This room is full (5 players)".
- [ ] **A6 Wrong code** on the home page → "Room not found".
- [ ] **A7 Refresh** in the lobby → still in the room, same name, same pick.

### B. The game

- [ ] **B1 Role card** — each player sees only their own secret and goal (check the other window's screen,
      its Cast tab, and D1).
- [ ] **B2 Era voice** — type "ok guys I'm gonna go" → others see a rewritten line; only you can turn on
      "Show what I typed" to see your words. (Offline the rewrite is a crude word swap.)
- [ ] **B3 AI answers** — name a character ("Calpurnia, why are you so pale?") → she answers you (shown as
      "Calpurnia → <your role>") within ~20 s. Say something without a name → usually someone answers.
- [ ] **B4 Acts and clocks** — an act card at each of the 4 acts; "day ends in" counts down from 10:00; the
      act countdown restarts with each act.
- [ ] **B5 Decisions** — play Caesar; at "day ends in 5:30" only Caesar gets the red "YOU MUST DECIDE"
      modal, the others see "Caesar must decide · 0:2x". After a choice everyone sees the narration line. Let
      a later decision run out → history's choice is applied.
- [ ] **B6 Branches** — "Stay home", then "Stay with Calpurnia" → acts III/IV are "The Visitor" / "The
      Locked Door" and the ending is "The Man Who Stayed Home".
- [ ] **B7 Ending** — both windows show the same ending, "History vs your timeline" (changed rows marked),
      "Every secret, revealed" and "The choices that made this day". "Play again" starts a new game with
      the same roles in both windows.
- [ ] **B8 Refresh mid-game** → same role, the game goes on, the role card does not pop up again.
- [ ] **B9 Everyone away** — hide every window for 30 s → the clock pauses (time left barely moved).
- [ ] **B10 Spam** — send lines very fast → "Slow down a little".

### C. Newest features (takeover, Tab assist, voice)

- [ ] **C1 Take over** — start a game in window 1; join from window 2 after the start → "Join the story"
      (on a phone: the JOIN tab, or "Take over a character" under the input). Take over an AI character →
      the "You take over" card with "Previously…", secret and goal. Window 1 shows that character as HUMAN
      and "… takes over …" in the chat; its AI stops talking; window 2 now gets its decisions.
- [ ] **C2 Take-over limits** — a character in the middle of a decision shows "Deciding…" (disabled). Two
      late joiners click the same character at once → one gets it, the other sees "… already plays …".
- [ ] **C3 Tab assist** — click into the input, press Tab → "Ideas for your next line" with 3 lines; ↓ then
      Enter says the highlighted line exactly as shown; clicking a line works too. Type "please stay home
      today", press Tab → "Ways to say …"; say one; "Show what I typed" shows your words. Esc closes; after
      Esc, Tab moves on to the next button. Click "Ideas" three times quickly (open, close, open) → "Slow down
      a little".
- [ ] **C4 Ideas on a phone** — tap "Ideas" → the 3 lines fit above the input; tap one to say it.
- [ ] **C5 Voice, desktop** (Chrome or Edge, on localhost or an https link) — "Speak" → allow the microphone
      → your words appear while you talk, listening stops by itself → Enter sends them (rewritten). Firefox
      shows no "Speak" button. A blocked microphone shows a clear message.
- [ ] **C6 Voice, phones** (Vercel https link) — Android Chrome and iPhone Safari.

### D. Hidden information and cheating

- [ ] **D1 No leaks** — in window 2, DevTools → Network → open a `state?code=…` response. It must not
      contain window 1's secret text, `traits`, `tokenHash`, someone else's original (pre-rewrite) words, or
      an "Only you know" line meant for another role.
- [ ] **D2 No moves out of turn** — in window 2 (not Caesar), paste the snippet below into DevTools →
      Console (with your room code) → `{ error: "This decision is not yours to make" }` while Caesar's
      decision is open ("That decision is already over" otherwise). Nothing changes on screen.

```js
const code = 'ABCD'; // your room code
const { token } = JSON.parse(localStorage.getItem(`chaos:session:${code}`));
await fetch('/api/action', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    code,
    action: { type: 'decide', decisionId: 'go_to_senate', optionId: 'stay' },
  }),
}).then((r) => r.json());
```

### E. Phones and layout

- [ ] **E1 375 px wide** (DevTools device toolbar, or a real phone): home, lobby, game (Story / Cast / Your
      role), act card, role card, decision, ending — no sideways scrolling, nothing cut off, buttons easy to
      tap.
- [ ] **E2 Phone keyboard** — the input stays visible while typing; "Send" is reachable.
- [ ] **E3 Rotate the phone** → still usable.
- [ ] **E4 Reduce motion** turned on in the phone / OS settings → cards appear without animation.

### F. Real AI (needs the API key — on the Vercel links once Yuqi has added it)

Play at least two full games and keep the transcripts ("Read the transcript" on the ending screen). You can
also test locally with your own key: `.env` with `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=…`, then
`npm run dev` (not `dev:offline`, which forces the mock). Real calls cost money.

- [ ] **F1 Era voice** — keeps your meaning, at most 2 sentences, period style, no modern slang; rude input
      comes out toned down.
- [ ] **F2 AI characters** — stay in character and pursue their goals; never say they are an AI; never act out
      big events in chat (no stabbing); never reveal a secret their character could not know.
- [ ] **F3 AI decisions** feel plausible; the epilogue mentions things that were actually said.
- [ ] **F4 Recap and Tab assist** — the takeover recap is accurate; suggested lines are in character.
- [ ] **F5 Speed** — your rewritten line usually appears within ~3 s (after 8 s the original is used).
- [ ] **F6 Cost** — Anthropic console → Usage after a game (estimate $0.3–0.6 per game); tell Yuqi if much higher.
- [ ] **F7 Fallbacks** (free, local) — `.env` with `LLM_PROVIDER=anthropic` and
      `ANTHROPIC_API_KEY=not-a-real-key`, run `npm run dev` → the game still plays (your own words, scripted
      AI lines, history's choices, the story's own epilogue); the terminal shows `[ai] … failed, using
fallback`.

To tune: the prompts are in `server/prompts/`. Change one thing at a time, replay, compare transcripts, and
log the change in `DECISIONS.md`.

### G. Deployment

- [ ] **G1** Incognito window → the production URL loads.
- [ ] **G2** A laptop and a real phone play one full game on the production URL → same ending on both.
- [ ] **G3** AI characters speak on Vercel (the background worker runs there). If they never do, tell Yuqi (logs).
- [ ] **G4** (Yuqi) Upstash console: commands used per game (free tier: 500K per month).

### H. Before submitting (the contest checklist)

- [ ] Two different devices can join and finish a whole game.
- [ ] A new player gets it without explanation — give a friend who has never seen the game only the link,
      watch without helping, and note where they get stuck.
- [ ] The public link opens in an incognito window.
- [ ] On a phone the text is readable and the buttons are easy to tap.
- [ ] Title, cover image and description are ready (`docs/submission.md`).
- [ ] Submitted before 10/30 11:59 PM PT (target: 10/29).

## Reporting a bug

One bug per GitHub issue (repo → Issues → New issue):

> **When I did** [what, in which window / device / browser], **I expected** [what should happen], **but
> instead** [what happened].
> Room code and time · URL (local / Preview / production) · device and browser · a screenshot, and any red
> errors from DevTools → Console.

Fix one bug at a time and keep the change small. If the bug is in the server or engine, add a test under
`tests/` that fails before the fix. Re-test after the fix.

## Test log

| Date       | Who    | Where (commit / URL)             | Checks                                                                                                                                                                               | Result                                          |
| ---------- | ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| 2026-10-06 | Claude | local, `mvp-caesar` at `d6f19c6` | Automated: 74 tests (incl. A3–A5, B5–B7, C1–C3, D1–D2 at the API level). Browser: A1, A2, B1–B4, B5 (decider's side), B7, C1–C5 (voice with a fake microphone), E1 (375 px emulated) | pass — see STATUS.md "Verified vs not verified" |
