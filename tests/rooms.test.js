import { beforeEach, describe, expect, it } from 'vitest';
import { createRoom, joinRoom, performAction, pollRoom } from '../server/rooms.js';
import { createMemoryStore } from '../server/store/memory.js';

// No Redis in tests (tests/setup.js), so rooms.js uses the in-memory store.
beforeEach(() => createMemoryStore().clear());

describe('rooms', () => {
  it('lets a second player join by code and both see the same lobby', async () => {
    const a = await createRoom('Alice');
    const b = await joinRoom(a.code, 'Bob');
    await performAction(a.code, a.token, { type: 'say', text: 'hi Bob' });
    const { view } = await pollRoom(b.code, b.token, null);
    expect(view.players.map((p) => p.name)).toEqual(['Alice', 'Bob']);
    expect(view.messages.at(-1).text).toBe('hi Bob');
    expect(view.hostId).toBe(a.playerId);
  });

  it('polling answers "unchanged" when the client already has the current version', async () => {
    const a = await createRoom('Alice');
    const first = await pollRoom(a.code, a.token, null);
    const second = await pollRoom(a.code, a.token, first.view.version);
    expect(second).toEqual({ changed: false, version: first.view.version });
  });

  it('does not lose updates when players act at the same time', async () => {
    const a = await createRoom('Alice');
    const b = await joinRoom(a.code, 'Bob');
    const now = Date.now();
    await Promise.all(
      [a, b, a, b].map((p, i) =>
        performAction(a.code, p.token, { type: 'say', text: `line ${i}` }, { now: now + i * 2000 }),
      ),
    );
    const { view } = await pollRoom(a.code, a.token, null);
    expect(view.messages.filter((m) => m.kind === 'chat')).toHaveLength(4);
  });

  it('rejects a wrong token and an unknown room', async () => {
    const a = await createRoom('Alice');
    await expect(pollRoom(a.code, 'not-a-token', null)).rejects.toMatchObject({ status: 401 });
    await expect(joinRoom('ZZZZ', 'Bob')).rejects.toMatchObject({ status: 404 });
  });
});
