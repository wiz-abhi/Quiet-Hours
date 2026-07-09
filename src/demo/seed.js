// @ts-check
/**
 * @file src/demo/seed.js
 * Deterministic, replayable demo seeder for Quiet Hours.
 *
 * The judges and the demo video need the "1:47am, one person alone" trigger to
 * fire reliably every single time — with no waiting for three real hours to
 * pass. This module does two things:
 *
 *   1. `seedDemo(...)` posts the scripted "Meals on Rails" incident into a Slack
 *      channel as a fast, readable timeline so viewers see the story unfold.
 *   2. `buildHeuristicContextFromScript()` converts the same script into the
 *      detector's HeuristicContext shape with synthetic timestamps, so
 *      `/quiethours demo` can force a detection pass INSTANTLY and
 *      deterministically — the whole reason this slice exists.
 *
 * The only place the "2,300 meals" figure appears is inside Priya's own typed
 * worry in the script. It is never computed or reported by the agent.
 *
 * @typedef {Object} ScriptMessage
 * @property {'priya'|'monitorbot'|'system'} author
 * @property {boolean} isBot
 * @property {number} minutesFromStart  Minutes since 22:40 (message 0 = 22:40).
 * @property {string} text
 *
 * @typedef {import('../types.js').HeuristicContext} HeuristicContext
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * The wall-clock start of the incident, 22:40 the night before. We anchor the
 * synthetic timestamps to a fixed epoch so detection is fully deterministic and
 * does not depend on when the demo is actually run.
 *
 * 22:40 == 22 * 60 + 40 == 1360 minutes into the day.
 */
const INCIDENT_START_MS = Date.UTC(2024, 8, 12, 22, 40, 0);

/** userId used for Priya's (human) messages in the heuristic context. */
const PRIYA_USER_ID = 'priya';
/** userId used for monitor-bot's messages in the heuristic context. */
const MONITORBOT_USER_ID = 'monitorbot';

/**
 * Small await-able delay so we can pace postMessage calls and stay well under
 * Slack's per-channel rate limits during the demo.
 *
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Load and parse the incident script that ships next to this module.
 *
 * @returns {ScriptMessage[]} The ordered incident messages.
 */
export function loadScript() {
  const scriptPath = join(__dirname, 'incident-script.json');
  const raw = readFileSync(scriptPath, 'utf8');
  /** @type {ScriptMessage[]} */
  const parsed = JSON.parse(raw);
  return parsed;
}

/**
 * Render a message's simulated wall-clock time as "[HH:MM]".
 *
 * The incident starts at 22:40 and wraps past midnight, so we add the message's
 * `minutesFromStart` to 22:40 and let it roll over the day boundary.
 *
 * @param {number} minutesFromStart
 * @returns {string} e.g. "[22:40]", "[01:47]".
 */
function simulatedClock(minutesFromStart) {
  const startMinuteOfDay = 22 * 60 + 40; // 22:40
  const total = (startMinuteOfDay + minutesFromStart) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `[${pad(hh)}:${pad(mm)}]`;
}

/**
 * Post the scripted incident into a Slack channel as a fast, readable timeline.
 *
 * Messages are posted in order, each prefixed with its simulated clock time so
 * the recording reads as a real overnight timeline even though it plays out in
 * seconds. Bot lines are attributed to "monitor-bot" via the username override
 * (falling back to an inline label if the override is unavailable).
 *
 * @param {import('@slack/bolt').App} app - Bolt app (unused directly but part of
 *   the agreed signature so callers can pass it through).
 * @param {import('@slack/web-api').WebClient} client - Slack Web API client.
 * @param {string} channelId - Destination channel id.
 * @param {{ userId?: string }} [options] - Optional caller context.
 * @returns {Promise<{ posted: number, humanCount: number, botCount: number, channelId: string }>}
 *   Summary the caller uses to then force a detection pass.
 */
export async function seedDemo(app, client, channelId, { userId } = {}) {
  const script = loadScript();

  let posted = 0;
  let humanCount = 0;
  let botCount = 0;

  for (const msg of script) {
    const clock = simulatedClock(msg.minutesFromStart);
    const isBot = msg.isBot === true;

    /** @type {Record<string, unknown>} */
    const payload = {
      channel: channelId,
      text: `${clock} ${msg.text}`,
    };

    if (isBot) {
      // Attribute bot lines to "monitor-bot" so they read as automated alerts.
      payload.username = 'monitor-bot';
      payload.icon_emoji = ':rotating_light:';
    }

    try {
      await client.chat.postMessage(
        /** @type {import('@slack/web-api').ChatPostMessageArguments} */ (payload)
      );
    } catch (error) {
      // If the username/icon override is not permitted, retry with a plain,
      // inline-labelled fallback so the demo never dies mid-seed.
      if (isBot) {
        await client.chat.postMessage(
          /** @type {import('@slack/web-api').ChatPostMessageArguments} */ ({
            channel: channelId,
            text: `${clock} 🤖 monitor-bot: ${msg.text}`,
          })
        );
      } else {
        throw error;
      }
    }

    posted += 1;
    if (isBot) botCount += 1;
    else humanCount += 1;

    // Pace to keep the timeline readable on camera and away from rate limits.
    await delay(350);
  }

  return { posted, humanCount, botCount, channelId };
}

/**
 * Convert the incident script into the detector's HeuristicContext shape, with
 * synthetic timestamps anchored to a fixed 22:40 start.
 *
 * This is what lets `/quiethours demo` trigger the intervention deterministically
 * WITHOUT waiting ~3 real hours: `now` is pinned to the final message's
 * simulated time (~01:47), `localHour` is forced to 1, and every message carries
 * a Slack-style `ts` (seconds-with-fraction string) offset from the 22:40 start.
 *
 * @returns {HeuristicContext} Context ready to hand to `evaluate()`.
 */
export function buildHeuristicContextFromScript() {
  const script = loadScript();

  const messages = script.map((msg) => {
    const tsMs = INCIDENT_START_MS + msg.minutesFromStart * 60_000;
    return {
      userId: msg.isBot ? MONITORBOT_USER_ID : PRIYA_USER_ID,
      // Slack ts is seconds with fractional part, as a string.
      ts: (tsMs / 1000).toFixed(6),
      isBot: msg.isBot === true,
      text: msg.text,
    };
  });

  const lastOffsetMin = script.length
    ? script[script.length - 1].minutesFromStart
    : 0;
  const now = INCIDENT_START_MS + lastOffsetMin * 60_000;

  return {
    messages,
    now,
    // ~01:47 — small hours, inside the late-night window (< 6).
    localHour: 1,
  };
}
