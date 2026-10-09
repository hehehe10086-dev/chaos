// Scenario file schema. The engine knows nothing about any specific story: everything
// story-specific lives in scenarios/*.json and is validated here when it is loaded.

import { z } from 'zod';
import { flagsIn } from './conditions.js';

/** Personality traits every AI character gets (1–5, randomized per game within traitRanges). */
export const TRAITS = ['intelligence', 'loyalty', 'ambition', 'lovestruck', 'obedience'];

const Id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'ids are lowercase letters, digits and _');
const Text = z.string().trim().min(1);
const FlagValue = z.union([z.boolean(), z.string(), z.number(), z.null()]);
const Seconds = z.number().min(0);
const Poem = z.tuple([Text, Text]);
const SetsFlags = z.record(z.string(), FlagValue);

export const Condition = z.lazy(() =>
  z.union([
    z.strictObject({ all: z.array(Condition).min(1) }),
    z.strictObject({ any: z.array(Condition).min(1) }),
    z.strictObject({ not: Condition }),
    z.strictObject({ flag: z.string(), eq: FlagValue }),
    z.strictObject({ flag: z.string(), in: z.array(FlagValue).min(1) }),
  ]),
);

const TraitRange = z
  .tuple([z.number().int().min(1).max(5), z.number().int().min(1).max(5)])
  .refine(([min, max]) => min <= max, 'trait range must be [min, max] with min <= max');

const Role = z.strictObject({
  id: Id,
  name: Text,
  shortName: Text,
  aliases: z.array(Text).default([]),
  publicIdentity: Text,
  secret: Text,
  goal: Text,
  portraitKey: Text,
  persona: Text.optional(),
  bonds: z.strictObject({ loves: Text.optional(), loyalTo: Text.optional() }).default({}),
  traitRanges: z.strictObject(Object.fromEntries(TRAITS.map((t) => [t, TraitRange]))),
  knows: z.array(Id).default([]),
  sampleLines: z.array(Text).min(1),
});

const Act = z.strictObject({
  id: Id,
  number: z.number().int().min(1),
  mark: Text,
  title: Text,
  startAt: Seconds,
  poem: Poem,
  variants: z.array(z.strictObject({ condition: Condition, title: Text, poem: Poem })).default([]),
});

const Event = z.strictObject({
  id: Id,
  at: Seconds,
  text: Text,
  visibility: z.union([z.literal('all'), z.array(Id).min(1)]),
  condition: Condition.optional(),
  setsFlags: SetsFlags.optional(),
  concerns: z.array(Id).default([]),
});

const Option = z.strictObject({
  id: Id,
  label: Text,
  narration: Text,
  setsFlags: SetsFlags.optional(),
  /** Mock/AI fallback: weight += bias[trait] * (trait - 3) / 2 */
  aiBias: z.partialRecord(z.enum(TRAITS), z.number()).default({}),
});

const Decision = z.strictObject({
  id: Id,
  at: Seconds,
  role: Id,
  prompt: Text,
  timeoutSeconds: z.number().positive(),
  historicalOptionId: Id,
  condition: Condition.optional(),
  concerns: z.array(Id).default([]),
  options: z.array(Option).min(2),
});

const Ending = z.strictObject({
  id: Id,
  priority: z.number().int(),
  title: Text,
  /** Omitted = the default ending. */
  condition: Condition.optional(),
  fallbackEpilogue: Text,
  fallbackDeathPoem: Poem.optional(),
  setsFlags: SetsFlags.optional(),
});

const Comparison = z.strictObject({
  question: Text,
  flag: z.string(),
  history: FlagValue,
  /** Display label per value, keyed by String(value) — e.g. "true", "strike", "null". */
  labels: z.record(z.string(), Text),
});

const Meta = z.strictObject({
  id: Id.or(z.string().regex(/^[a-z][a-z0-9-]*$/)),
  title: Text,
  tagline: Text,
  setting: Text,
  intro: Text,
  durationSeconds: z.number().positive(),
  speechStyle: Text,
  mockStyle: z
    .strictObject({
      replacements: z.array(z.tuple([Text, z.string()])).default([]),
      openers: z.array(z.string()).default(['']),
      closers: z.array(z.string()).default(['']),
    })
    .default({ replacements: [], openers: [''], closers: [''] }),
  deathPoem: z.strictObject({ role: Id }).optional(),
});

const ScenarioShape = z.strictObject({
  meta: Meta,
  flags: z.record(z.string(), FlagValue),
  roles: z.array(Role).min(1),
  facts: z.array(z.strictObject({ id: Id, text: Text })).default([]),
  acts: z.array(Act).min(1),
  events: z.array(Event).default([]),
  decisions: z.array(Decision).default([]),
  endings: z.array(Ending).min(1),
  historyComparison: z.array(Comparison).default([]),
});

