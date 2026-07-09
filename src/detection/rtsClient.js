// @ts-check
/**
 * @file src/detection/rtsClient.js
 * Fetch recent channel context for detection.
 *
 * Primary RTS path: Slack's Real-Time Search API (`assistant.search.context`,
 * GA 2026-02-17). With a bot token, every RTS call requires a short-lived
 * `action_token` captured from a triggering event payload — the watcher
 * captures these from message events and hands them to us. Bot tokens can only
 * RTS-search PUBLIC channel content (`search:read.public`).
 *
 * Fallback path: conversations.history / conversations.replies — always
 * available with our `channels:history` scope, and the right tool for "give me
 * the last N messages in this channel" when no fresh action token is in hand.
 *
 * Both paths are normalized into the same message shape so the heuristic never
 * has to care where the data came from.
 *
 * See docs/RTS_VERIFICATION.md for the full API verification (methods, scopes,
 * action_token lifecycle, response shapes).
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
 * Normalize a raw Slack message object (conversations.history/replies shape).
 * Defensive about the many optional fields Slack may or may not include.
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
 * Normalize an RTS (`assistant.search.context`) message result. RTS uses
 * different field names than conversations.history: `message_ts` / `content` /
 * `is_author_bot` / `author_user_id`.
 * @param {any} m
 * @returns {NormalizedMessage}
 */
function normalizeRtsMessage(m) {
  return {
    userId: m?.author_user_id || 'unknown',
    ts:
      typeof m?.message_ts === 'string'
        ? m.message_ts
        : String(m?.message_ts ?? ''),
    isBot: Boolean(m?.is_author_bot),
    text: typeof m?.content === 'string' ? m.content : '',
  };
}

/**
 * Fetch recent context for a channel (optionally a thread).
 *
 * @param {any} client  A Slack WebClient (app.client).
 * @param {string} channelId
 * @param {{ limit?: number, threadTs?: string|null, actionToken?: string|null }} [opts]
 *   `actionToken` — a fresh, short-lived RTS action token captured from an
 *   event payload. Required for bot-token RTS calls; when absent we go
 *   straight to the history path.
 * @returns {Promise<ThreadContext>}
 */
export async function fetchThreadContext(
  client,
  channelId,
  { limit = 100, threadTs = null, actionToken = null } = {}
) {
  // --- Attempt 1: RTS (assistant.search.context) — only when we hold a fresh
  //     action_token, since a bot token requires one. Public channels only. ---
  if (actionToken) {
    try {
      const result = await client.apiCall('assistant.search.context', {
        query: `in:<#${channelId}>`,
        action_token: actionToken,
        channel_types: 'public_channel',
        content_types: 'messages',
        sort: 'timestamp',
        limit: Math.min(limit, 20), // RTS hard-caps at 20 per page
        include_bots: true,
      });

      const matches = result?.messages || result?.results?.messages;
      if (result?.ok && Array.isArray(matches) && matches.length > 0) {
        const messages = matches.map(normalizeRtsMessage);
        console.log(
          `[rtsClient] Using source=rts (assistant.search.context) for channel ${channelId}: ${messages.length} messages.`
        );
        return { messages, source: 'rts' };
      }
      console.log(
        `[rtsClient] assistant.search.context returned no usable matches for ${channelId}; falling back to history.`
      );
    } catch (err) {
      const msg = err?.data?.error || err?.message || String(err);
      console.log(
        `[rtsClient] assistant.search.context failed for ${channelId} (${msg}); falling back to history.`
      );
    }
  }

  // --- Attempt 2 (primary when no fresh token): conversations.history/replies. ---
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
