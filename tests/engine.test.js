import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, applyAction, createInitialState } from '../server/engine/applyAction.js';
import { viewFor } from '../server/engine/view.js';

const now = 1000;
const player = (id, secret) => ({ id, name: `P-${id}`, tokenHash: `hash-${id}`, secret });

function roomWith(...players) {
  let state = createInitialState({ code: 'ABCD', now });
  for (const p of players) state = applyAction(state, { type: 'join', player: p }, { now });
  return state;
}

describe('applyAction', () => {
  it('increments the shared counter', () => {
    const state = roomWith(player('a', 11));
    const next = applyAction(state, { type: 'increment' }, { playerId: 'a', now });
    expect(next.counter).toBe(1);
    expect(state.counter).toBe(0); // original state is not mutated
  });

  it('rejects actions from someone who is not in the room', () => {
    const state = roomWith(player('a', 11));
    expect(() => applyAction(state, { type: 'increment' }, { playerId: 'zzz', now })).toThrow(
      /not in this room/,
    );
  });

  it('rejects empty and too-long messages', () => {
    const state = roomWith(player('a', 11));
    const say = (text) => applyAction(state, { type: 'say', text }, { playerId: 'a', now });
    expect(() => say('   ')).toThrow(/empty/);
    expect(() => say('x'.repeat(201))).toThrow(/at most/);
    expect(say('  hi  ').messages[0].text).toBe('hi');
  });

  it('refuses to join a full room', () => {
    const players = Array.from({ length: MAX_PLAYERS }, (_, i) => player(String(i), i));
    const state = roomWith(...players);
    expect(() => applyAction(state, { type: 'join', player: player('x', 1) }, { now })).toThrow(
      /full/,
    );
  });
});

describe('viewFor', () => {
  it("never leaks another player's secret or anyone's token hash", () => {
    const state = roomWith(player('a', 11), player('b', 77));
    const viewA = JSON.stringify(viewFor(state, 3, 'a'));
    expect(viewA).toContain('11'); // A sees their own secret
    expect(viewA).not.toContain('77'); // ...but not B's
    expect(viewA).not.toContain('hash-');
  });
});
