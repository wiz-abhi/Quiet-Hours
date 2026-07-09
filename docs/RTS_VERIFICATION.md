# RTS (Real-Time Search) API Verification

**Date:** 2026-07-10
**Verdict:** ❌ **INCORRECT** — our RTS integration targets a legacy, user-token-only method (`search.messages`) with a bot scope (`search:read`) that Slack does not grant to bot tokens. The primary "RTS" path in `src/detection/rtsClient.js` cannot succeed with our Socket Mode bot token; it fails silently and always falls back to `conversations.history`.
**Confidence:** High (verified against current docs.slack.dev, July 2026).

---

## 1. What the real RTS API is (July 2026)

The **Real-Time Search (RTS) API** went GA on **2026-02-17** (limited release Oct 2025). It is **not** `search.messages`. It consists of two methods:

| Method | Purpose |
| --- | --- |
| `assistant.search.context` | Search messages / files / channels / users across the workspace. |
| `assistant.search.info` | Return the search capabilities for a team. |

### Scopes (this is the critical part)

`search:read` is a **legacy scope** and is **`User`-token-only**. It supports `search.all`, `search.files`, `search.messages`. Slack explicitly recommends **not** using it and moving to the granular RTS scopes.

RTS granular scopes:

| Scope | Bot token? | User token? |
| --- | --- | --- |
| `search:read.public` | ✅ | ✅ |
| `search:read.files` | ✅ | ✅ |
| `search:read.users` | ✅ | ✅ |
| `search:read.private` | ❌ | ✅ |
| `search:read.mpim` | ❌ | ✅ |
| `search:read.im` | ❌ | ✅ |

> "To use the Real-time Search API to fetch private conversation data or to use it outside the Slack client, a user token is required."

So a **bot token** can only reach **public** channel content via RTS. Private channels (`groups`), MPIMs, and DMs require a **user token**.

### The `action_token` (required for bot tokens)

Every RTS call made with a **bot token** requires a short-lived **`action_token`** obtained from a triggering event payload. User-token calls do not need it.

- The app must subscribe to at least one of: `app_mention`, `message.channels`, `message.groups`, `message.im`, `message.mpim`.
- The token arrives in the event payload (docs show it nested under an `assistant_thread` object, e.g. `{ "assistant_thread": { "action_token": "1234567.abcdefg" } }`; for app_mention it is in the mention payload).
- It is **short-lived** — must be used promptly after receipt, per-event. This is a poor fit for our background `watcher.js` polling loop, which fires on a timer, not on a fresh inbound event.

### Socket Mode / sandbox

- The docs do **not** state any Socket Mode incompatibility. The `action_token` comes from **event payloads**, which Socket Mode delivers normally, so Socket Mode is not inherently blocked — but you must capture the token from a live event and pass it within its short lifetime.
- The docs do **not** confirm free/sandbox availability or plan tier. Given the enterprise-oriented rollout (MCP + RTS, "approved by an admin," admin-granted private scopes), **assume RTS may be unavailable in a plain dev sandbox** and design the fallback to be the real code path for the demo.

### Request / response shape (`assistant.search.context`)

Request (key params):
```
query                    (required) e.g. "in:<#C123> incident"
action_token             (required with a bot token)
channel_types            "public_channel,private_channel,mpim,im" (default public_channel)
content_types            "messages,files,channels,users"          (default messages)
limit                    max 20 per page (default 20)   ← note the 20 cap
cursor                   pagination
sort                     "score" | "timestamp" (default score)
include_context_messages boolean
before / after           unix ts filters
include_bots             boolean
disable_semantic_search  boolean (keyword-only)
```

Response `messages[]` fields (different names than `search.messages`):
```
author_name, author_user_id, team_id, channel_id, channel_name,
message_ts, content, is_author_bot, permalink, blocks,
context_messages: { before: [...], after: [...] }
```

Note: it returns **`message_ts`/`content`/`is_author_bot`**, NOT `ts`/`text`/`bot_id`. Our `normalizeMessage()` reads `msg.text`, `msg.ts`, `msg.user`, `msg.bot_id` — none of these exist on an RTS result, so even if the call succeeded, every normalized message would be blank/`unknown`.

---

## 2. What our code calls today