/** Cross-reference checks the shape alone can't express. */
function checkReferences(s, ctx) {
  const issue = (message, path) => ctx.addIssue({ code: 'custom', message, path });
  const roleIds = new Set(s.roles.map((r) => r.id));
  const factIds = new Set(s.facts.map((f) => f.id));
  const flagNames = new Set(Object.keys(s.flags));
  const duration = s.meta.durationSeconds;

  const unique = (list, label) => {
    const seen = new Set();
    for (const item of list) {
      if (seen.has(item.id)) issue(`duplicate ${label} id "${item.id}"`, [label]);
      seen.add(item.id);
    }
  };
  unique(s.roles, 'roles');
  unique(s.facts, 'facts');
  unique(s.acts, 'acts');
  unique([...s.events, ...s.decisions], 'events/decisions');
  unique(s.endings, 'endings');

  const checkRoles = (ids, path) => {
    for (const id of ids) if (!roleIds.has(id)) issue(`unknown role "${id}"`, path);
  };
  const checkCondition = (condition, path) => {
    for (const flag of flagsIn(condition)) {
      if (!flagNames.has(flag)) issue(`condition uses unknown flag "${flag}"`, path);
    }
  };
  const checkSets = (sets, path) => {
    for (const flag of Object.keys(sets ?? {})) {
      if (!flagNames.has(flag)) issue(`sets unknown flag "${flag}"`, path);
    }
  };
  const checkTime = (at, path) => {
    if (at > duration) issue(`time ${at}s is after the end (${duration}s)`, path);
  };

  s.roles.forEach((r, i) => {
    for (const f of r.knows)
      if (!factIds.has(f)) issue(`unknown fact "${f}"`, ['roles', i, 'knows']);
  });

  if (s.acts[0].startAt !== 0) issue('the first act must start at 0', ['acts', 0, 'startAt']);
  s.acts.forEach((a, i) => {
    if (i > 0 && a.startAt <= s.acts[i - 1].startAt)
      issue('acts must be in time order', ['acts', i]);
    checkTime(a.startAt, ['acts', i, 'startAt']);
    a.variants.forEach((v, j) => checkCondition(v.condition, ['acts', i, 'variants', j]));
  });

  s.events.forEach((e, i) => {
    if (e.visibility !== 'all') checkRoles(e.visibility, ['events', i, 'visibility']);
    checkRoles(e.concerns, ['events', i, 'concerns']);
    checkCondition(e.condition, ['events', i, 'condition']);
    checkSets(e.setsFlags, ['events', i, 'setsFlags']);
    checkTime(e.at, ['events', i, 'at']);
  });

  s.decisions.forEach((d, i) => {
    checkRoles([d.role, ...d.concerns], ['decisions', i]);
    checkCondition(d.condition, ['decisions', i, 'condition']);
    checkTime(d.at, ['decisions', i, 'at']);
    const optionIds = new Set(d.options.map((o) => o.id));
    if (optionIds.size !== d.options.length)
      issue('duplicate option ids', ['decisions', i, 'options']);
    if (!optionIds.has(d.historicalOptionId)) {
      issue(`historicalOptionId "${d.historicalOptionId}" is not an option`, ['decisions', i]);
    }
    d.options.forEach((o, j) =>
      checkSets(o.setsFlags, ['decisions', i, 'options', j, 'setsFlags']),
    );
  });

  const priorities = new Set();
  s.endings.forEach((e, i) => {
    if (priorities.has(e.priority))
      issue(`duplicate ending priority ${e.priority}`, ['endings', i]);
    priorities.add(e.priority);
    checkCondition(e.condition, ['endings', i, 'condition']);
    checkSets(e.setsFlags, ['endings', i, 'setsFlags']);
  });
  if (!s.endings.some((e) => e.condition == null)) {
    issue('one ending must have no condition (the default ending)', ['endings']);
  }

  s.historyComparison.forEach((c, i) => {
    if (!flagNames.has(c.flag)) issue(`unknown flag "${c.flag}"`, ['historyComparison', i]);
  });

  if (s.meta.deathPoem) checkRoles([s.meta.deathPoem.role], ['meta', 'deathPoem']);
}

export const ScenarioSchema = ScenarioShape.superRefine(checkReferences);

/**
 * Validates a scenario file. Throws an Error listing every problem if it is invalid.
 * @param {unknown} data
 */
export function parseScenario(data) {
  const result = ScenarioSchema.safeParse(data);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid scenario file:\n${problems}`);
  }
  return result.data;
}
