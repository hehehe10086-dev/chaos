// Upstash Redis store. Each room is one hash: room:{code} -> { v: version, s: state JSON }.
// Writes are Lua scripts, which Redis runs atomically: "create only if absent" and
// "write only if the version is still the one we read" (compare-and-set).

import { Redis } from '@upstash/redis';

const ROOM_TTL_SECONDS = 60 * 60 * 24; // rooms expire 24h after their last write

const CREATE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('HSET', KEYS[1], 'v', ARGV[1], 's', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1`;

const CAS_SCRIPT = `
if redis.call('HGET', KEYS[1], 'v') ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[1], 'v', ARGV[2], 's', ARGV[3])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return 1`;

const key = (code) => `room:${code}`;

/** @returns {import('./index.js').Store} */
export function createRedisStore() {
  // Reads UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN.
  // We store raw strings and parse JSON ourselves.
  const redis = Redis.fromEnv({ automaticDeserialization: false });

  return {
    async get(code) {
      const { v, s } = (await redis.hmget(key(code), 'v', 's')) ?? {};
      if (v == null || s == null) return null;
      return { version: Number(v), state: JSON.parse(s) };
    },

    async create(code, state) {
      const ok = await redis.eval(
        CREATE_SCRIPT,
        [key(code)],
        ['1', JSON.stringify(state), String(ROOM_TTL_SECONDS)],
      );
      return Number(ok) === 1;
    },

    async cas(code, expectedVersion, state) {
      const ok = await redis.eval(
        CAS_SCRIPT,
        [key(code)],
        [
          String(expectedVersion),
          String(expectedVersion + 1),
          JSON.stringify(state),
          String(ROOM_TTL_SECONDS),
        ],
      );
      return Number(ok) === 1;
    },
  };
}
