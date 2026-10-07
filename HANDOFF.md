# Handoff

For a new AI tool or session continuing this project. You need no chat history — read, in order:

1. `STATUS.md` — current state, what is verified, next steps (start at "Next steps").
2. `CHAOS_MVP_BRIEF.md` — the spec. Section 0 = how to work: autonomously, log decisions in `DECISIONS.md`,
   commit after each milestone on branch `mvp-caesar`, **don't push** (Yuqi reviews and pushes).
3. `CLAUDE.md` — project rules (architecture rules, commands, conventions). Codex: treat it as `AGENTS.md`.
4. `DECISIONS.md` and `PLAN.md` — why things are the way they are. Don't undo a decision without logging why.

Before changing code: `npm install && npm test` (expect 74 passing) and `npm run build`.
After each change: run both again. Test in the browser with `npm run dev:offline` (or the built app with
`npm run build && npm run start:offline`).
