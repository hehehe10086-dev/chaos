# Handoff — 2026-10-05

> For Yuqi's teammate (and any AI tool or new Claude session helping you).
> Read this file, then `CLAUDE.md` (project rules — if your tool looks for `AGENTS.md`, use `CLAUDE.md`),
> `PROGRESS.md` (status log), and `README.md` (design doc). No chat history is needed.

## 1. The project in one paragraph

**Chaos** is our entry for the Handshake AI Skills Studio Multiplayer Game Challenge. **Deadline: 2026-10-30, 11:59 PM PT** (plan: feature freeze 10/27, submit 10/29). It is a browser multiplayer historical role-play game. Each player takes a role at a turning point in history, with a secret objective. Players type in plain modern language, and an LLM rewrites each line in the voice of the era ("Era Voice"). Empty roles are played by AI, and a human can take over an AI role at any time. Endings are decided by votes and game rules; the LLM only performs. Judges will probably test alone with two devices, so **the game must be fun with only 2 humans**.

Repo (public): https://github.com/hehehe10086-dev/chaos · Live: https://chaos-ten-hazel.vercel.app/

## 2. Current state (checked with `git status` / `git log` on 2026-10-05)

- `main` is at `f3ee4c6 Merge pull request #3 from hehehe10086-dev/feat/m1-sync`. Clean, playable, deployed.
- **Milestone M1 is done and live**: create a room → get a 4-letter code → others join by code or invite link → a shared counter and chat messages stay in sync across devices through polling (about 1.5 s). Each player has a private "secret number" that only they can see. This is a technical sandbox, not the game yet.
- Verified: 10 automated tests pass. Yuqi tested locally (normal + incognito window), with real Redis (rooms survive a dev-server restart), and on the Vercel Preview URL with a laptop and a real phone. After the merge, production `/api/room` creates rooms.
- This handoff is on branch `docs/teammate-handoff` (PR to be merged).
- Leftover: the remote branch `feat/m1-sync` was not deleted after merging. It is safe to delete.
- **On hold:** the story script (`docs/spec.md`). Yuqi wants to discuss it carefully together before anything is written. Do not write it alone.

## 3. What Yuqi did (2026-10-04 → 10-05)

