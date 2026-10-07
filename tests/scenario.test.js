import { describe, expect, it } from 'vitest';
import data from '../scenarios/ides-of-march.json' with { type: 'json' };
import { evaluate } from '../shared/conditions.js';
import { prepareScenario } from '../server/scenarios.js';

describe('conditions', () => {
  const flags = { a: true, b: false, choice: 'warn', none: null };
  it.each([
    [{ flag: 'a', eq: true }, true],
    [{ flag: 'b', eq: true }, false],
    [{ flag: 'none', eq: null }, true],
    [{ flag: 'choice', in: ['strike', 'warn'] }, true],
    [{ flag: 'choice', in: ['strike'] }, false],
    [
      {
        all: [
          { flag: 'a', eq: true },
          { flag: 'b', eq: false },
        ],
      },
      true,
    ],
    [
      {
        all: [
          { flag: 'a', eq: true },
          { flag: 'b', eq: true },
        ],
      },
      false,
    ],
    [
      {
        any: [
          { flag: 'a', eq: false },
          { flag: 'b', eq: false },
        ],
      },
      true,
    ],
    [{ not: { flag: 'a', eq: true } }, false],
    [undefined, true],
  ])('%j -> %s', (condition, expected) => {
    expect(evaluate(condition, flags)).toBe(expected);
  });
});

describe('scenario file', () => {
  it("the Ides of March validates and has the brief's structure", () => {
    const s = prepareScenario(data);
    expect(s.roles.map((r) => r.id)).toEqual([
      'caesar',
      'brutus',
      'cassius',
      'calpurnia',
      'antony',
    ]);
    expect(s.acts.map((a) => a.mark)).toEqual(['起', '承', '转', '合']);
    expect(s.endings).toHaveLength(6);
    expect(s.meta.durationSeconds).toBe(600);
  });

  const broken = (mutate) => {
    const copy = structuredClone(data);
    mutate(copy);
    return () => prepareScenario(copy);
  };

  it('rejects references to unknown roles, flags, facts and options', () => {
    expect(broken((s) => (s.events[0].visibility = ['nobody']))).toThrow(/unknown role "nobody"/);
    expect(broken((s) => (s.decisions[0].condition = { flag: 'typo', eq: true }))).toThrow(
      /unknown flag "typo"/,
    );
    expect(broken((s) => (s.roles[0].knows = ['secret_plan']))).toThrow(
      /unknown fact "secret_plan"/,
    );
    expect(broken((s) => (s.decisions[0].historicalOptionId = 'fly'))).toThrow(
      /"fly" is not an option/,
    );
    expect(broken((s) => (s.decisions[0].options[0].setsFlags = { wings: true }))).toThrow(
      /unknown flag "wings"/,
    );
  });

  it('rejects a scenario without a default ending, or with out-of-range traits', () => {
    expect(broken((s) => (s.endings.at(-1).condition = { flag: 'readNote', eq: false }))).toThrow(
      /default ending/,
    );
    expect(broken((s) => (s.roles[0].traitRanges.ambition = [4, 9]))).toThrow();
    expect(broken((s) => delete s.roles[0].goal)).toThrow(/goal/);
  });
});
