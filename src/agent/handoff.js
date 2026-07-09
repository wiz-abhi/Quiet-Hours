/**
 * Quiet Hours — handoff note drafter.
 *
 * Turns the thread context around a lone late-night responder into a short,
 * warm, specific handoff note written in the tired engineer's voice. Uses the
 * Anthropic Messages API; if there's no API key or the call fails, it returns a
 * solid templated fallback built from the thread context. Never throws.
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
  const first = firstHumanMessage(threadContext);
  const opening =
    (first && first.text && first.text.trim()) ||
    (observed && observed.firstMessageText) ||
    'an incident I have been working solo';

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
    `What's going on: ${opening}`,
    `What I've tried: I've been digging through this alone; the thread above has the full trail of what I checked and ruled out.`,
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
 * Draft a short, warm, specific handoff note in the tired engineer's voice.
 *
 * @param {{ threadContext: ThreadContext, observed: Observed }} params
 * @returns {Promise<string>} The handoff note. Falls back to a templated note
 *   when there's no API key or the API call fails. Never throws.
 */
export async function draftHandoffNote({ threadContext, observed }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // No key — go straight to the reliable templated note.
  if (!apiKey) {
    return templatedHandoffNote(threadContext, observed);
  }

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

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

    const response = await client.messages.create({
      model,
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: userText }],
    });

    // Concatenate all text blocks from the response.
    const text = (response?.content || [])
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('')
      .trim();

    if (!text) {
      return templatedHandoffNote(threadContext, observed);
    }
    return text;
  } catch {
    // Any failure — network, auth, quota — falls back to the templated note.
    return templatedHandoffNote(threadContext, observed);
  }
}
