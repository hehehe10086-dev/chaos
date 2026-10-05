import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryStore } from '../server/store/memory.js';
import { createRoom, joinRoom, performAction } from '../server/rooms.js';

// No Redis env vars in tests, so rooms.js uses the in-memory store.
beforeEach(() => createMemoryStore().clear());

describe('rooms', () => {
  it('lets a second player join by code and see the same state', async () => {
    const a = await createRoom('Alice');
    const b = await joinRoom(a.code, 'Bob');
    await performAction(a.code, a.token, { type: 'increment' });
    const { view } = await performAction(b.code, b.token, { type: 'increment' });
    expect(view.counter).toBe(2);
    expect(view.players.map((p) => p.name)).toEqual(['Alice', 'Bob']);
  });

  it('does not lose updates when many players act at the same time', async () => {
    const a = await createRoom('Alice');
    const b = await joinRoom(a.code, 'Bob');
    await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        performAction(a.code, (i % 2 ? a : b).token, { type: 'increment' }),
      ),
    );
    const { view } = await performAction(a.code, a.token, { type: 'increment' });
    expect(view.counter).toBe(5);
  });

  it('rejects a wrong token', async () => {
    const a = await createRoom('Alice');
    await expect(performAction(a.code, 'not-a-token', { type: 'increment' })).rejects.toThrow(
      /Not a player/,
    );
  });

  it('returns 404 for an unknown room', async () => {
    await expect(joinRoom('ZZZZ', 'Bob')).rejects.toMatchObject({ status: 404 });
  });
});
