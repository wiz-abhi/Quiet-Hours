/**
 * Quiet Hours — handoff note drafter.
 *
 * Turns the thread context around a lone late-night responder into a short,
 * warm, specific handoff note written in the tired engineer's voice. Tries the
 * configured LLM providers in order (Anthropic → Gemini → Cerebras); if no key
 * is set or every call fails, it returns a solid templated fallback built from
 * the thread context. Never throws.
 *
 * @module agent/handoff
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

/**
 * @typedef {import('../types.js').Observed} Observed
 */

/**
 * @typedef {Object} ThreadContext
 * @property {{ userId:string, ts:string, isBot:boolean, text:string }[]} messages
 * @property {string} source
 */

const DEFAULT_MODEL = 'claude-sonnet-5';
const MAX_WORDS = 120;

/**
 * Find the first human (non-bot) message with text in a thread.
 *
 * @param {ThreadContext} threadContext - The thread context.
 * @returns {{ userId:string, ts:string, isBot:boolean, text:string }|null}
 */
function firstHumanMessage(threadContext) {
  const messages = threadContext?.messages || [];
  return (
    messages.find((m) => m && !m.isBot && m.text && m.text.trim()) ||
    messages.find((m) => m && m.text && m.text.trim()) ||
    null
  );
}

/**
 * Build a solid, human templated handoff note without any LLM call.
 *
 * Extracts the first message + activity counts so the backup gets real
 * context even fully offline.
 *
 * @param {ThreadContext} threadContext - Thread context.
 * @param {Observed} observed - Observed activity snapshot.
 * @returns {string} A ready-to-post handoff note.
 */
export function templatedHandoffNote(threadContext, observed) {
  const messages = threadContext?.messages || [];
  const first = firstHumanMessage(threadContext);
  const opening =
    (first && first.text && first.text.trim()) ||
    (observed && observed.firstMessageText) ||
    'an incident I have been working solo';

  // Prefer the most informative status line for "what I've tried": an explicit
  // root-cause writeup if one exists, else the longest recent human message.
  const humans = messages.filter((m) => m && !m.isBot && m.text && m.text.trim());
  const rootCause = [...humans]
    .reverse()
    .find((m) => /root cause|rolled back|rollback|fix:/i.test(m.text));
  const substantive = [...humans]
    .reverse()
    .find((m) => m.text.trim().length > 60);
  const status = (rootCause || substantive)?.text?.trim();

  const msgCount =
    observed?.messageCount ??
    (threadContext?.messages || []).filter((m) => m && !m.isBot).length;
  const soloMin = observed?.soloMinutes ?? 0;

  const soloPhrase =
    soloMin >= 60
      ? `about ${Math.round(soloMin / 60)}h solo`
      : `${soloMin} min solo`;

  return [
    `Handing this off — I've been on it ${soloPhrase} (${msgCount} messages) and I need to sleep.`,
    `How it started: ${opening}`,
    status
      ? `Where it stands: ${status}`
      : `What I've tried: I've been digging through this alone; the thread above has the full trail of what I checked and ruled out.`,
    `Over to you — ping me in the morning if something's on fire, otherwise let me rest. Be kind to yourself on this one; it's a gnarly one to pick up cold.`,
  ].join('\n');
}

/**
 * Compact the thread into a short transcript for the model prompt.
 *
 * @param {ThreadContext} threadContext - Thread context.
 * @returns {string} Newline-joined "role: text" lines (most recent last).
 */
function renderTranscript(threadContext) {
  const messages = threadContext?.messages || [];
  return messages
    .filter((m) => m && m.text && m.text.trim())
    .slice(-20)
    .map((m) => `${m.isBot ? 'bot' : m.userId || 'responder'}: ${m.text.trim()}`)
    .join('\n');
}

/**
 * Build the shared system + user prompts for the handoff note.
 *
 * @param {ThreadContext} threadContext
 * @param {Observed} observed
 * @returns {{ system: string, userText: string }}
 */
