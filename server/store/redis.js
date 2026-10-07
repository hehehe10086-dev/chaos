// Upstash Redis store. Each room is one hash:
//   room:{code} -> { v: version, s: state JSON, p:<playerId>: last poll time (ms) }
// Writes are Lua scripts, which Redis runs atomically: "create only if absent" and
// "write only if the version is still the one we read" (compare-and-set).
// Presence fields are written separately, so polling doesn't bump the version.

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

// Only touch rooms that exist, so a stale poll can't resurrect an expired room.
const TOUCH_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
return 1`;

const UNLOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;

const INCR_SCRIPT = `
local value = redis.call('INCR', KEYS[1])
if value == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return value`;

const key = (code) => `room:${code}`;

/** HGETALL comes back as a flat [field, value, ...] array without deserialization. */
function toObject(raw) {
  if (!raw) return {};
  if (!Array.isArray(raw)) return raw;
  const out = {};
  for (let i = 0; i < raw.length; i += 2) out[raw[i]] = raw[i + 1];
  return out;
}

/** @returns {import('./index.js').Store} */
export function createRedisStore() {
  // Reads UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN.
  // We store raw strings and parse JSON ourselves.
  const redis = Redis.fromEnv({ automaticDeserialization: false });

  return {
    async get(code) {
      const fields = toObject(await redis.hgetall(key(code)));
      if (fields.v == null || fields.s == null) return null;
      const presence = {};
      for (const [field, value] of Object.entries(fields)) {
        if (field.startsWith('p:')) presence[field.slice(2)] = Number(value);
      }
      return { version: Number(fields.v), state: JSON.parse(fields.s), presence };
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

    async touch(code, playerId, now) {
      await redis.eval(TOUCH_SCRIPT, [key(code)], [`p:${playerId}`, String(now)]);
    },

    async lock(name, ttlMs) {
      const token = Math.random().toString(36).slice(2);
      const ok = await redis.set(`lock:${name}`, token, { nx: true, px: ttlMs });
      return ok === 'OK' || ok === true ? token : null;
    },

    async unlock(name, token) {
      await redis.eval(UNLOCK_SCRIPT, [`lock:${name}`], [token]);
    },

    async incr(name) {
      return Number(await redis.eval(INCR_SCRIPT, [`count:${name}`], [String(60 * 60 * 48)]));
    },
  };
}
