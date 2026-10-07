// M2 check: complete games at a tiny TIME_SCALE reach every one of the 6 endings,
// and a game where nobody answers any decision ends in "history_repeats".

import { beforeEach, describe, expect, it } from 'vitest';
import { playthrough, resetStore } from './harness.js';

beforeEach(resetStore);

const comparison = (view) =>
  Object.fromEntries(view.game.ending.comparison.map((row) => [row.question, row.yours]));

describe('full playthroughs reach every ending', () => {
  const cases = [
    {
      ending: 'the_scroll',
      choices: { go_to_senate: 'go', read_note: 'read', antony_stays: 'follow' },
      survived: 'Yes',
    },
    {
      ending: 'betrayer_betrayed',
      choices: {
        go_to_senate: 'go',
        read_note: 'later',
        antony_stays: 'follow',
        brutus_choice: 'warn',
      },
      survived: 'Yes',
    },
    {
      ending: 'stayed_home',
      choices: { go_to_senate: 'stay', second_chance: 'stay_firm' },
      survived: 'Yes',
    },
    {
      ending: 'antonys_blade',
      choices: {
        go_to_senate: 'go',
        read_note: 'later',
        antony_stays: 'stay',
        brutus_choice: 'strike',
      },
      survived: 'Yes',
    },
    {
      ending: 'history_almost',
      choices: {
        go_to_senate: 'go',
        read_note: 'later',
        antony_stays: 'follow',
        brutus_choice: 'hesitate',
      },
      survived: 'No',
    },
    {
      ending: 'history_repeats',
      choices: {
        go_to_senate: 'go',
        read_note: 'later',
        antony_stays: 'follow',
        brutus_choice: 'strike',
      },
      survived: 'No',
    },
  ];

  for (const { ending, choices, survived } of cases) {
    it(`reaches "${ending}"`, async () => {
      const { finalView } = await playthrough({ choices });
      expect(finalView.phase).toBe('ended');
      expect(finalView.game.ending.id).toBe(ending);
      expect(comparison(finalView)['Did Caesar survive?']).toBe(survived);
      // The (mock) epilogue arrived; the death poem only when Caesar died.
      expect(finalView.game.ending.epilogue).toBeTruthy();
      expect(Boolean(finalView.game.ending.deathPoem)).toBe(survived === 'No');
    });
  }

  it('ends in "history_repeats" when nobody answers any decision', async () => {
    const { finalView, decided } = await playthrough({ choices: {} });
    expect(decided).toEqual([]);
    expect(finalView.game.ending.id).toBe('history_repeats');
    const rows = finalView.game.ending.comparison;
    expect(rows.every((row) => !row.changed)).toBe(true); // exactly as history
    expect(finalView.game.ending.decisions.every((d) => d.by === 'timeout')).toBe(true);
  });
});

describe('timeline details', () => {
  it('going "after all" still fires the road events, checked when they come due', async () => {
    const { finalView } = await playthrough({
      choices: {
        go_to_senate: 'stay',
        second_chance: 'go_after_all',
        read_note: 'later',
        brutus_choice: 'strike',
      },
    });
    const texts = finalView.messages.map((m) => m.text);
    expect(texts.some((t) => t.startsWith('Decimus'))).toBe(true);
    expect(texts.some((t) => t.includes('Artemidorus'))).toBe(true);
    expect(texts).toContain('Act 3 · The Visitor'); // variant chosen when act 3 began
    expect(texts).toContain('Act 4 · The Senate'); // he had left by then
    expect(finalView.game.ending.id).toBe('history_repeats');
  });

  it('staying home shows the variant act titles and the quiet house', async () => {
    const { finalView } = await playthrough({
      choices: { go_to_senate: 'stay', second_chance: 'stay_firm' },
    });
    const texts = finalView.messages.map((m) => m.text);
    expect(texts).toContain('Act 3 · The Visitor');
    expect(texts).toContain('Act 4 · The Locked Door');
    expect(texts.some((t) => t.startsWith('The house is quiet'))).toBe(true);
    expect(texts.some((t) => t.startsWith('The Senate doors close'))).toBe(false);
  });
});

describe('solo play', () => {
  it('one human and four AI characters play a whole game on the mock LLM', async () => {
    const { finalView } = await playthrough({ humans: ['calpurnia'] });
    expect(finalView.phase).toBe('ended');
    const roles = Object.fromEntries(finalView.roles.map((r) => [r.id, r.controller]));
    expect(roles).toEqual({
      caesar: 'ai',
      brutus: 'ai',
      cassius: 'ai',
      calpurnia: 'human',
      antony: 'ai',
    });

    // AI characters spoke, in every act.
    const aiLines = finalView.messages.filter((m) => m.kind === 'speech');
    expect(aiLines.length).toBeGreaterThanOrEqual(8);
    const speakers = new Set(aiLines.map((m) => m.roleId));
    expect(speakers.size).toBe(4);

    // Every decision was made by an AI (none timed out), and an ending was chosen.
    const decisions = finalView.game.ending.decisions;
    expect(decisions.length).toBeGreaterThanOrEqual(2);
    expect(decisions.every((d) => d.by === 'ai')).toBe(true);
    expect(finalView.game.ending.epilogue).toBeTruthy();
  });
});
