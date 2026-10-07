// M5: Tab assist — three suggested lines (or three ways to say what you typed), said by index.

import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_SUGGESTIONS } from '../server/engine/applyAction.js';
import { suggestPrompt } from '../server/prompts/suggest.js';
import { loadRoom } from '../server/roomData.js';
import { getScenario } from '../server/scenarios.js';
import { harness, resetStore } from './harness.js';

beforeEach(resetStore);

const scenario = getScenario();

/** Alice plays `roleId` alone; a few seconds into the day. */
async function soloAs(roleId, options) {
  const h = harness(options);
  const a = await h.create('Alice');
  await h.act(a.code, a.token, { type: 'pickRole', roleId });
  await h.act(a.code, a.token, { type: 'start' });
  h.wait(5);
  await h.poll(a.code, a.token);
  return { h, code: a.code, a };
}

const mine = (view, playerId) =>
  view.messages.filter((m) => m.kind === 'speech' && m.playerId === playerId).at(-1);

describe('Tab assist', () => {
  it('suggests three in-character lines; picking one says it exactly as shown', async () => {
    const { h, code, a } = await soloAs('calpurnia');
    const { suggestions } = await h.actRaw(code, a.token, { type: 'suggest' });
    expect(suggestions).toHaveLength(3);
    const samples = scenario.roleById.get('calpurnia').sampleLines; // the mock's source
    for (const line of suggestions) expect(samples.some((s) => s.startsWith(line))).toBe(true);

    const view = await h.act(code, a.token, { type: 'say', suggestion: 1 });
    expect(mine(view, a.playerId)).toMatchObject({ text: suggestions[1], original: null });
  });

  it('turns what you typed into era-voice options, and remembers what you typed', async () => {
    const { h, code, a } = await soloAs('calpurnia');
    const typed = 'please stay home today';
    const { suggestions } = await h.actRaw(code, a.token, { type: 'suggest', text: typed });
    expect(suggestions.length).toBeGreaterThan(0);
    for (const line of suggestions) expect(line).toMatch(/I pray you stay home today/); // mock voice

    const view = await h.act(code, a.token, { type: 'say', suggestion: 0 });
    expect(mine(view, a.playerId)).toMatchObject({ text: suggestions[0], original: typed });
  });

  it('asking again shows other lines', async () => {
    const { h, code, a } = await soloAs('caesar');
    const first = (await h.actRaw(code, a.token, { type: 'suggest' })).suggestions;
    h.waitMs(3000);
    const second = (await h.actRaw(code, a.token, { type: 'suggest' })).suggestions;
    expect(second).not.toEqual(first);
  });

  it('is for players with a role, during the game, at most once every 3 seconds', async () => {
    const h = harness();
    const a = await h.create('Alice');
    const suggest = (token) => h.act(a.code, token, { type: 'suggest' });
    await expect(suggest(a.token)).rejects.toThrow(/for the game itself/);
    await h.act(a.code, a.token, { type: 'pickRole', roleId: 'brutus' });
    await h.act(a.code, a.token, { type: 'start' });
    const late = await h.join(a.code, 'Late'); // joined after the start: no role
    await expect(suggest(late.token)).rejects.toThrow(/Take over a character first/);

    await suggest(a.token);
    await expect(suggest(a.token)).rejects.toThrow(/Slow down/);
    h.waitMs(3000);
    await suggest(a.token);
  });

  it(`stops after ${MAX_SUGGESTIONS} requests in one game`, async () => {
    const { h, code, a } = await soloAs('brutus', { timeScale: 1 });
    for (let i = 0; i < MAX_SUGGESTIONS; i++) {
      await h.act(code, a.token, { type: 'suggest' });
      h.waitMs(3000);
    }
    await expect(h.act(code, a.token, { type: 'suggest' })).rejects.toThrow(/needs a rest/);
  });

  it('suggestions expire once you speak; a bad index is refused', async () => {
    const { h, code, a } = await soloAs('cassius');
    await h.act(code, a.token, { type: 'suggest' });
    const say = (suggestion) => h.act(code, a.token, { type: 'say', suggestion });
    await expect(say(7)).rejects.toThrow(/expired/);
    await expect(say('0')).rejects.toThrow(/expired/);
    await h.act(code, a.token, { type: 'say', text: 'I will speak for myself' });
    h.waitMs(2000); // anti-spam gap
    await expect(say(0)).rejects.toThrow(/expired/);
  });

  it('never shows stored suggestions in a view, not even your own', async () => {
    const { h, code, a } = await soloAs('antony');
    const { suggestions } = await h.actRaw(code, a.token, { type: 'suggest' });
    const json = JSON.stringify(await h.poll(code, a.token));
    expect(json).not.toContain('assist');
    for (const line of suggestions) expect(json).not.toContain(line);
  });

  it("the prompt holds only the speaker's own secret", async () => {
    const { code } = await soloAs('brutus');
    const { state } = await loadRoom(code);
    const { system, messages } = suggestPrompt(state, scenario, 'brutus', 'stall him', null, 5);
    const prompt = [system, ...messages.map((m) => m.content)].join('\n');
    expect(prompt).toContain(scenario.roleById.get('brutus').secret);
    expect(prompt).toContain('<intent>stall him</intent>');
    for (const role of scenario.roles.filter((r) => r.id !== 'brutus')) {
      expect(prompt).not.toContain(role.secret);
    }
  });
});
