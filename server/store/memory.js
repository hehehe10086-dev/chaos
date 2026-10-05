// In-memory store for local dev and tests. Same interface as redis.js.
// Kept on globalThis so Vite's module reloads don't wipe rooms while you edit code.
// Never used on Vercel: separate function instances would not share memory.

const rooms = (globalThis.__chaosMemoryRooms ??= new Map());

/** @returns {import('./index.js').Store} */
export function createMemoryStore() {
  return {
    async get(code) {
      const entry = rooms.get(code);
      if (!entry) return null;
      return { version: entry.version, state: JSON.parse(entry.json) };
    },

    async create(code, state) {
      if (rooms.has(code)) return false;
      rooms.set(code, { version: 1, json: JSON.stringify(state) });
      return true;
    },

    async cas(code, expectedVersion, state) {
      const entry = rooms.get(code);
      if (!entry || entry.version !== expectedVersion) return false;
      rooms.set(code, { version: expectedVersion + 1, json: JSON.stringify(state) });
      return true;
    },

    async clear() {
      rooms.clear();
    },
  };
}
