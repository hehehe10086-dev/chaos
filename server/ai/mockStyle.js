// The mock "Era Voice": a deterministic word-swap using the scenario's mockStyle table.
// Crude on purpose — it only has to make offline games and tests feel period-flavored.

import { hash32 } from '../engine/random.js';
import { capitalize, escapeRegExp, firstSentences } from './text.js';

// Generic (not scenario-specific): soften crude words instead of amplifying them.
const CRUDE =
  /\b(fuck(?:ing|ed|er|ers)?|shit(?:ty)?|bitch(?:es)?|bastards?|assholes?|dicks?|crap)\b/gi;
const NET_SPEAK = /\s*\b(lol|lmao|rofl|omg|haha+|xd)\b[.!?]*/gi;

function matchCase(original, replacement) {
  return original[0] === original[0].toUpperCase() ? capitalize(replacement) : replacement;
}

const nounCache = new WeakMap();

/**
 * Words that are proper nouns in this scenario: character names, plus any word that appears
 * capitalized in the middle of a sentence somewhere in the scenario's own text.
 */
function properNouns(scenario) {
  if (nounCache.has(scenario)) return nounCache.get(scenario);
  const nouns = new Set(['i']);
  for (const role of scenario.roles) {
    for (const name of [role.name, role.shortName, ...role.aliases]) {
      for (const word of name.split(/\s+/)) nouns.add(word.toLowerCase());
    }
  }
  const corpus = [
    scenario.meta.intro,
    ...scenario.roles.flatMap((r) => [r.publicIdentity, r.secret, r.goal, ...r.sampleLines]),
    ...scenario.events.map((e) => e.text),
  ].join(' ');
  for (const match of corpus.matchAll(/[^.!?:"“]\s+([A-Z][a-z']+)/g))
    nouns.add(match[1].toLowerCase());
  nounCache.set(scenario, nouns);
  return nouns;
}

// Ordinary English words that start sentences; never kept capitalized mid-sentence.
const FUNCTION_WORDS = new Set(
  'the a an this that these those my our your his her their its if when let do every no some'.split(
    ' ',
  ),
);

/** Lower-cases the first letter, unless the first word is a proper noun (or "Lady X"-style). */
export function lowerFirst(scenario, text) {
  const [first = '', second = ''] = text.split(/\s+/);
  const word = first.replace(/[^A-Za-z']/g, '').toLowerCase();
  const titleLike = /^[A-Z]/.test(second) && !FUNCTION_WORDS.has(word);
  const keep = properNouns(scenario).has(word) || titleLike;
  return keep ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

/** Whether a line opens by addressing someone: "Brutus, ...", "Husband, ...", "Lady Calpurnia, ...". */
export function opensWithAddress(text) {
  return /^[A-Z][\w']+(?: [A-Z][\w']+)?,/.test(text);
}

/** If the line opens by addressing a character ("Brutus, ..."), that character's role id. */
export function leadingVocative(scenario, text) {
  const match = text.match(/^([A-Z][\w']+(?: [A-Z][\w']+)?),/);
  if (!match) return null;
  const words = match[1].toLowerCase().split(' ');
  const role = scenario.roles.find((r) =>
    [r.name, r.shortName, ...r.aliases].some((n) =>
      words.includes(n.toLowerCase().split(' ').at(-1)),
    ),
  );
  return role?.id ?? null;
}

export function mockRewrite(scenario, role, text) {
  const style = scenario.meta.mockStyle;
  let out = text.replace(CRUDE, 'cursed').replace(NET_SPEAK, '').trim() || text;
  for (const [from, to] of style.replacements) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'gi'), (m) => matchCase(m, to));
  }
  out = firstSentences(out.trim(), 2).replace(
    /(^|[.!?…]\s+)([a-z])/g,
    (_, p, c) => p + c.toUpperCase(),
  );
  if (!/[.!?…]$/.test(out)) out += '.';

  const h = hash32(`${role.id}:${text}`);
  const opener = style.openers[h % style.openers.length];
  const closer = style.closers[(h >>> 8) % style.closers.length];
  if (closer) out = out.replace(/([.!?…])$/, `${closer}$1`);
  // No opener when the line already starts by addressing someone ("Brutus, ...").
  if (opener && !opensWithAddress(out)) out = opener + lowerFirst(scenario, capitalize(out));
  return capitalize(out);
}
