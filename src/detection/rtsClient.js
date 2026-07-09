// @ts-check
/**
 * @file src/detection/rtsClient.js
 * Fetch recent channel context for detection.
 *
 * Prefers Slack's Real-Time Search (search.messages) so we can pull the most
 * recent activity for a channel in one shot; falls back to
 * conversations.history / conversations.replies when search is unavailable
 * (missing scope, non-Enterprise workspace, transient error, etc.).
 *
 * Both paths are normalized into the same message shape so the heuristic never
 * has to care where the data came from.
 *
 * @typedef {Object} NormalizedMessage
 * @property {string} userId
 * @property {string} ts
 * @property {boolean} isBot
 * @property {string} text
 *
 * @typedef {Object} ThreadContext
 * @property {NormalizedMessage[]} messages
 * @property {'rts'|'history'} source
 */

/**
 * Normalize a raw Slack message object into our shape. Defensive about the
 * many optional fields Slack may or may not include.
 * @param {any} msg
 * @returns {NormalizedMessage}
 */
function normalizeMessage(msg) {
  const isBot = Boolean(msg?.bot_id) || msg?.subtype === 'bot_message';
  return {
    userId: msg?.user || msg?.bot_id || 'unknown',
    ts: typeof msg?.ts === 'string' ? msg.ts : String(msg?.ts ?? ''),
    isBot,
    text: typeof msg?.text === 'string' ? msg.text : '',
  };
}

/**
 * Fetch recent context for a channel (optionally a thread).
 *
 * @param {any} client  A Slack WebClient (app.client).
 * @param {string} channelId
 * @param {{ limit?: number, threadTs?: string|null }} [opts]
 * @returns {Promise<ThreadContext>}
 */
export async function fetchThreadContext(
  client,
  channelId,
  { limit = 100, threadTs = null } = {}
) {
  // --- Attempt 1: Real-Time Search (search.messages) scoped to the channel. ---
  try {
    const result = await client.apiCall('search.messages', {
      // Scope the query to the channel; sort newest first.
      query: `in:<#${channelId}>`,
      count: limit,
      sort: 'timestamp',
      sort_dir: 'desc',
    });

    if (result && result.ok) {
      const matches = result?.messages?.matches;
      if (Array.isArray(matches) && matches.length > 0) {
        const messages = matches.map(normalizeMessage);
        console.log(
          `[rtsClient] Using source=rts (search.messages) for channel ${channelId}: ${messages.length} messages.`
        );
        return { messages, source: 'rts' };
      }
    }
    // ok:false or no matches — fall through to history.
    console.log(
      `[rtsClient] search.messages returned no usable matches for channel ${channelId}; falling back to history.`
    );
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.log(
      `[rtsClient] search.messages failed for channel ${channelId} (${msg}); falling back to history.`
    );
  }

  // --- Attempt 2: conversations.history / conversations.replies. ---
  try {
    let raw;
    if (threadTs) {
      const res = await client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        limit,
      });
      raw = res?.messages;
    } else {
      const res = await client.conversations.history({
        channel: channelId,
        limit,
      });
      raw = res?.messages;
    }

    const messages = Array.isArray(raw) ? raw.map(normalizeMessage) : [];
    console.log(
      `[rtsClient] Using source=history (${
        threadTs ? 'conversations.replies' : 'conversations.history'
      }) for channel ${channelId}: ${messages.length} messages.`
    );
    return { messages, source: 'history' };
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.log(
      `[rtsClient] history fallback also failed for channel ${channelId} (${msg}); returning empty context.`
    );
    return { messages: [], source: 'history' };
  }
}