function buildPrompts(threadContext, observed) {
  const transcript = renderTranscript(threadContext);
  const localHour =
    typeof observed?.localHour === 'number' ? observed.localHour : null;

  const system =
    `You are the tired on-call engineer writing a quick handoff note to a rested backup ` +
    `so you can finally sleep. Write in the FIRST PERSON, warm and human, plainspoken — ` +
    `not corporate. Cover, briefly: what's broken, what you've already tried, and where ` +
    `things stand. If the context suggests it, add ONE short "be kind to X" human note ` +
    `(a teammate, a customer, or the backup themselves). Hard limit: ${MAX_WORDS} words. ` +
    `Output only the note text — no preamble, no markdown headers.`;

  const userText =
    `Here is the thread I've been working` +
    (localHour !== null ? ` (my local time is around ${localHour}:00)` : '') +
    `:\n\n${transcript || '(no transcript captured)'}\n\n` +
    `Activity so far: ${observed?.messageCount ?? '?'} messages, ` +
    `${observed?.soloMinutes ?? '?'} minutes solo.\n\n` +
    `Write my handoff note.`;

  return { system, userText };
}

/**
 * Draft via the Anthropic Messages API.
 * @param {string} apiKey
 * @param {{ system: string, userText: string }} prompts
 * @returns {Promise<string>} note text ('' on empty response)
 */
async function draftWithAnthropic(apiKey, { system, userText }) {
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const response = await client.messages.create({
    model,
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: userText }],
  });
  return (response?.content || [])
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim();
}

/**
 * Draft via Google Gemini's native generateContent API. (The OpenAI-compat
 * layer rejects some AI-Studio key types that the native endpoint accepts.)
 *
 * @param {string} apiKey
 * @param {{ system: string, userText: string }} prompts
 * @returns {Promise<string>} note text ('' on empty response)
 */
async function draftWithGemini(apiKey, { system, userText }) {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { maxOutputTokens: 4000 },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`gemini HTTP ${res.status}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();
}

/**
 * Draft via any OpenAI-compatible chat-completions endpoint (Cerebras, etc.).
 * Uses global fetch — no extra deps.
 *
 * @param {{ url: string, apiKey: string, model: string, label: string }} provider
 * @param {{ system: string, userText: string }} prompts
 * @returns {Promise<string>} note text ('' on empty response)
 */
async function draftWithOpenAiCompat(provider, { system, userText }) {
  const res = await fetch(provider.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      // Generous cap: reasoning models (e.g. gpt-oss) spend tokens thinking
      // before emitting text; a tight cap yields an empty message.content.
      max_tokens: 4000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userText },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`${provider.label} HTTP ${res.status}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === 'string' ? text.trim() : '';
}

/**
 * The provider chain, in preference order. Each entry is included only when
 * its API key is present in the environment.
 * @returns {Array<{ label: string, draft: (p: {system:string,userText:string}) => Promise<string> }>}
 */
function availableProviders() {
  const chain = [];
  if (process.env.ANTHROPIC_API_KEY) {
    chain.push({
      label: 'anthropic',
      draft: (p) => draftWithAnthropic(process.env.ANTHROPIC_API_KEY, p),
    });
  }
  if (process.env.GEMINI_API_KEY) {
    chain.push({
      label: 'gemini',
      draft: (p) => draftWithGemini(process.env.GEMINI_API_KEY, p),
    });
  }
  if (process.env.CEREBRAS_API_KEY) {
    chain.push({
      label: 'cerebras',
      draft: (p) =>
        draftWithOpenAiCompat(
          {
            url: 'https://api.cerebras.ai/v1/chat/completions',
            apiKey: process.env.CEREBRAS_API_KEY,
            model: process.env.CEREBRAS_MODEL || 'gpt-oss-120b',
            label: 'cerebras',
          },
          p,
        ),
    });
  }
  return chain;
}

/**
 * Draft a short, warm, specific handoff note in the tired engineer's voice.
 * Tries each configured LLM provider in order (Anthropic → Gemini → Cerebras),
 * then falls back to the templated note. Never throws.
 *
 * @param {{ threadContext: ThreadContext, observed: Observed }} params
 * @returns {Promise<string>} The handoff note.
 */
export async function draftHandoffNote({ threadContext, observed }) {
  const prompts = buildPrompts(threadContext, observed);

  for (const provider of availableProviders()) {
    try {
      const text = await provider.draft(prompts);
      if (text) {
        console.log(`[handoff] note drafted via ${provider.label}`);
        return text;
      }
      console.log(`[handoff] ${provider.label} returned empty; trying next`);
    } catch (err) {
      console.log(
        `[handoff] ${provider.label} failed (${err?.message}); trying next`,
      );
    }
  }

  // No provider configured or all failed — the reliable templated note.
  return templatedHandoffNote(threadContext, observed);
}
