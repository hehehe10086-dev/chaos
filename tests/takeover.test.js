// M5: a player who joins after the start takes over an AI role and gets a short recap.

import { beforeEach, describe, expect, it } from 'vitest';
import { recapPrompt } from '../server/prompts/recap.js';
import { loadRoom } from '../server/roomData.js';
import { performAction } from '../server/rooms.js';
import { getScenario } from '../server/scenarios.js';
import { harness, resetStore, TIME_SCALE } from './harness.js';

beforeEach(resetStore);

const scenario = getScenario();
const card = (roleId) => scenario.roleById.get(roleId);

/** Alice plays Caesar; the day runs to `seconds`, then Bob joins (as a spectator). */
async function gameWithLateJoiner(seconds) {
  const h = harness();
  const a = await h.create('Alice');
  await h.act(a.code, a.token, { type: 'pickRole', roleId: 'caesar' });
  await h.act(a.code, a.token, { type: 'start' });
  for (let t = 0; t < seconds;) {
    const step = Math.min(10, seconds - t);
    h.wait(step);
    t += step;
    await h.poll(a.code, a.token);
  }
  const b = await h.join(a.code, 'Bob');
  return { h, code: a.code, a, b };
}

describe('mid-game takeover', () => {
  it('a late joiner takes over an AI role; only they see the recap', async () => {
    const { h, code, a, b } = await gameWithLateJoiner(130);
    expect(b.view.phase).toBe('playing');
    expect(b.view.you.roleId).toBeNull(); // a spectator until the takeover

    const view = await h.act(code, b.token, { type: 'takeover', roleId: 'antony' });
    expect(view.you.roleId).toBe('antony');
    expect(view.game.myRole.recap).toEqual({
      happened: expect.stringMatching(/^Act 2, The House\. /), // mock = the fallback recap
      secret: card('antony').secret,
      goal: card('antony').goal,
    });

    const alice = await h.poll(code, a.token);
    expect(alice.roles.find((r) => r.id === 'antony')).toMatchObject({
      controller: 'human',
      playerName: 'Bob',
    });
    expect(alice.messages).toContainEqual(
      expect.objectContaining({ kind: 'system', text: 'Bob takes over Mark Antony.' }),
    );
    expect(alice.game.myRole.recap).toBeNull();
    expect(JSON.stringify(alice)).not.toContain(card('antony').secret);
  });

  it('the new player speaks and decides for the role, and the AI stops playing it', async () => {
    const { h, code, a, b } = await gameWithLateJoiner(250);
    const taken = await h.act(code, b.token, { type: 'takeover', roleId: 'antony' });
    const takenAt = taken.game.clock.t;
    const said = await h.act(code, b.token, { type: 'say', text: 'Caesar, let me walk with you' });
    expect(said.messages.at(-1)).toMatchObject({ roleId: 'antony', playerId: b.playerId });

    // Caesar (Alice) goes to the Senate, so Antony is asked at 430.
    let view;
    for (let i = 0; i < 120 && !view?.game.decision; i++) {
      h.wait(2);
      const alice = await h.poll(code, a.token);
      if (alice.game.decision?.id === 'go_to_senate') {
        await h.act(code, a.token, { type: 'decide', decisionId: 'go_to_senate', optionId: 'go' });
      }
      view = await h.poll(code, b.token);
    }
    expect(view.game.decision.id).toBe('antony_stays');
    const after = await h.act(code, b.token, {
      type: 'decide',
      decisionId: 'antony_stays',
      optionId: 'stay',
    });
    expect(after.messages.map((m) => m.text)).toContain(
      "Antony shakes off the senator's hand and stays at Caesar's side.",
    );
    const aiLinesForAntony = after.messages.filter(
      (m) => m.kind === 'speech' && m.roleId === 'antony' && !m.playerId && m.t > takenAt,
    );
    expect(aiLinesForAntony).toEqual([]);
  });

  it('refuses a human-played role, a second role, an unknown role and a role in mid-decision', async () => {
    // Caesar's decision timed out (history: he goes), so Antony (AI) is deciding at 430–440.
    const { h, code, b } = await gameWithLateJoiner(431);
    const take = (roleId) => h.act(code, b.token, { type: 'takeover', roleId });
    await expect(take('caesar')).rejects.toThrow(/Alice already plays Julius Caesar/);
    await expect(take('nobody')).rejects.toThrow(/Unknown role/);
    await expect(take('antony')).rejects.toThrow(/Antony is making a decision/);
    await take('cassius');
    await expect(take('brutus')).rejects.toThrow(/You already play Gaius Cassius/);
  });

  it('refuses outside a running day (lobby, ending)', async () => {
    const h = harness();
    const a = await h.create('Alice');
    const take = () => h.act(a.code, a.token, { type: 'takeover', roleId: 'antony' });
    await expect(take()).rejects.toThrow(/only while the day is running/);

    await h.act(a.code, a.token, { type: 'start' });
    for (let i = 0; i < 61; i++) {
      h.wait(10);
      await h.poll(a.code, a.token);
    }
    expect((await h.poll(a.code, a.token)).phase).toBe('ended');
    await expect(take()).rejects.toThrow(/only while the day is running/);
  });

  it('two players racing for the same role: exactly one gets it', async () => {
    const { h, code, b } = await gameWithLateJoiner(130);
    const c = await h.join(code, 'Cleo');
    const background = [];
    const options = { now: h.now, timeScale: TIME_SCALE, background: (p) => background.push(p) };
    const results = await Promise.allSettled(
      [b, c].map((p) =>
        performAction(code, p.token, { type: 'takeover', roleId: 'antony' }, options),
      ),
    );
    await Promise.all(background);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected').reason.message).toMatch(
      /already plays Mark Antony/,
    );
  });

  it('the recap is up to date even when nobody polled since the act changed', async () => {
    const { h, code, b } = await gameWithLateJoiner(115);
    h.wait(10); // Act 2 begins at 120; nothing has advanced the stored state since 115
    const view = await h.act(code, b.token, { type: 'takeover', roleId: 'antony' });
    expect(view.game.myRole.recap.happened).toMatch(/^Act 2, The House\. /);
  });

  it('ignores a recap sent by the client', async () => {
    const { h, code, b } = await gameWithLateJoiner(130);
    const view = await h.act(code, b.token, {
      type: 'takeover',
      roleId: 'antony',
      recap: { happened: 'forged', secret: 'forged', goal: 'forged' },
    });
    expect(view.game.myRole.recap.secret).toBe(card('antony').secret);
  });

  it('play again keeps the role you took over, without the old recap', async () => {
    const { h, code, a, b } = await gameWithLateJoiner(130);
    await h.act(code, b.token, { type: 'takeover', roleId: 'calpurnia' });
    for (let i = 0; i < 50; i++) {
      h.wait(10);
      await h.poll(code, a.token);
    }
    const ended = await h.poll(code, b.token);
    expect(ended.phase).toBe('ended');
    expect(ended.game.ending.reveal.find((r) => r.roleId === 'calpurnia').playedBy).toBe('Bob');

    const again = await h.act(code, b.token, { type: 'playAgain', gameId: ended.game.id });
    expect(again.you.roleId).toBe('calpurnia');
    expect(again.game.myRole.recap).toBeNull();
  });

  it("the recap prompt holds only the role's own secret and what it could see", async () => {
    const { code } = await gameWithLateJoiner(200);
    const { state } = await loadRoom(code);
    const { system, messages } = recapPrompt(state, scenario, 'antony', null, 200);
    const prompt = [system, ...messages.map((m) => m.content)].join('\n');
    expect(prompt).toContain(card('antony').secret);
    for (const role of scenario.roles.filter((r) => r.id !== 'antony')) {
      expect(prompt).not.toContain(role.secret);
    }
    expect(prompt).not.toContain('Caesar lay bleeding'); // Calpurnia's private narration
    expect(prompt).not.toContain('The knives are hidden'); // Brutus and Cassius only
    expect(prompt).toContain('Beware the Ides of March'); // public events are in
  });
});
