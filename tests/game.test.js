// Game rules and hidden information, through the real room API.

import { beforeEach, describe, expect, it } from 'vitest';
import { harness, resetStore } from './harness.js';

beforeEach(resetStore);

async function lobbyOfTwo() {
  const h = harness();
  const a = await h.create('Alice');
  const b = await h.join(a.code, 'Bob');
  return { h, code: a.code, a, b };
}

describe('lobby', () => {
  it('two players join by code, pick roles, chat, and the host starts', async () => {
    const { h, code, a, b } = await lobbyOfTwo();
    await h.act(code, a.token, { type: 'pickRole', roleId: 'brutus' });
    await expect(h.act(code, b.token, { type: 'pickRole', roleId: 'brutus' })).rejects.toThrow(
      /already picked/,
    );
    await h.act(code, b.token, { type: 'pickRole', roleId: 'random' });
    await h.act(code, b.token, { type: 'say', text: 'hello' });
    const lobby = await h.poll(code, a.token);
    expect(lobby.messages.at(-1)).toMatchObject({
      kind: 'chat',
      text: 'hello',
      playerId: b.playerId,
    });

    await expect(h.act(code, b.token, { type: 'start' })).rejects.toThrow(/Only the host/);
    const started = await h.act(code, a.token, { type: 'start' });
    expect(started.phase).toBe('playing');
    expect(started.you.roleId).toBe('brutus');
    const bobView = await h.poll(code, b.token);
    expect(bobView.you.roleId).not.toBe('brutus');
    expect(bobView.roles.filter((r) => r.controller === 'human')).toHaveLength(2);
  });

  it('lets anyone start when the host has been gone for a while', async () => {
    const { h, code, a, b } = await lobbyOfTwo();
    await h.poll(code, a.token);
    h.waitMs(25_000);
    await h.poll(code, b.token);
    const view = await h.act(code, b.token, { type: 'start' });
    expect(view.phase).toBe('playing');
  });

  it('refuses a sixth player (five roles)', async () => {
    const h = harness();
    const host = await h.create('P1');
    for (let i = 2; i <= 5; i++) await h.join(host.code, `P${i}`);
    await expect(h.join(host.code, 'P6')).rejects.toThrow(/full/);
  });
});

describe('hidden information', () => {
  it("never leaks another role's secret, AI traits, token hashes, or private narration", async () => {
    const { h, code, a, b } = await lobbyOfTwo();
    await h.act(code, a.token, { type: 'pickRole', roleId: 'calpurnia' });
    await h.act(code, b.token, { type: 'pickRole', roleId: 'antony' });
    await h.act(code, a.token, { type: 'start' });

    const calpurnia = await h.poll(code, a.token);
    const antony = await h.poll(code, b.token);
    const antonyJson = JSON.stringify(antony);

    expect(calpurnia.game.myRole.secret).toMatch(/dreamed/);
    expect(antonyJson).not.toMatch(/dreamed you held/); // Calpurnia's secret
    expect(antonyJson).not.toMatch(/at the heart of the conspiracy/); // Brutus's secret
    expect(antonyJson).not.toMatch(/Caesar lay bleeding/); // Calpurnia's private narration
    expect(antonyJson).not.toMatch(/tokenHash|traits|intelligence|pending/);
    expect(JSON.stringify(calpurnia)).toMatch(/Caesar lay bleeding/); // ...which she does see
    expect(antony.game.myRole.facts).toEqual([]);
  });

  it('shows what a player typed only to that player', async () => {
    const { h, code, a, b } = await lobbyOfTwo();
    await h.act(code, a.token, { type: 'pickRole', roleId: 'caesar' });
    await h.act(code, a.token, { type: 'start' });
    await h.act(code, a.token, { type: 'say', text: 'ok guys, I am going to the senate' });

    const mine = (await h.poll(code, a.token)).messages.find(
      (m) => m.kind === 'speech' && m.roleId === 'caesar',
    );
    const theirs = (await h.poll(code, b.token)).messages.find((m) => m.id === mine.id);
    expect(mine.original).toBe('ok guys, I am going to the senate');
    expect(mine.text).not.toBe(mine.original); // rewritten (mock era voice)
    expect(theirs.original).toBeNull();
    expect(theirs.text).toBe(mine.text);
  });
});

