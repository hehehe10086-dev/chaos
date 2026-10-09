// Registry of scenario files. To add a scenario: add its JSON file to this folder and one
// import line below. No engine code changes are needed.

import idesOfMarch from './ides-of-march.json' with { type: 'json' };

export const scenarioFiles = [idesOfMarch];

/** The scenario new rooms use. */
export const DEFAULT_SCENARIO_ID = 'ides-of-march';