1. **Planned the project**: reviewed the design for risks; chose the state store and LLM approach; set weekly milestones to 10/30. Decisions are recorded in `PROGRESS.md` → "Decisions".
2. **Made three design decisions**: JavaScript (not TypeScript); first story = the B-59 submarine (Cuban Missile Crisis, Oct 1962); AI voting by a rule-based `lean` value (see section 5).
3. **Set up the repo (PR #1)**: `.gitattributes` (LF line endings for Windows/Mac), `CLAUDE.md`, `PROGRESS.md`.
4. **Built the scaffold (PR #2)**: Vite 8 + React 19 + Tailwind 4 + Prettier. One command (`npm run dev`) runs frontend + API.
5. **Created the Vercel project**, connected it to GitHub, and deployed it. `main` auto-deploys to production; every PR gets a Preview URL (see the Vercel limitation in section 6).
6. **Created the Upstash Redis database** through Vercel → Storage (database name `upstash-kv-emerald-car`, region us-east-1, Free plan, no read regions). It is connected to the Production, Preview and Development environments, and Yuqi's local `.env` is configured.
7. **Tested and shipped M1 (PR #3)**:
   - Tested locally with two windows.
   - Found the Redis read bug: writes worked but every read said "Room not found". Yuqi narrowed it down by checking the Upstash data browser; it is now fixed.
   - Re-tested with Redis, including restarting the dev server.
   - Tested the Preview deploy on a laptop and a phone, then merged.

## 4. What is unfinished / what to do next

Nothing is half-written in code. The next work, in priority order:

1. **Merge this handoff PR** (`docs/teammate-handoff`). Yuqi should click Merge — see section 6, merge author.
2. **Story spec discussion (Yuqi + you, together).** Prepare for it: read `README.md` and think about the B-59 roles, secret objectives, rounds, the vote, endings and scoring. Hard requirement: **any 2 seats taken by humans must be in direct conflict**, and AI seats must actively pressure the humans. Bring ideas and questions. Writing `docs/spec.md` comes after the discussion.
3. **`docs/api.md`**, after the spec: every action format and the per-seat view JSON. Also put example views in `shared/fixtures/`, so the frontend can be built against fixtures without waiting for the backend.
4. **Work that does not depend on the spec** — good first tasks for the teammate:
   - **Visual-novel UI shell** with placeholder images: background, character portrait, dialogue box, briefing card, vote panel. Mobile-first, large tap targets. Proposed folders: `src/components/`, `public/assets/{backgrounds,portraits,covers,ui,placeholder}/`.
   - **Art style guide and asset list** in `docs/art-list.md`. All art is generated with GPT, so the style must be consistent: visual-novel / anime style. For each image list its purpose, size/ratio, filename, folder and description.
   - **Rules / how-to-play page** skeleton (`src/pages/Rules.jsx`), so a new player understands the game in 30 seconds.
   - **Cheaper polling**: in `src/hooks/useRoomState.js`, slow polling down to about 10 s when nothing has changed for a while. Upstash Free gives 500K commands per month, and each poll is 1 command.
5. **Era Voice model comparison**: run the same 20 test lines through Claude Haiku 4.5 and Gemini Flash. Blocked until Yuqi decides who pays for the LLM API.

Not started yet (week-2 core loop, after the spec): rounds with a lazy-tick timer + Redis lock, simultaneous reveal, narrator, AI seats with `lean`, vote, ending, secret reveal, objective guessing, scoring, `server/llm/client.js` with mock mode / timeout / fallback, and `stories/b59/story.json`.

## 5. Technical decisions and why

| Decision                                                                                                                                                                                                                                                                      | Why                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No game engine; React + Vite + Tailwind; **JavaScript** (ES modules + JSDoc)                                                                                                                                                                                                  | Text input works badly in engine web builds on phones; the team knows React                                                                                                                                                   |
| Vercel serverless + **polling**, no WebSocket server                                                                                                                                                                                                                          | The contest requires serverless; a round-based game tolerates 1–2 s delay                                                                                                                                                     |
| **Upstash Redis**, not Supabase                                                                                                                                                                                                                                               | Supabase free projects pause after 1 week of inactivity, and judging may happen weeks after the deadline. Upstash Free (checked 2026-10-04): 256 MB, 500K commands/month, 1 database; pay-as-you-go is $0.2 per 100K commands |
| Server is the single source of truth. Players are identified by a random token: the server stores only its hash, and the token goes in the `Authorization` header, never in the URL. Every write is compare-and-set on `version`                                              | Prevents leaking hidden info (e.g. changing a URL parameter to see someone's secret) and prevents race conditions                                                                                                             |
| `server/engine/view.js` is the **only** place that decides what a player sees (allowlist of fields)                                                                                                                                                                           | One place to audit for leaks; a test checks it                                                                                                                                                                                |
| `/api/*.js` are thin Web-standard handlers (`export const GET = route(async (request) => Response)`); logic lives in `server/`                                                                                                                                                | Every file in `api/` becomes a Vercel function                                                                                                                                                                                |
| Local API served by `dev/vite-api-plugin.js`, not `vercel dev`                                                                                                                                                                                                                | `vercel dev` needs a login; this way nobody installs extra tools                                                                                                                                                              |
| **AI voting:** each AI seat has a numeric `lean` set by the rules. Each round, an LLM structured judgment may move it by at most ±1. The vote is a threshold on `lean`                                                                                                        | Persuasion matters, but outcomes stay rule-based and debuggable                                                                                                                                                               |
| No timers on the server; rounds advance by **lazy tick** (a request that sees an expired deadline advances the round, guarded by a Redis lock) — _not built yet_                                                                                                              | Serverless has no long-running process                                                                                                                                                                                        |
| LLM behind one adapter, `server/llm/client.js` — _not built yet_. Candidates: Claude Haiku 4.5 ($1 in / $5 out per 1M tokens) as the main model; maybe Claude Sonnet 5.5 ($2/$10) for narration; compared against Gemini Flash ($0.75/$3.75). About $0.13 per game with Haiku | Era Voice quality affects the Creativity score; cost is small, but runaway cost needs a daily cap                                                                                                                             |
| The narrator prompt contains no secrets; the Era Voice prompt contains only the speaker's own line                                                                                                                                                                            | No spoilers; nothing to leak through prompt injection                                                                                                                                                                         |
| Cut: AI-judged "in-character bonus". Moderation = prompt rules + length/keyword filter only                                                                                                                                                                                   | Time; fairness is hard to explain                                                                                                                                                                                             |
| Proposed split (**not confirmed**): Yuqi = `api/`, `server/`, `tests/`; teammate = `src/`, `public/assets/`; shared via PR review = `shared/`, `stories/`, `docs/spec.md`                                                                                                     | Fewer merge conflicts                                                                                                                                                                                                         |

## 6. Pitfalls / things not to try again

- **Vercel Hobby only deploys commits authored by the account owner (Yuqi).** Pushes from the teammate's branches will probably _not_ get a Preview URL ("Hobby teams do not support collaboration"). Workarounds: test locally, or Yuqi pushes the branch. **Merge PRs with "Create a merge commit"** (the merge commit is authored by whoever clicks Merge — Yuqi). Avoid "Squash and merge": the squashed commit is authored by the PR author, which may block the production deploy. _Unverified in our project_ — first seen in Vercel docs/community on 2026-10-05.
- **`@upstash/redis` with `automaticDeserialization: false` returns `hmget` as a raw array `[v, s]`, not an object.** This caused "Room not found" on every read. Fixed in `server/store/redis.js`; `tests/redis.test.js` guards it.
- **CAS retries must back off.** On real Redis, 20 simultaneous writes with 5 retries gave six 409s (no lost updates). Now 10 retries with exponential backoff + jitter (`server/rooms.js` → `mutateRoom`). `crypto.randomInt` needs integers.
- **`localhost` refuses to connect** = the dev server isn't running. Keep the `npm run dev` terminal open.
- **Two normal tabs in one browser are the same player** (shared localStorage). Use a normal window + an incognito window.
- **The in-memory store** is for local dev only: rooms are lost when the dev server restarts. On Vercel it refuses to run, by design (`server/store/index.js` throws).
- **Unknown `/api/xxx` once returned 200** (Vite SPA fallback). Fixed: the dev plugin returns 404.
- **GitHub auto-fills PR titles from the branch name** (e.g. "Chore/repo setup"). Edit the title before creating the PR. On PR #3, "Merge" was not confirmed at first: check that the PR shows **Merged** (purple).
- The Claude desktop app's Terminal-panel integration fails on Yuqi's machine, so commands are run by hand.
- Does Upstash archive inactive free databases? **Not checked yet.**

## 7. Run and verify locally

```bash
git clone https://github.com/hehehe10086-dev/chaos.git
cd chaos
npm install          # Node 24
npm run dev          # http://localhost:5173 — frontend + /api; phone on same Wi-Fi: use the "Network" URL
npm test             # 10 tests; the Redis test is skipped if .env has no Redis credentials
npm run build
npm run format       # Prettier — run before committing
```

- **Without a `.env`, everything works with the in-memory store.** The terminal prints `[store] No Redis env vars found — using in-memory store`. This is enough for frontend work.
- To use the real database locally, Yuqi must give you `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` **privately** (never in the repo, an issue, or a PR). Put them in `.env`; the variable names are in `.env.example`.
- Manual check: normal window → Create room → incognito window → Join with the code. +1 and messages should sync within 2 s; each side sees only its own secret number; a refresh keeps your identity.

## 8. Task list (priority order)

1. Yuqi: add the teammate as a GitHub collaborator (repo Settings → Collaborators) so they can push branches.
2. Merge the handoff PR; delete the remote branch `feat/m1-sync`.
3. Story spec discussion → `docs/spec.md` (target: this week, W1 ends 10/10).
4. `docs/api.md` + `shared/fixtures/`.
5. Teammate: visual-novel UI shell, `docs/art-list.md`, rules page, cheaper polling (section 4.4).
6. Era Voice model comparison (needs an LLM billing decision).
7. W2 (10/11–10/17): core loop; acceptance = one full game played online in two browsers.
8. W3 (10/18–10/24): taking over an AI seat mid-game + recap; AI stand-in on disconnect; edge cases (refresh, host leaves, room full, final round locked); rules page; visual-novel UI with art; rate limits + daily LLM cap.
9. W4 (10/25–10/30): playtests with new players, polish, freeze 10/27, full re-test on a real phone, title/cover/description, submit 10/29.

## 9. Open questions for Yuqi (and the teammate)

1. Split of work: does the teammate prefer frontend or backend?
2. LLM billing: whose account pays, and is about $3/day as a cap acceptable?
3. B-59 story: roles (a 4th seat?), secret objectives, round structure, endings, scoring — to be decided in the discussion.
4. Vercel Hobby limits collaboration: is "Yuqi merges and deploys" enough, or move the project to the teammate's account / upgrade?

---

**Working with Yuqi** (also in `CLAUDE.md`): Yuqi is new to git. AI tools working with Yuqi should reply in Chinese (technical terms in English), explain each git step briefly, and work in small verified steps: commit after each working piece, and give localhost verification steps. `main` must always be playable: branch → PR → merge. Ask before pushing or other outward actions. Look up prices and limits; don't rely on memory.