describe('decisions', () => {
  it('only the deciding role may decide, and only while the decision is open', async () => {
    const { h, code, a, b } = await lobbyOfTwo();
    await h.act(code, a.token, { type: 'pickRole', roleId: 'caesar' });
    await h.act(code, b.token, { type: 'pickRole', roleId: 'antony' });
    await h.act(code, a.token, { type: 'start' });

    h.wait(271);
    const caesar = await h.poll(code, a.token);
    expect(caesar.game.decision).toMatchObject({ id: 'go_to_senate' });
    const antony = await h.poll(code, b.token);
    expect(antony.game.decision).toBeNull();
    expect(antony.game.deciding).toEqual([{ roleId: 'caesar', deadline: 300 }]);
    await expect(
      h.act(code, b.token, { type: 'decide', decisionId: 'go_to_senate', optionId: 'stay' }),
    ).rejects.toThrow(/not yours/);

    h.wait(30); // past the 30 s timeout
    await expect(
      h.act(code, a.token, { type: 'decide', decisionId: 'go_to_senate', optionId: 'stay' }),
    ).rejects.toThrow(/already over/);
    const after = await h.poll(code, a.token);
    expect(after.messages.map((m) => m.text)).toContain(
      'Caesar laughs off the dream and calls for his litter.',
    );
  });
});

describe('AI characters', () => {
  it('answer a human who addresses them by name, within a few seconds', async () => {
    const h = harness();
    const a = await h.create('Alice');
    await h.act(a.code, a.token, { type: 'pickRole', roleId: 'caesar' });
    await h.act(a.code, a.token, { type: 'start' });

    // Wait until Calpurnia has just spoken, so her normal 20–30 s limit would apply.
    let view;
    for (let i = 0; i < 120; i++) {
      h.wait(1);
      view = await h.poll(a.code, a.token);
      if (view.messages.some((m) => m.kind === 'speech' && m.roleId === 'calpurnia')) break;
    }
    view = await h.act(a.code, a.token, { type: 'say', text: 'Calpurnia, why are you so pale?' });
    const asked = view.game.clock.t;

    let reply;
    for (let i = 0; i < 40 && !reply; i++) {
      h.wait(1);
      view = await h.poll(a.code, a.token);
      reply = view.messages.find(
        (m) => m.kind === 'speech' && m.roleId === 'calpurnia' && m.t > asked,
      );
    }
    expect(reply).toBeTruthy();
    expect(reply.t - asked).toBeLessThanOrEqual(21);
    expect(reply.to).toBe('caesar');
  });
});

describe('game clock', () => {
  it('pauses while nobody is polling, so the story waits for the players', async () => {
    const { h, code, a } = await lobbyOfTwo();
    await h.act(code, a.token, { type: 'start' });
    h.wait(50);
    const before = await h.poll(code, a.token);
    h.waitMs(5 * 60_000); // everyone away for five minutes
    const after = await h.poll(code, a.token);
    expect(after.game.clock.t - before.game.clock.t).toBeLessThan(1);
    expect(after.game.act.id).toBe('dawn');
  });
});

describe('play again', () => {
  it('starts a new game once, with new traits, keeping seats', async () => {
    const { h, code, a, b } = await lobbyOfTwo();
    await h.act(code, a.token, { type: 'pickRole', roleId: 'cassius' });
    await h.act(code, a.token, { type: 'start' });
    for (let i = 0; i < 70; i++) {
      h.wait(10);
      await h.poll(code, a.token);
    }
    const ended = await h.poll(code, a.token);
    expect(ended.phase).toBe('ended');

    const again = await h.act(code, a.token, { type: 'playAgain', gameId: ended.game.id });
    expect(again.phase).toBe('playing');
    expect(again.game.id).toBe(ended.game.id + 1);
    expect(again.you.roleId).toBe('cassius');
    await expect(
      h.act(code, b.token, { type: 'playAgain', gameId: ended.game.id }),
    ).rejects.toThrow(/already started/);
  });
});
