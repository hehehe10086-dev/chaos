// OpenAI Chat Completions over fetch (no extra dependency). The key comes from OPENAI_API_KEY.

// Reasoning models (gpt-5 and later, o-series) think before answering; low effort keeps short
// lines fast. Models that rejected reasoning_effort — retried without it and remembered.
const noEffort = new Set();
const usesEffort = (model) => /^(gpt-[5-9]|o\d)/.test(model) && !noEffort.has(model);

export async function openaiComplete({ model, system, messages, maxTokens, signal }) {
  const effort = usesEffort(model);
  const body = {
    model,
    messages: [{ role: 'system', content: system }, ...messages],
    // Reasoning tokens count toward the limit on reasoning models — leave headroom.
    max_completion_tokens: effort ? maxTokens + 1024 : maxTokens,
    ...(effort ? { reasoning_effort: 'low' } : {}),
  };
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 400 && effort) {
    noEffort.add(model);
    return openaiComplete({ model, system, messages, maxTokens, signal });
  }
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('empty response');
  return text;
}
