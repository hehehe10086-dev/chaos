// Integration test against the real Upstash database. Runs only when .env has Redis
// credentials; otherwise it is skipped. Uses a few dozen Redis commands per run.

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

    expect(await store.get(code)).toEqual({ version: 1, state, presence: {} });

    expect(await store.cas(code, 1, { ...state, counter: 1 })).toBe(true);
    expect(await store.cas(code, 1, { ...state, counter: 99 })).toBe(false); // stale version
    expect((await store.get(code)).state).toEqual({ code, counter: 1 });
  });

  it('tracks presence without changing the version', async () => {
    const store = createRedisStore();
    const code = newRoomCode();
    await store.create(code, { code });
    await store.touch(code, 'player1', 1234);
    expect(await store.get(code)).toEqual({
      version: 1,
      state: { code },
      presence: { player1: 1234 },
    });
    await store.touch('NONE-SUCH', 'player1', 1); // does not create a room
    expect(await store.get('NONE-SUCH')).toBeNull();
  });

  it('locks: one holder at a time, released only by its token', async () => {
    const store = createRedisStore();
    const name = `test:${newRoomCode()}`;
    const token = await store.lock(name, 5000);
    expect(token).toBeTruthy();
    expect(await store.lock(name, 5000)).toBeNull();
    await store.unlock(name, 'wrong-token');
    expect(await store.lock(name, 5000)).toBeNull();
    await store.unlock(name, token);
    const again = await store.lock(name, 5000);
    expect(again).toBeTruthy();
    await store.unlock(name, again);
  });

  it('counts', async () => {
    const store = createRedisStore();
    const name = `test:${newRoomCode()}`;
    expect(await store.incr(name)).toBe(1);
    expect(await store.incr(name)).toBe(2);
  });
});
