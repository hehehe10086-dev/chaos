// Integration test against the real Upstash database. Runs only when .env has Redis
// credentials; otherwise it is skipped. Uses a few Redis commands per run.

import { describe, expect, it } from 'vitest';
import { newRoomCode } from '../server/auth.js';
import { createRedisStore } from '../server/store/redis.js';

try {
  process.loadEnvFile('.env');
} catch {
  // no .env — the test is skipped below
}

const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);

describe.skipIf(!hasRedis)('redis store (real Upstash)', () => {
  it('reads back what it wrote, and rejects a stale version', async () => {
    const store = createRedisStore();
    const code = newRoomCode();
    const state = { code, counter: 0 };

    expect(await store.get('NONE-SUCH')).toBeNull();
    expect(await store.create(code, state)).toBe(true);
    expect(await store.create(code, state)).toBe(false); // code already taken

    expect(await store.get(code)).toEqual({ version: 1, state });

    expect(await store.cas(code, 1, { ...state, counter: 1 })).toBe(true);
    expect(await store.cas(code, 1, { ...state, counter: 99 })).toBe(false); // stale version
    expect(await store.get(code)).toEqual({ version: 2, state: { code, counter: 1 } });
  });
});
