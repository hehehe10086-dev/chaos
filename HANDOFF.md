# Handoff — 2026-10-08

From now on a classmate does the development and the testing. **Yuqi stays the owner** of the GitHub repo,
the Vercel project, the API keys and the contest submission.
Deadline: **10/30 11:59 PM PT** · feature freeze 10/27 · submit 10/29.

What to read: `STATUS.md` (what works, what is verified, known issues) · `TESTING.md` (the test plan) ·
`CLAUDE.md` (rules — read before changing code) · `DECISIONS.md` (why things are the way they are) ·
`docs/submission.md` (title, description, cover image).

## 1. Yuqi first — owner-only steps (about 15 minutes)

The classmate cannot do these:

1. **Push the branch.** Every MVP commit is still only on Yuqi's laptop:
   `git push -u origin mvp-caesar`. Vercel then builds a Preview of the branch. Opening the pull request
   `mvp-caesar → main` on GitHub (the push prints a link) can be left to the classmate.
2. **Invite the classmate on GitHub:** repo `hehehe10086-dev/chaos` → Settings → Collaborators → Add
   people (their GitHub username).
3. **Vercel stays with Yuqi** (the free Hobby plan has no team seats). If a Preview link asks the classmate
   to log in, use the deployment's **Share** button ("Anyone with the link"), or turn off Vercel
   Authentication for previews (Settings → Deployment Protection). When the classmate reports a server
   problem, Yuqi reads the function logs.
4. **API key for real AI** (the game also works without it, on the scripted mock): create an Anthropic key
   with a **monthly spend limit**, then Vercel → Settings → Environment Variables: `LLM_PROVIDER=anthropic`
   and `ANTHROPIC_API_KEY=…` for Production and Preview → redeploy. Never paste the key into a chat or
   commit it. (In Yuqi's local `.env`, the old line `LLM_MODE=mock` does nothing — replace it with
   `LLM_PROVIDER=…` when running locally with a key.)
5. Later: submit on Handshake (`docs/submission.md`). Optional cleanup: delete the old remote branches
   `docs/teammate-handoff` and `feat/m1-sync`.

## 2. Classmate — day one

```bash
git clone https://github.com/hehehe10086-dev/chaos.git
cd chaos
git switch mvp-caesar
npm install
npm test
npm run dev:offline
```

1. Node **24** is required. `npm test` should report 74 passing tests.
2. Open http://localhost:5173 and play one solo game as Calpurnia (no decisions) and one as Caesar (several
   decisions, about 4:30 into the day). A second player on the same computer = an incognito window.
3. Read `STATUS.md` and `CLAUDE.md` (about 20 minutes).
4. Before your first commit, set `git config user.name` / `user.email` to your GitHub name and email, so
   GitHub (and Vercel) can match your commits to you.

You need **no secrets**: `dev:offline` uses an in-memory store and a scripted mock AI. Don't ask for the Redis
token or the API key — real Redis and real AI are tested on the Vercel links.

## 3. The plan

| By       | What                                                                                                  | Who                                |
| -------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------- |
| now      | Section 1: push, invite, Vercel sharing, API key                                                      | Yuqi                               |
| 10/10    | Local testing: `TESTING.md` A–E; file bugs as GitHub issues                                           | classmate                          |
| 10/12    | Open the PR; test its Vercel Preview on a laptop and a real phone (S, A–E, C5–C6); merge → production | classmate (Yuqi reviews if around) |
| 10/18    | Real-AI playtests (F), prompt tuning, bug fixes                                                       | classmate                          |
| 10/24    | Playtest with someone who has never seen the game (H); polish                                         | classmate                          |
| 10/27    | **Feature freeze.** Title, description, cover image (`docs/submission.md`)                            | classmate drafts, Yuqi approves    |
| 10/28–29 | Final checks on production (G, H), then submit                                                        | classmate tests, Yuqi submits      |

Only if everything above is on track: AI stand-in when a human disconnects (their character goes silent
today); a short hint for first-time spectators; a second story with a story picker on the home page.

## 4. Working rules

- Never commit `.env` or any key — the repository is public.
- One branch per change, pull request into `main`. `npm test` and `npm run build` must pass, and the Preview
  must be tested before merging: `main` must always be playable (it is what the public URL shows).
- Before changing server code, read the architecture rules in `CLAUDE.md`: the server is the source of
  truth, hidden information is filtered only in `server/engine/view.js`, every write is a compare-and-set,
  the LLM never decides anything, every LLM call has a fallback.
- One line in `DECISIONS.md` per judgment call, a dated line in `PROGRESS.md` per work session; keep
  `STATUS.md` true.
- Bugs go to GitHub issues, with the template in `TESTING.md`.

## 5. With an AI coding tool (Claude Code, Codex, …)

Start it with:

> Read STATUS.md, HANDOFF.md, CLAUDE.md (project rules — for Codex treat it as AGENTS.md) and DECISIONS.md
> before anything else. Keep the existing stack: JavaScript, React + Vite + Tailwind, Vercel functions in
> `api/`, Upstash Redis, polling. Run `npm test` (74 passing) and `npm run build` before and after every
> change; test in the browser with `npm run dev:offline`. Never commit `.env` or keys, never push without
> asking me, log judgment calls in DECISIONS.md. The task: …

The original spec is `CHAOS_MVP_BRIEF.md`; how it was built is in `PLAN.md`.
