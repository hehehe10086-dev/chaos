// LLM adapter. One interface for every provider:
//   complete({ system, messages, tier, maxTokens, mock })      -> text
//   completeJson({ system, messages, tier, maxTokens, schema, mock }) -> validated object
// Provider: LLM_PROVIDER = anthropic | openai | mock. Unset, unknown, or missing key -> mock.
// The mock provider calls the task's own `mock()` function, which returns deterministic,
// in-character output — so the whole game and all tests run offline.
// Every real call has a timeout; callers always have a non-LLM fallback for failures.

import { getStore } from '../store/index.js';
import { anthropicComplete } from './anthropic.js';
import { openaiComplete } from './openai.js';

export const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_DAILY_CAP = 3000;

// Checked against the providers' model docs on 2026-10-06 (see README "Add an API key").
export const DEFAULT_MODELS = {
  anthropic: { fast: 'claude-haiku-4-5-20251001', smart: 'claude-sonnet-5-5' },
  openai: { fast: 'gpt-6-luna', smart: 'gpt-6.1-sol' },
};

export class LlmError extends Error {}

/** Which provider and models are in use (read from env on every call, so .env edits apply). */
export function llmConfig(env = process.env) {
  const requested = (env.LLM_PROVIDER ?? '').trim().toLowerCase();
  const keys = { anthropic: env.ANTHROPIC_API_KEY, openai: env.OPENAI_API_KEY };
  const provider = keys[requested] ? requested : 'mock';
  const models = DEFAULT_MODELS[provider] ?? { fast: 'mock', smart: 'mock' };
  return {
    provider,
    requested: requested || null,
    fast: provider === 'mock' ? 'mock' : env.MODEL_FAST || models.fast,
    smart: provider === 'mock' ? 'mock' : env.MODEL_SMART || models.smart,
  };
}

/** Counts real LLM calls per day (all rooms) and refuses past LLM_DAILY_CAP. */
async function spendBudget() {
  const cap = Number(process.env.LLM_DAILY_CAP) || DEFAULT_DAILY_CAP;
  let used = 0;
  try {
    used = await getStore().incr(`llm:${new Date().toISOString().slice(0, 10)}`);
  } catch {
    return; // never block the game because the counter is unavailable
  }
  if (used > cap) throw new LlmError(`daily LLM cap (${cap}) reached`);
}

function withTimeout(promise, ms, controller) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new LlmError(`timed out after ${ms} ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * @param {{system: string, messages: {role: 'user'|'assistant', content: string}[],
 *          tier?: 'fast'|'smart', maxTokens?: number, timeoutMs?: number,
 *          mock: () => string | Promise<string>}} request
 */
export async function complete({
  system,
  messages,
  tier = 'fast',
  maxTokens = 300,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  mock,
}) {
  const config = llmConfig();
  if (config.provider === 'mock') return mock();
  await spendBudget();
  const model = tier === 'smart' ? config.smart : config.fast;
  const call = config.provider === 'anthropic' ? anthropicComplete : openaiComplete;
  const controller = new AbortController();
  return withTimeout(
    call({ model, system, messages, maxTokens, signal: controller.signal, timeoutMs }),
    timeoutMs,
    controller,
  );
}

/** Pulls the first {...} object out of a reply (models sometimes wrap JSON in prose or fences). */
export function parseJsonLoose(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/**
 * Like complete(), but the reply must be JSON matching `schema` (zod). Retries once with a
 * reminder; throws LlmError if the second reply is still invalid.
 * @param {{schema: import('zod').ZodType, mock: () => object | Promise<object>} & object} request
 */
export async function completeJson({ schema, mock, messages, ...rest }) {
  if (llmConfig().provider === 'mock') return schema.parse(await mock());
  let attempt = messages;
  for (let i = 0; i < 2; i++) {
    const text = await complete({ ...rest, messages: attempt, mock });
    const result = schema.safeParse(parseJsonLoose(text));
    if (result.success) return result.data;
    attempt = [
      ...messages,
      { role: 'assistant', content: text },
      {
        role: 'user',
        content:
          'That was not valid. Reply again with ONLY the JSON object, in the exact format requested.',
      },
    ];
  }
  throw new LlmError('the model did not return valid JSON');
}
