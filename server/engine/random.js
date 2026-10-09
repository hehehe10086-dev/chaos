// Deterministic randomness. Every random choice is derived from the game seed plus a key
// describing the choice, so the engine stays pure and every game is reproducible in tests.

/** FNV-1a 32-bit hash. */
export function hash32(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [0, 1) that is always the same for the same seed and key. */
export function rand(seed, key) {
  return mulberry32(hash32(`${seed}:${key}`))();
}

export function randRange(seed, key, min, max) {
  return min + rand(seed, key) * (max - min);
}

/** An integer in [min, max], inclusive. */
export function randInt(seed, key, min, max) {
  return min + Math.floor(rand(seed, key) * (max - min + 1));
}

export function shuffled(seed, key, list) {
  const next = mulberry32(hash32(`${seed}:${key}`));
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Picks one item; higher weight = more likely. Weights must be > 0. */
export function pickWeighted(seed, key, items, weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let x = rand(seed, key) * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x < 0) return items[i];
  }
  return items[items.length - 1];
}
