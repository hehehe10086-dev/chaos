// Applies a finished AI job (from the background worker) to the latest state. Pure.
// Every job re-checks that it is still relevant, because the state may have moved on
// while the LLM was thinking (a human took the role, the decision timed out, ...).

import { applyAgentSpeech, isAi } from './agents.js';
import { fillEndingText, gameTime, resolveDecision } from './game.js';

export function applyTaskResult(state, scenario, task, result, now) {
  if (task.type === 'ending') {
    if (state.phase !== 'ended' || state.game.ending.status !== 'pending') return state;
    const draft = structuredClone(state);
    fillEndingText(draft, scenario, result);
    return draft;
  }

  if (state.phase !== 'playing') return state;
  const draft = structuredClone(state);
  const t = gameTime(draft.game, now);

  if (task.type === 'speak') {
    return applyAgentSpeech(draft, scenario, task, result, t, now) ? draft : state;
  }

  if (task.type === 'decide') {
    const open = draft.game.openDecisions.find((d) => d.id === task.decisionId);
    if (!open || !isAi(draft.game, open.roleId)) return state;
    resolveDecision(draft, scenario, open.id, result.optionId, {
      by: 'ai',
      t,
      now,
      line: result.line,
    });
    return draft;
  }

  return state;
}
