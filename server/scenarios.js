// Loads and validates every scenario once, and precomputes its sorted timeline.

import { DEFAULT_SCENARIO_ID, scenarioFiles } from '../scenarios/index.js';
import { parseScenario } from '../shared/scenarioSchema.js';
import { GameError } from './engine/errors.js';

// At equal times: acts first, then events, then decisions (file order within each).
const TYPE_ORDER = { act: 0, event: 1, decision: 2 };

/** Adds derived lookups. Kept separate so tests can prepare custom scenarios too. */
export function prepareScenario(data) {
  const scenario = parseScenario(data);
  const timeline = [
    ...scenario.acts.map((item, index) => ({ type: 'act', at: item.startAt, index })),
    ...scenario.events.map((item, index) => ({ type: 'event', at: item.at, index })),
    ...scenario.decisions.map((item, index) => ({ type: 'decision', at: item.at, index })),
  ].sort((a, b) => a.at - b.at || TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.index - b.index);

  return {
    ...scenario,
    timeline,
    roleById: new Map(scenario.roles.map((r) => [r.id, r])),
    factById: new Map(scenario.facts.map((f) => [f.id, f])),
    decisionById: new Map(scenario.decisions.map((d) => [d.id, d])),
    endingsByPriority: [...scenario.endings].sort((a, b) => a.priority - b.priority),
  };
}

const scenarios = new Map(scenarioFiles.map((data) => [data.meta.id, prepareScenario(data)]));

export function getScenario(id = DEFAULT_SCENARIO_ID) {
  const scenario = scenarios.get(id);
  if (!scenario) throw new GameError(`Unknown scenario: ${id}`, 500);
  return scenario;
}

export function listScenarios() {
  return [...scenarios.values()].map((s) => s.meta);
}
