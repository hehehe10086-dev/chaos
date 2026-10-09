// LLM tasks. Each one: build the prompt, call the adapter (with a deterministic mock),
// clean the output — and on any failure return a non-LLM fallback. Nothing here throws.

import { z } from 'zod';
import { currentAct, gameTime, personaChoice } from '../engine/game.js';
import { shuffled } from '../engine/random.js';
import { complete, completeJson } from '../llm/index.js';
import { agentPrompt, decisionPrompt } from '../prompts/agent.js';
import { deathPoemPrompt, epiloguePrompt } from '../prompts/epilogue.js';
import { recapPrompt } from '../prompts/recap.js';
import { rewritePrompt } from '../prompts/rewrite.js';
import { suggestPrompt } from '../prompts/suggest.js';
import { leadingVocative, lowerFirst, mockRewrite, opensWithAddress } from './mockStyle.js';
import { parsePoem, tidyLine, tidyParagraph } from './text.js';

function warn(task, error) {
  console.warn(`[ai] ${task} failed, using fallback: ${error?.message ?? error}`);
}

/** Player line → era voice. Fallback: the original text. */
export async function rewriteLine(scenario, role, text) {
  try {
    const { system, messages } = rewritePrompt(scenario, role, text);
    const out = await complete({
      system,
      messages,
      tier: 'fast',
      maxTokens: 160,
      mock: () => mockRewrite(scenario, role, text),
    });
    return tidyLine(out) || text;
  } catch (error) {
    warn('rewrite', error);
    return text;
  }
}

/**
 * A scripted in-character line, cycling through the role's sampleLines without repeats.
 * When replying to someone, skips lines that are addressed to a third character.
 */
export function sampleLine(state, scenario, roleId, replyingTo = null) {
  const role = scenario.roleById.get(roleId);
  const order = shuffled(state.game.seed, `lines:${roleId}`, role.sampleLines);
  const start = state.game.agents[roleId].lines;
  for (let k = 0; k < order.length; k++) {
    const line = order[(start + k) % order.length];
    const addressee = leadingVocative(scenario, line);
    if (!replyingTo || !addressee || addressee === replyingTo) return line;
  }
  return order[start % order.length];
}

function mockSpeech(state, scenario, task) {
  const replyTo = task.replyTo && state.messages.find((m) => m.id === task.replyTo);
  const asker = replyTo?.roleId && replyTo.roleId !== task.roleId ? replyTo.roleId : null;
  let speech = sampleLine(state, scenario, task.roleId, asker);

  // A line that already addresses someone ("Brutus, ...") is aimed at them.
  const vocative = leadingVocative(scenario, speech);
  if (vocative) return { speech, to: vocative === task.roleId ? 'all' : vocative };
  if (asker && !opensWithAddress(speech)) {
    const name = scenario.roleById.get(asker).shortName;
    if (!speech.includes(name)) speech = `${name}, ${lowerFirst(scenario, speech)}`;
  }
  return { speech, to: asker ?? 'all' };
}

const SpeechSchema = z.object({
  speech: z.string().trim().min(1).max(600),
  to: z.string().optional().default('all'),
});

/** An AI character's next line. Fallback: a scripted line from the scenario. */
export async function agentLine(state, scenario, task, now) {
  const game = state.game;
  const mock = () => mockSpeech(state, scenario, task);
  try {
    const { system, messages } = agentPrompt(
      state,
      scenario,
      currentAct(scenario, game),
      gameTime(game, now),
      task,
    );
    const out = await completeJson({
      system,
      messages,
      tier: 'smart',
      maxTokens: 220,
      schema: SpeechSchema,
      mock,
    });
    const speech = tidyLine(out.speech);
    return speech ? { speech, to: out.to } : mock();
  } catch (error) {
    warn('agent line', error);
    return mock();
  }
}

const DecisionSchema = z.object({
  optionId: z.string(),
  line: z.string().trim().max(400).optional().default(''),
});

/** An AI character's decision. Mock: persona-weighted. Fallback: the historical option. */
export async function aiDecision(state, scenario, task, now) {
  const game = state.game;
  const decision = scenario.decisionById.get(task.decisionId);
  const mock = () => ({ optionId: personaChoice(scenario, game, decision.id), line: '' });
  try {
    const { system, messages } = decisionPrompt(
      state,
      scenario,
      currentAct(scenario, game),
      gameTime(game, now),
      decision,
    );
    const out = await completeJson({
      system,
      messages,
      tier: 'smart',
      maxTokens: 200,
      schema: DecisionSchema,
      mock,
    });
    if (!decision.options.some((o) => o.id === out.optionId))
      throw new Error(`unknown option "${out.optionId}"`);
    return { optionId: out.optionId, line: tidyLine(out.line, { maxSentences: 1 }) };
  } catch (error) {
    warn('decision', error);
    return { optionId: decision.historicalOptionId, line: '' };
  }
}

