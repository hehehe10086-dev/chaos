// Background AI worker for one room. Polls trigger it (after their response is sent, via
// waitUntil on Vercel); a Redis lock makes sure only one runs per room. It does one AI job
// at a time — character line, AI decision, or ending text — and writes each result with a
// compare-and-set update that re-checks the job is still relevant.

import { readyTask } from '../engine/agents.js';
import { applyTaskResult } from '../engine/aiResults.js';
import { advance, gameTime } from '../engine/game.js';
import { latestPresence, loadRoom, mutateRoom } from '../roomData.js';
import { getScenario } from '../scenarios.js';
import { getStore } from '../store/index.js';
import { agentLine, aiDecision, endingText } from './tasks.js';

const LOCK_TTL_MS = 30_000;
const BUDGET_MS = 20_000; // stop starting new jobs after this; the next poll starts a new worker
const MAX_JOBS = 20;

function perform(state, scenario, task, now) {
  if (task.type === 'speak') return agentLine(state, scenario, task, now);
  if (task.type === 'decide') return aiDecision(state, scenario, task, now);
  return endingText(state, scenario);
}

/**
 * @param {string} code
 * @param {{clock?: () => number, budgetMs?: number}} [options]  clock is injectable for tests
 * @returns {Promise<'busy' | 'idle' | 'budget' | 'gone'>}
 */
export async function runWorker(code, { clock = Date.now, budgetMs = BUDGET_MS } = {}) {
  const store = getStore();
  const lock = `worker:${code}`;
  const token = await store.lock(lock, LOCK_TTL_MS);
  if (!token) return 'busy';
  const startedAt = Date.now();
  try {
    for (let jobs = 0; jobs < MAX_JOBS; jobs++) {
      if (Date.now() - startedAt > budgetMs) return 'budget';
      let room;
      try {
        room = await loadRoom(code);
      } catch {
        return 'gone';
      }
      const scenario = getScenario(room.state.scenarioId);
      const now = clock();
      const presenceAt = latestPresence(room.presence);
      const state = advance(room.state, scenario, now, presenceAt);
      const task = readyTask(state, state.game ? gameTime(state.game, now) : 0);
      if (!task) return 'idle';

      const result = await perform(state, scenario, task, now);
      await mutateRoom(code, (latest, r) => {
        const at = clock();
        const fresh = advance(latest, scenario, at, latestPresence(r.presence));
        return applyTaskResult(fresh, scenario, task, result, at);
      });
    }
    return 'budget';
  } catch (error) {
    console.error('[worker]', error);
    return 'idle';
  } finally {
    await store.unlock(lock, token);
  }
}