`src/detection/rtsClient.js` (line ~56):
```js
const result = await client.apiCall('search.messages', {
  query: `in:<#${channelId}>`,
  count: limit,
  sort: 'timestamp',
  sort_dir: 'desc',
});
```

`manifest.json` bot scopes include `"search:read"`.

### Why this fails silently

1. **`search.messages` is not the RTS API** — it is the legacy search method.
2. **`search.messages` requires a `User` token + `search:read`.** Our app runs Socket Mode with a **bot token (`xoxb`)**. Calling `search.messages` with a bot token returns `not_allowed_token_type` / `missing_scope`.
3. **`search:read` is invalid as a bot scope.** Slack scopes it to user tokens only; requesting it on the bot array is at best ignored, and does not enable `search.messages` for the bot token.
4. The `try/catch` in `fetchThreadContext` swallows the error and logs "falling back to history," so **the app silently runs on `conversations.history` 100% of the time**. Functionally the app still works (history fallback is fine), but the "RTS" branch is dead code and the `source: 'rts'` path is never exercised. Any claim of "RTS integration" in the submission is currently inaccurate.

---

## 3. Exact changes needed

### 3a. Manifest scope changes (`manifest.json`)

- **Remove** `"search:read"` from `oauth_config.scopes.bot` (invalid for bot tokens).
- **Add** the bot-compatible RTS scope(s):
  - `"search:read.public"` (required — the only channel-content RTS scope a bot token can use)
  - optionally `"search:read.users"` (only if you resolve users via RTS)
- **Note:** a bot token **cannot** RTS-search private channels / DMs. Our detection targets an incident channel; if that channel may be **private**, RTS won't cover it with a bot token and you'd need a **user token + `search:read.private`** (a separate `xoxp` install), or just keep the `conversations.history` path.

```jsonc
"bot": [
  "app_mentions:read",
  "assistant:write",
  "canvases:write",
  "channels:history",
  "channels:read",
  "chat:write",
  "commands",
  "groups:history",
  "im:history",
  "im:write",
  "search:read.public",   // ← replaces "search:read"
  "users:read"
]
```

### 3b. Code changes (`src/detection/rtsClient.js`)

Two blockers make a *correct* bot-token RTS call impractical for our current architecture:

1. **`action_token` is per-event and short-lived.** Our watcher polls on a timer and has no fresh event token in hand, so it usually has nothing valid to pass.
2. **20-result cap + public-only + semantic ranking** make RTS a worse fit than `conversations.history` for "give me the last N messages in this channel," which is exactly what the heuristic wants.

**Recommendation:** treat `conversations.history` as the **primary** path (it already works and is the right tool for recent-channel-context), and make RTS an **optional, opt-in** path that is only attempted when we actually hold a fresh `action_token`. Below is a corrected implementation that (a) uses the real method, (b) passes `action_token`, (c) sets `channel_types: 'public_channel'`, and (d) normalizes the real RTS response fields.

```js
/**
 * Normalize an RTS (assistant.search.context) message result.
 * RTS uses different field names than conversations.history.
 * @param {any} m
 * @returns {NormalizedMessage}
 */
function normalizeRtsMessage(m) {
  return {
    userId: m?.author_user_id || 'unknown',
    ts: typeof m?.message_ts === 'string' ? m.message_ts : String(m?.message_ts ?? ''),
    isBot: Boolean(m?.is_author_bot),
    text: typeof m?.content === 'string' ? m.content : '',
  };
}

/**
 * @param {any} client
 * @param {string} channelId
 * @param {{ limit?: number, threadTs?: string|null, actionToken?: string|null }} [opts]
 * @returns {Promise<ThreadContext>}
 */
export async function fetchThreadContext(
  client,
  channelId,
  { limit = 100, threadTs = null, actionToken = null } = {}
) {
  // --- Attempt 1: RTS (assistant.search.context) — ONLY if we hold a fresh
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

  // --- Attempt 2 (primary in practice): conversations.history / replies. ---
  try {
    let raw;
    if (threadTs) {
      const res = await client.conversations.replies({ channel: channelId, ts: threadTs, limit });
      raw = res?.messages;
    } else {
      const res = await client.conversations.history({ channel: channelId, limit });
      raw = res?.messages;
    }
    const messages = Array.isArray(raw) ? raw.map(normalizeMessage) : [];
    console.log(
      `[rtsClient] Using source=history (${threadTs ? 'conversations.replies' : 'conversations.history'}) for ${channelId}: ${messages.length} messages.`
    );
    return { messages, source: 'history' };
  } catch (err) {
    const msg = err?.message || String(err);
    console.log(`[rtsClient] history fallback also failed for ${channelId} (${msg}); returning empty context.`);
    return { messages: [], source: 'history' };
  }
}
```

The caller (`watcher.js`) would need to thread through an `actionToken` captured from the most recent qualifying event for that channel. If that plumbing is out of scope for the hackathon, the honest option is: **drop the RTS branch entirely, rely on `conversations.history`, and describe detection as "live channel history" rather than "RTS."**

---

## 4. One-line bottom line

Our RTS integration is **wrong on both the method and the scope**; the single most important change is to **replace the legacy user-only `search.messages` / `search:read` with the real `assistant.search.context` method + bot scope `search:read.public` (and pass a fresh `action_token`)** — or, more honestly for a Socket-Mode hackathon build, stop calling it "RTS" and lean on the `conversations.history` fallback that is already the only path actually running.

---

## Sources

- [Using the Real-time Search API — docs.slack.dev](https://docs.slack.dev/apis/web-api/real-time-search-api/)
- [assistant.search.context method — docs.slack.dev](https://docs.slack.dev/reference/methods/assistant.search.context/)
- [Context management — docs.slack.dev](https://docs.slack.dev/ai/agent-context-management/)
- [search:read scope (legacy, user-only) — docs.slack.dev](https://docs.slack.dev/reference/scopes/search.read/)
- [search:read.public scope — docs.slack.dev](https://docs.slack.dev/reference/scopes/search.read.public/)
- [Slack blog: MCP + Real-Time Search API now available](https://slack.com/blog/news/mcp-real-time-search-api-now-available)