/**
 * Tab assist without the LLM: three of the role's scripted lines (`salt` = how many times the
 * player has asked, so asking again shows others), or mock era-voice phrasings of an intention.
 */
export function mockSuggestions(state, scenario, roleId, intent, salt = 0) {
  const role = scenario.roleById.get(roleId);
  const lines = intent
    ? [0, 1, 2].map((variant) => mockRewrite(scenario, role, intent, variant))
    : shuffled(state.game.seed, `suggest:${roleId}:${salt}`, role.sampleLines).slice(0, 3);
  return [...new Set(lines.map((line) => tidyLine(line, { maxChars: 220 })))];
}

const SuggestSchema = z.object({ lines: z.array(z.string()).min(1).max(6) });

/** Up to three lines the player could say next (or ways to say `intent`). Fallback: the mock. */
export async function suggestLines(state, scenario, roleId, intent, now, salt = 0) {
  const fallback = () => mockSuggestions(state, scenario, roleId, intent, salt);
  try {
    const game = state.game;
    const { system, messages } = suggestPrompt(
      state,
      scenario,
      roleId,
      intent,
      currentAct(scenario, game),
      gameTime(game, now),
    );
    const out = await completeJson({
      system,
      messages,
      tier: 'fast',
      maxTokens: 300,
      schema: SuggestSchema,
      mock: () => ({ lines: fallback() }),
    });
    const lines = [...new Set(out.lines.map((line) => tidyLine(line, { maxChars: 220 })))]
      .filter(Boolean)
      .slice(0, 3);
    return lines.length ? lines : fallback();
  } catch (error) {
    warn('suggestions', error);
    return fallback();
  }
}

/** A takeover recap without the LLM: where the day is, the latest events this role saw, its card. */
export function fallbackRecap(state, scenario, roleId) {
  const role = scenario.roleById.get(roleId);
  const act = currentAct(scenario, state.game);
  const seen = state.messages.filter(
    (m) => m.kind === 'narration' && (m.visibleTo === 'all' || m.visibleTo.includes(roleId)),
  );
  const latest = seen
    .slice(-2)
    .map((m) => m.text)
    .join(' ');
  const where = act ? `Act ${act.number}, ${act.title}.` : 'The day is beginning.';
  return {
    happened: `${where} ${latest || 'Nothing has happened yet.'}`,
    secret: role.secret,
    goal: role.goal,
  };
}

const RecapSchema = z.object({
  happened: z.string().trim().min(1).max(800),
  secret: z.string().trim().min(1).max(800),
  goal: z.string().trim().min(1).max(800),
});

/** "Previously…" for a player who takes a role over mid-game. Fallback: fallbackRecap(). */
export async function takeoverRecap(state, scenario, roleId, now) {
  const fallback = () => fallbackRecap(state, scenario, roleId);
  try {
    const game = state.game;
    const { system, messages } = recapPrompt(
      state,
      scenario,
      roleId,
      currentAct(scenario, game),
      gameTime(game, now),
    );
    const out = await completeJson({
      system,
      messages,
      tier: 'fast',
      maxTokens: 350,
      schema: RecapSchema,
      mock: fallback,
    });
    // Limits are a safety net for runaway output; the prompt asks for two sentences each.
    const recap = {
      happened: tidyLine(out.happened, { maxSentences: 6, maxChars: 420 }),
      secret: tidyLine(out.secret, { maxSentences: 3, maxChars: 280 }),
      goal: tidyLine(out.goal, { maxSentences: 3, maxChars: 280 }),
    };
    return recap.happened && recap.secret && recap.goal ? recap : fallback();
  } catch (error) {
    warn('takeover recap', error);
    return fallback();
  }
}

/** Epilogue + death poem. Missing pieces (null) fall back to the scenario's text. */
export async function endingText(state, scenario) {
  const ending = scenario.endings.find((e) => e.id === state.game.ending.id);
  const wantsPoem = Boolean(ending.fallbackDeathPoem && scenario.meta.deathPoem);

  const epilogue = (async () => {
    try {
      const { system, messages } = epiloguePrompt(state, scenario, ending);
      const out = await complete({
        system,
        messages,
        tier: 'smart',
        maxTokens: 400,
        mock: () => ending.fallbackEpilogue,
      });
      return tidyParagraph(out) || null;
    } catch (error) {
      warn('epilogue', error);
      return null;
    }
  })();

  const deathPoem = (async () => {
    if (!wantsPoem) return null;
    try {
      const { system, messages } = deathPoemPrompt(state, scenario, ending);
      const out = await complete({
        system,
        messages,
        tier: 'smart',
        maxTokens: 120,
        mock: () => ending.fallbackDeathPoem.join('\n'),
      });
      return parsePoem(out);
    } catch (error) {
      warn('death poem', error);
      return null;
    }
  })();

  return { epilogue: await epilogue, deathPoem: await deathPoem };
}
