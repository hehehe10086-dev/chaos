// In-memory store for local dev and tests. Same interface as redis.js.
// Kept on globalThis so Vite's module reloads don't wipe rooms while you edit code.
// Never used on Vercel: separate function instances would not share memory.

const mem = (globalThis.__chaosMemoryStore ??= {
  rooms: new Map(),
  locks: new Map(),
  counters: new Map(),
});

/** @returns {import('./index.js').Store} */
export function createMemoryStore() {
  return {
    async get(code) {
      const entry = mem.rooms.get(code);
      if (!entry) return null;
      return {
        version: entry.version,
        state: JSON.parse(entry.json),
        presence: { ...entry.presence },
      };
    },

    async create(code, state) {
      if (mem.rooms.has(code)) return false;
      mem.rooms.set(code, { version: 1, json: JSON.stringify(state), presence: {} });
      return true;
    },

    async cas(code, expectedVersion, state) {
      const entry = mem.rooms.get(code);
      if (!entry || entry.version !== expectedVersion) return false;
      entry.version = expectedVersion + 1;
      entry.json = JSON.stringify(state);
      return true;
    },

    async touch(code, playerId, now) {
      const entry = mem.rooms.get(code);
      if (entry) entry.presence[playerId] = now;
    },

    async lock(name, ttlMs) {
      const now = Date.now();
      const held = mem.locks.get(name);
      if (held && held.expires > now) return null;
      const token = Math.random().toString(36).slice(2);
      mem.locks.set(name, { token, expires: now + ttlMs });
      return token;
    },

    async unlock(name, token) {
      if (mem.locks.get(name)?.token === token) mem.locks.delete(name);
    },

    async incr(name) {
      const value = (mem.counters.get(name) ?? 0) + 1;
      mem.counters.set(name, value);
      return value;
    },

    async clear() {
      mem.rooms.clear();
      mem.locks.clear();
      mem.counters.clear();
    },
  };
}
