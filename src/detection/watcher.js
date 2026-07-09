// @ts-check
/**
 * @file src/detection/watcher.js
 * Wires Slack message events to the pure heuristic and the ledger.
 *
 * Responsibilities:
 *   - Keep a rolling in-memory buffer of recent messages per channel.
 *   - On each message (and on a periodic sweep), build a HeuristicContext and
 *     run detection for channels we're watching.
 *   - When the pattern triggers and there is no active session for the channel,
 *     open an incident session and notify via onTrigger.
 *   - While a solo window is active, absorb bot pings into the session's
 *     pingsSilenced list so we can later show "N pings silenced".
 *
 * The heavy lifting (deciding whether the pattern is present) lives in the PURE
 * heuristic module; this file is the impure glue.
 *
 * @typedef {import('./heuristic.js').Message} Message
 */

import { evaluate } from './heuristic.js';

/**
 * Max messages retained per channel buffer. Old messages are dropped from the
 * front. Generous enough to cover a long solo run of chatter.
 */
const MAX_BUFFER = 500;

/** Sweep interval in ms — re-evaluate active channels on elapsed time. */
const SWEEP_MS = 60_000;

/**
 * Per-channel rolling state.
 * @typedef {Object} ChannelBuffer
 * @property {Message[]} messages
 * @property {Set<string>} optedIn
 */

/** @type {Map<string, ChannelBuffer>} */
const buffers = new Map();

/**
 * Channels dynamically opted into watching at runtime, in addition to any in
 * config.watchedChannels. Shared across the module.
 * @type {Set<string>}
 */
const dynamicallyWatched = new Set();

/**
 * Get (creating if needed) the buffer for a channel.
 * @param {string} channelId
 * @returns {ChannelBuffer}
 */
export function getBuffer(channelId) {
  let buf = buffers.get(channelId);
  if (!buf) {
    buf = { messages: [], optedIn: new Set() };
    buffers.set(channelId, buf);
  }
  return buf;
}

/**
 * Dynamically mark a channel as watched.
 * @param {string} channelId
 * @returns {void}
 */
export function watchChannel(channelId) {
  dynamicallyWatched.add(channelId);
  getBuffer(channelId); // ensure a buffer exists
}

/**
 * Compute the local hour for the on-call user from a config offset.
 * @param {number} now  ms epoch
 * @param {number} offsetHours  hours from UTC (e.g. -5 for US Eastern-ish)
 * @returns {number} 0..23
 */
function computeLocalHour(now, offsetHours) {
  const utcHour = new Date(now).getUTCHours();
  // Add offset, wrap into 0..23.
  return ((utcHour + Math.round(offsetHours)) % 24 + 24) % 24;
}

/**
 * Is this channel currently being watched (static config or dynamic set)?
 * @param {string} channelId
 * @param {{ watchedChannels?: string[] }} config
 * @returns {boolean}
 */
function isWatched(channelId, config) {
  if (dynamicallyWatched.has(channelId)) return true;
  const list = Array.isArray(config?.watchedChannels)
    ? config.watchedChannels
    : [];
  return list.includes(channelId);
}

/**
 * Build a HeuristicContext from a channel buffer.
 * @param {ChannelBuffer} buf
 * @param {number} now
 * @param {{ timezoneOffsetHours?: number }} config
 * @returns {import('./heuristic.js').HeuristicContext}
 */
function buildContext(buf, now, config) {
  const offset = Number.isFinite(config?.timezoneOffsetHours)
    ? /** @type {number} */ (config.timezoneOffsetHours)
    : 0;
  return {
    messages: buf.messages,
    now,
    localHour: computeLocalHour(now, offset),
  };
}

/**
 * Run detection for one channel and act on the result.
 * @param {string} channelId
 * @param {{ onTrigger: Function, ledger: any, config: any, client: any }} deps
 * @returns {void}
 */
function evaluateChannel(channelId, { onTrigger, ledger, config, client }) {
  if (!isWatched(channelId, config)) return;

  const buf = getBuffer(channelId);
  const now = Date.now();
  const context = buildContext(buf, now, config);
  const verdict = evaluate(context);

  const active = ledger.getActiveSessionForChannel(channelId);

  if (verdict.triggered && !active) {
    const { observed } = verdict;
    const session = ledger.createSession({
      channelId,
      userId: buf.messages.length
        ? buf.messages[buf.messages.length - 1].userId
        : 'unknown',
      // Backdate to when the solo grind actually began, so the morning
      // Canvas timeline and duration reflect the real night (not trigger time).
      startedAt: now - Math.round((observed.soloMinutes || 0) * 60000),
      status: 'intervened',
      soloMinutes: observed.soloMinutes,
      messageCount: observed.messageCount,
      pingsSilenced: [],
    });

    try {
      onTrigger({ session, observed, client });
    } catch (err) {
      console.log(
        `[watcher] onTrigger threw for channel ${channelId}:`,
        err && err.message ? err.message : err
      );
    }
  } else if (active) {
    // Keep the active session's live counters fresh from the latest verdict.
    ledger.updateSession(active.id, {
      soloMinutes: verdict.observed.soloMinutes,
      messageCount: verdict.observed.messageCount,
    });
  }
}

/**
 * Register the watcher on a Bolt app.
 *
 * @param {any} app  Bolt App instance.
 * @param {{ onTrigger: Function, ledger: any, config: any }} deps
 * @returns {{ stop: () => void }} handle allowing the sweep timer to be cleared
 */
export function registerWatcher(app, { onTrigger, ledger, config }) {
  const client = app?.client;

  // Subscribe to all messages.
  app.message(async ({ message }) => {
    // Ignore message subtypes we can't attribute (channel joins, edits, etc.)
    // but still capture bot messages — we need them for pingsSilenced.
    const channelId = message?.channel;
    if (!channelId) return;

    const isBot =
      Boolean(message?.bot_id) || message?.subtype === 'bot_message';

    /** @type {Message} */
    const normalized = {
      userId: message?.user || message?.bot_id || 'unknown',
      ts: typeof message?.ts === 'string' ? message.ts : String(message?.ts ?? ''),
      isBot,
      text: typeof message?.text === 'string' ? message.text : '',
    };

    const buf = getBuffer(channelId);
    buf.messages.push(normalized);
    if (buf.messages.length > MAX_BUFFER) {
      buf.messages.splice(0, buf.messages.length - MAX_BUFFER);
    }

    // If there's an active session and this is a bot ping, absorb it.
    const active = ledger.getActiveSessionForChannel(channelId);
    if (active && isBot) {
      const silenced = Array.isArray(active.pingsSilenced)
        ? active.pingsSilenced
        : [];
      if (!silenced.includes(normalized.ts)) {
        ledger.updateSession(active.id, {
          pingsSilenced: [...silenced, normalized.ts],
        });
      }
    }

    evaluateChannel(channelId, { onTrigger, ledger, config, client });
  });

  // Periodic sweep so triggers can fire on elapsed time alone (no new message
  // needed) — e.g. the solo gap crossing the threshold while all is quiet.
  const timer = setInterval(() => {
    const channels = new Set([
      ...dynamicallyWatched,
      ...(Array.isArray(config?.watchedChannels) ? config.watchedChannels : []),
    ]);
    for (const channelId of channels) {
      evaluateChannel(channelId, { onTrigger, ledger, config, client });
    }
  }, SWEEP_MS);

  // Don't let the sweep timer keep the process alive on its own.
  if (typeof timer.unref === 'function') timer.unref();

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
