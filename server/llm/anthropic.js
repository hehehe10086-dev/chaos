// Claude via the official Anthropic SDK. The key comes from ANTHROPIC_API_KEY.

import Anthropic from '@anthropic-ai/sdk';

let client;

// Models that rejected output_config.effort — retried without it and remembered.
const noEffort = new Set();

// Haiku 4.5 (and pre-4.6 models) take no effort setting; newer models think adaptively,
// so we ask for low effort to keep short lines fast.
const usesEffort = (model) => !/haiku|-3-|-4-[0-5]\b|-4-0/.test(model) && !noEffort.has(model);

export async function anthropicComplete({ model, system, messages, maxTokens, signal, timeoutMs }) {
  client ??= new Anthropic({ maxRetries: 0 });
  const effort = usesEffort(model);
  const params = {
    model,
    // On models that think, thinking tokens count toward max_tokens — leave headroom.
    max_tokens: effort ? maxTokens + 1024 : maxTokens,
    // The system prompt is stable for a character within a game, so it can be cached.
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages,
    ...(effort ? { output_config: { effort: 'low' } } : {}),
  };

  let response;
  try {
    response = await client.messages.create(params, { signal, timeout: timeoutMs });
  } catch (error) {
    if (effort && error instanceof Anthropic.BadRequestError) {
      noEffort.add(model);
      return anthropicComplete({ model, system, messages, maxTokens, signal, timeoutMs });
    }
    throw error;
  }

  if (response.stop_reason === 'refusal') throw new Error('the model declined this request');
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
  if (!text) throw new Error(`empty response (stop_reason: ${response.stop_reason})`);
  return text;
}
