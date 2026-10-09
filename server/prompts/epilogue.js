// The ending: an epilogue written from what actually happened, and (if the scenario has one)
// a two-line death poem.

import { transcriptFor } from './agent.js';

function publicTranscript(state, scenario) {
  // Reuse the character transcript, filtered to public lines only (no private narration).
  const publicState = { ...state, messages: state.messages.filter((m) => m.visibleTo === 'all') };
  return transcriptFor(publicState, scenario, '__nobody__', 40);
}

function decisionsMade(state, scenario) {
  return state.game.resolved
    .map((d) => {
      const decision = scenario.decisionById.get(d.id);
      const option = decision.options.find((o) => o.id === d.optionId);
      const who = scenario.roleById.get(d.roleId).shortName;
      const how = d.by === 'timeout' ? ' (did not answer in time)' : '';
      return `- ${who}: "${decision.prompt}" → ${option.label}${how}`;
    })
    .join('\n');
}

export function epiloguePrompt(state, scenario, ending) {
  const system = [
    `You are the historian who writes the last page of "${scenario.meta.title}" (${scenario.meta.setting}).`,
    'Write the epilogue of THIS telling of the day, in 3 or 4 sentences, past tense.',
    'It must stay true to the outcome given. Mention one or two specific moments or lines from what was said.',
    'Vivid but restrained: PG-13, no gore. No headings, no lists, no quotation marks around the whole text.',
  ].join('\n');
  const content = [
    `Outcome (must stay true): ${ending.title}. ${ending.fallbackEpilogue}`,
    '',
    'Decisions made:',
    decisionsMade(state, scenario) || '- (none)',
    '',
    'What was said:',
    publicTranscript(state, scenario),
    '',
    'Write the epilogue now.',
  ].join('\n');
  return { system, messages: [{ role: 'user', content }] };
}

export function deathPoemPrompt(state, scenario, ending) {
  const role = scenario.roleById.get(scenario.meta.deathPoem.role);
  const system = [
    `You write the death poem of ${role.name} at the end of "${scenario.meta.title}".`,
    'Exactly two short lines, plain and haunting, in their own voice. No gore, no title, no quotation marks.',
    `For tone, this is the kind of thing we mean: "${ending.fallbackDeathPoem.join(' / ')}" — but write a new one.`,
  ].join('\n');
  const content = [
    `How it ended: ${ending.title}.`,
    '',
    'What was said:',
    publicTranscript(state, scenario),
    '',
    'Reply with the two lines only, one per line.',
  ].join('\n');
  return { system, messages: [{ role: 'user', content }] };
}
