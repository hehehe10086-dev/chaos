// Small text helpers for cleaning model output and for the mock style transform.

export const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SENTENCE = /(?<=[.!?…])\s+/;

export function firstSentences(text, count) {
  return text.split(SENTENCE).slice(0, count).join(' ');
}

/**
 * Cleans a model's line of dialogue: drops a leading "Name:" label and wrapping quotes,
 * keeps at most `maxSentences`, and caps the length at a word boundary.
 */
export function tidyLine(text, { maxSentences = 2, maxChars = 300 } = {}) {
  const unquote = (s) => s.replace(/^["“'‘]+|["”'’]+$/g, '').trim();
  let out = unquote(
    String(text ?? '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
  out = unquote(out.replace(/^[A-Z][\w .'-]{0,30}:\s+/, '')); // "Brutus: ..." → "..."
  out = firstSentences(out, maxSentences);
  if (out.length > maxChars) out = `${out.slice(0, maxChars).replace(/\s+\S*$/, '')}…`;
  return out;
}

export function tidyParagraph(text, maxChars = 900) {
  const out = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“]+|["”]+$/g, '');
  return out.length > maxChars ? `${out.slice(0, maxChars).replace(/\s+\S*$/, '')}…` : out;
}

/** Two non-empty lines, or null. */
export function parsePoem(text) {
  const lines = String(text ?? '')
    .split('\n')
    .map((l) =>
      l
        .replace(/^[\s\d.)*-]+/, '')
        .replace(/^["“]+|["”]+$/g, '')
        .trim(),
    )
    .filter(Boolean);
  return lines.length >= 2 ? lines.slice(0, 2) : null;
}

export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
