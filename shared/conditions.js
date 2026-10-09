// Tiny condition language used by scenario files:
//   { "flag": "x", "eq": value }      flag equals value (strict; null matches null)
//   { "flag": "x", "in": [v1, v2] }   flag is one of the values
//   { "all": [c1, c2] }               every condition holds
//   { "any": [c1, c2] }               at least one holds
//   { "not": c }                      negation
// A missing condition (undefined / null) always holds.

/**
 * @param {object | null | undefined} condition
 * @param {Record<string, unknown>} flags
 * @returns {boolean}
 */
export function evaluate(condition, flags) {
  if (condition == null) return true;
  if ('all' in condition) return condition.all.every((c) => evaluate(c, flags));
  if ('any' in condition) return condition.any.some((c) => evaluate(c, flags));
  if ('not' in condition) return !evaluate(condition.not, flags);
  const value = flags[condition.flag];
  if ('eq' in condition) return value === condition.eq;
  if ('in' in condition) return condition.in.includes(value);
  throw new Error(`Invalid condition: ${JSON.stringify(condition)}`);
}

/** Lists every flag name a condition reads (used to validate scenario files). */
export function flagsIn(condition) {
  if (condition == null) return [];
  if ('all' in condition) return condition.all.flatMap(flagsIn);
  if ('any' in condition) return condition.any.flatMap(flagsIn);
  if ('not' in condition) return flagsIn(condition.not);
  return [condition.flag];
}
