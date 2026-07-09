/**
 * Shared type definitions for Quiet Hours.
 *
 * These are pure JSDoc typedefs — no runtime code. Import them for editor
 * intellisense via `@typedef {import('./types.js').IncidentSession}`.
 */

/**
 * A single tracked on-call incident: from the moment we start watching a lone
 * responder through handoff and morning follow-up.
 *
 * @typedef {Object} IncidentSession
 * @property {string} id - Unique session id.
 * @property {string} channelId - Slack channel where the incident lives.
 * @property {string} userId - The lone responder we're looking after.
 * @property {number} startedAt - Epoch ms when watching began.
 * @property {number|null} endedAt - Epoch ms when the session closed, or null.
 * @property {number} soloMinutes - Minutes the responder has been solo.
 * @property {number} messageCount - Messages the responder posted while solo.
 * @property {string[]} pingsSilenced - Message ts values we've muted/snoozed.
 * @property {string|null} backupUserId - Backup responder paged, if any.
 * @property {number|null} pagedAt - Epoch ms the backup was paged, or null.
 * @property {string|null} handoffNote - Drafted handoff note text, or null.
 * @property {string|null} handoffNoteTs - Slack ts of the posted handoff note.
 * @property {'watching'|'intervened'|'handed_off'|'resolved'} status - Lifecycle state.
 */

/**
 * A snapshot of what the heuristic observed about a responder's activity.
 *
 * @typedef {Object} Observed
 * @property {number} soloMinutes - Minutes spent solo in the thread/channel.
 * @property {number} messageCount - Count of the responder's messages.
 * @property {string} firstMessageText - Text of the responder's first message.
 * @property {string} firstMessageTs - Slack ts of that first message.
 * @property {number} localHour - Responder's local hour (0-23).
 */

/**
 * Input context handed to the detection heuristic.
 *
 * @typedef {Object} HeuristicContext
 * @property {{ userId:string, ts:string, isBot:boolean, text:string }[]} messages
 *   - Recent messages, oldest first.
 * @property {number} now - Epoch ms "current" time for the evaluation.
 * @property {number} localHour - Responder's local hour (0-23).
 */

export {};
