// The LLM adapter: provider selection, JSON validation with one retry, timeouts, and the
// non-LLM fallbacks every task falls back to. The real provider module is replaced by a fake.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const fake = vi.hoisted(() => ({ reply: async () => 'ok', calls: 0 }));
vi.mock('../server/llm/anthropic.js', () => ({
  anthropicComplete: async (request) => {
    fake.calls += 1;
    return fake.reply(request);
  },
}));

const { complete, completeJson, llmConfig } = await import('../server/llm/index.js');
const { aiDecision, rewriteLine, suggestLines, takeoverRecap } =
  await import('../server/ai/tasks.js');
const { getScenario } = await import('../server/scenarios.js');
const { tidyLine, tidyParagraph } = await import('../server/ai/text.js');
const { createMemoryStore } = await import('../server/store/memory.js');

const useFakeAnthropic = () => {
  process.env.LLM_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
};

beforeEach(async () => {
  fake.calls = 0;
  await createMemoryStore().clear();
});
afterEach(() => {
  process.env.LLM_PROVIDER = 'mock';
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.MODEL_FAST;
  delete process.env.LLM_DAILY_CAP;
  vi.unstubAllGlobals();
});

describe('provider selection', () => {
  it('uses mock when the provider is unset, unknown, or its key is missing', () => {
    expect(llmConfig({}).provider).toBe('mock');
    expect(llmConfig({ LLM_PROVIDER: 'anthropic' }).provider).toBe('mock');
    expect(llmConfig({ LLM_PROVIDER: 'gemini', ANTHROPIC_API_KEY: 'k' }).provider).toBe('mock');
    expect(llmConfig({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' })).toMatchObject({
      provider: 'anthropic',
      fast: 'claude-haiku-4-5-20251001',
      smart: 'claude-sonnet-5-5',
    });
    expect(llmConfig({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k' })).toMatchObject({
      provider: 'openai',
      fast: 'gpt-6-luna',
      smart: 'gpt-6.1-sol',
    });
    expect(llmConfig({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k', MODEL_SMART: 'x' }).smart).toBe(
      'x',
    );
  });

  it('asks OpenAI reasoning models (gpt-5 and later) for low effort, with room to think', async () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key-not-real';
    const bodies = [];
    vi.stubGlobal('fetch', async (url, init) => {
      bodies.push(JSON.parse(init.body));
      return Response.json({ choices: [{ message: { content: 'Hail, Caesar.' } }] });
    });
    const request = { system: 's', messages: [], tier: 'fast', maxTokens: 100, mock: () => '' };

    expect(await complete(request)).toBe('Hail, Caesar.');
    process.env.MODEL_FAST = 'gpt-4.1-mini'; // not a reasoning model
    await complete(request);

    expect(bodies[0]).toMatchObject({
      model: 'gpt-6-luna',
      reasoning_effort: 'low',
      max_completion_tokens: 1124,
    });
    expect(bodies[1]).toMatchObject({ model: 'gpt-4.1-mini', max_completion_tokens: 100 });
    expect(bodies[1]).not.toHaveProperty('reasoning_effort');
  });

  it("the mock provider runs the task's own deterministic mock", async () => {
    expect(await complete({ system: 's', messages: [], mock: () => 'canned' })).toBe('canned');
    expect(fake.calls).toBe(0);
  });
});

describe('completeJson', () => {
  const schema = z.object({ optionId: z.string() });

  it('accepts JSON wrapped in prose', async () => {
    useFakeAnthropic();
    fake.reply = async () => 'Here you go: {"optionId": "go"} — good luck';
    expect(await completeJson({ system: 's', messages: [], schema, mock: () => ({}) })).toEqual({
      optionId: 'go',
    });
  });

  it('retries once with a reminder, then gives up', async () => {
    useFakeAnthropic();
    const replies = ['not json', '{"optionId": "stay"}'];
    fake.reply = async () => replies.shift();
    expect(await completeJson({ system: 's', messages: [], schema, mock: () => ({}) })).toEqual({
      optionId: 'stay',
    });
    expect(fake.calls).toBe(2);

    fake.calls = 0;
    fake.reply = async () => 'still not json';
    await expect(
      completeJson({ system: 's', messages: [], schema, mock: () => ({}) }),
    ).rejects.toThrow(/valid JSON/);
    expect(fake.calls).toBe(2);
  });
});

describe('timeouts, caps and fallbacks', () => {
  it('a hanging call times out instead of stalling the game', async () => {
    useFakeAnthropic();
    fake.reply = () => new Promise(() => {}); // never answers
    const started = Date.now();
    await expect(
      complete({ system: 's', messages: [], timeoutMs: 50, mock: () => '' }),
    ).rejects.toThrow(/timed out/);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('stops calling the provider past the daily cap', async () => {
    useFakeAnthropic();
    process.env.LLM_DAILY_CAP = '2';
    fake.reply = async () => 'fine';
    await complete({ system: 's', messages: [], mock: () => '' });
    await complete({ system: 's', messages: [], mock: () => '' });
    await expect(complete({ system: 's', messages: [], mock: () => '' })).rejects.toThrow(
      /daily LLM cap/,
    );
    expect(fake.calls).toBe(2);
  });

  it('rewrite falls back to the original text; decisions fall back to the historical option', async () => {
    useFakeAnthropic();
    fake.reply = async () => {
      throw new Error('provider down');
    };
    const scenario = getScenario();
    expect(await rewriteLine(scenario, scenario.roleById.get('caesar'), 'I will go')).toBe(
      'I will go',
    );

    const state = {
      messages: [],
      game: {
        seed: 's',
        timeScale: 1,
        startedAt: 0,
        pausedMs: 0,
        acts: [{ id: 'house', variant: null, t: 120 }],
        roles: {
          caesar: {
            traits: { intelligence: 3, loyalty: 3, ambition: 5, lovestruck: 1, obedience: 1 },
          },
        },
      },
    };
    const task = { type: 'decide', decisionId: 'go_to_senate', roleId: 'caesar' };
    expect(await aiDecision(state, scenario, task, 280_000)).toEqual({ optionId: 'go', line: '' });
  });

  it("takeover recap: the model's three lines, or a recap built from the timeline", async () => {
    useFakeAnthropic();
    const scenario = getScenario();
    const state = {
      messages: [
        { id: 'm1', kind: 'narration', text: 'A messenger arrives.', visibleTo: 'all' },
        { id: 'm2', kind: 'narration', text: 'Calpurnia only.', visibleTo: ['calpurnia'] },
      ],
      game: { timeScale: 1, startedAt: 0, pausedMs: 0, acts: [{ id: 'house', variant: null }] },
    };
    fake.reply = async () =>
      '{"happened": "Caesar is leaving.", "secret": "You smell a plot.", "goal": "Stay at his side."}';
    expect(await takeoverRecap(state, scenario, 'antony', 200_000)).toEqual({
      happened: 'Caesar is leaving.',
      secret: 'You smell a plot.',
      goal: 'Stay at his side.',
    });

    fake.reply = async () => {
      throw new Error('provider down');
    };
    expect(await takeoverRecap(state, scenario, 'antony', 200_000)).toEqual({
      happened: 'Act 2, The House. A messenger arrives.', // not Calpurnia's private line
      secret: scenario.roleById.get('antony').secret,
      goal: scenario.roleById.get('antony').goal,
    });
  });

  it('suggestions: up to three tidy, distinct lines from the model, or scripted ones', async () => {
    useFakeAnthropic();
    const scenario = getScenario();
    const state = {
      messages: [],
      game: { seed: 's', timeScale: 1, startedAt: 0, pausedMs: 0, acts: [{ id: 'dawn' }] },
    };
    fake.reply = async () =>
      '{"lines": ["Brutus: Stay, friend.", "Stay, friend.", "\\"Rome waits.\\"", "One more.", "Too many."]}';
    expect(await suggestLines(state, scenario, 'antony', null, 5000)).toEqual([
      'Stay, friend.',
      'Rome waits.',
      'One more.',
    ]);

    fake.reply = async () => {
      throw new Error('provider down');
    };
    const scripted = await suggestLines(state, scenario, 'antony', null, 5000);
    expect(scripted).toHaveLength(3);
    const samples = scenario.roleById.get('antony').sampleLines;
    for (const line of scripted) expect(samples.some((s) => s.startsWith(line))).toBe(true);
  });

  it('keeps the quotes and colons that belong to a line', () => {
    const cry = 'In the street, a soothsayer cries out: "Beware the Ides of March."';
    expect(tidyLine(cry)).toBe(cry);
    expect(tidyLine('A messenger arrives: the Senate is waiting.')).toBe(
      'A messenger arrives: the Senate is waiting.',
    );
    expect(tidyLine('Hear me: Rome waits.')).toBe('Hear me: Rome waits.');
    expect(tidyLine('Mark Antony: Rome waits.')).toBe('Rome waits.');
    expect(tidyLine('“Rome waits.”')).toBe('Rome waits.');
    expect(tidyParagraph('He fell. "You too, my child?"')).toBe('He fell. "You too, my child?"');
    expect(tidyParagraph('"He fell at the foot of the statue."')).toBe(
      'He fell at the foot of the statue.',
    );
  });

  it('cleans a model line: no name label, no wrapping quotes, at most two sentences', async () => {
    useFakeAnthropic();
    fake.reply = async () =>
      '"Caesar: Rome waits. The Senate waits. The gods wait. Everyone waits."';
    const scenario = getScenario();
    expect(
      await rewriteLine(scenario, scenario.roleById.get('caesar'), 'everyone is waiting'),
    ).toBe('Rome waits. The Senate waits.');
  });
});
