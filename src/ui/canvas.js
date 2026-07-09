// src/ui/canvas.js
// Pure view-builder: the morning "thank-you" Canvas posted in a team channel.
// Returns a markdown string. No Slack API calls, no side effects.
// Never fabricates: if a field is null, its line is omitted.

import { copy } from './copy.js';

/**
 * Format an epoch-ms timestamp to HH:MM. Returns null for null/invalid input.
 * @param {number|null|undefined} ms
 * @returns {string|null}
 */
function timeOrNull(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return null;
  return copy.hhmm(ms);
}

/**
 * Best-effort display name for the Canvas title.
 *
 * Prefers a resolved `userName`. When only a raw Slack user id is available we
 * emit it as a `<@id>` mention (like appHome.js) so Slack resolves it to the
 * person's real name in the posted message — never a bare, robotic-looking id.
 * @param {import('../types').IncidentSession} session
 * @returns {string}
 */
function displayName(session) {
  if (session.userName) return session.userName;
  if (session.userId) return `<@${session.userId}>`;
  return 'your teammate';
}

/**
 * Build the morning Canvas markdown for one resolved incident.
 *
 * @param {import('../types').IncidentSession} session
 * @returns {string} markdown
 */
export function buildMorningCanvasMarkdown(session) {
  const name = displayName(session);
  const backup = session.backupName || session.backupUserId;

  const lines = [];

  // Title + intro.
  lines.push(`# ${copy.morningTitle(name)}`);
  lines.push('');
  lines.push(copy.morningIntro);
  lines.push('');

  // Timeline — only the beats we actually observed.
  lines.push('## Timeline');
  const started = timeOrNull(session.startedAt);
  if (started) lines.push(`- **${started}** — went on call, alone`);

  const paged = timeOrNull(session.pagedAt);
  if (paged) {
    lines.push(
      backup
        ? `- **${paged}** — paged ${backup} for backup`
        : `- **${paged}** — paged for backup`,
    );
  }

  const ended = timeOrNull(session.endedAt);
  if (ended) lines.push(`- **${ended}** — handed off and resolved`);
  lines.push('');

  // By the numbers — observed fields only.
  lines.push('## By the numbers');
  lines.push(`- Solo time: **${copy.humanMinutes(session.soloMinutes)}**`);
  lines.push(
    `- Messages sent: **${session.messageCount} message${
      session.messageCount === 1 ? '' : 's'
    }**`,
  );

  const silenced = Array.isArray(session.pingsSilenced)
    ? session.pingsSilenced.length
    : 0;
  lines.push(
    `- Pings held quiet: **${silenced} ping${silenced === 1 ? '' : 's'}**`,
  );

  if (paged && backup) {
    lines.push(`- Backup paged at: **${paged}** (${backup})`);
  } else if (paged) {
    lines.push(`- Backup paged at: **${paged}**`);
  }

  if (
    session.endedAt !== null &&
    session.endedAt !== undefined &&
    session.startedAt !== null &&
    session.startedAt !== undefined
  ) {
    const durMin = Math.max(
      0,
      Math.round((session.endedAt - session.startedAt) / 60000),
    );
    lines.push(`- Total incident duration: **${copy.humanMinutes(durMin)}**`);
  }
  lines.push('');

  // Handoff note excerpt, if present.
  if (session.handoffNote) {
    lines.push('## Handoff note');
    const note = String(session.handoffNote).trim();
    const excerpt = note.length > 400 ? `${note.slice(0, 400).trimEnd()}…` : note;
    // Blockquote each line so multi-line notes render cleanly.
    for (const l of excerpt.split('\n')) {
      lines.push(`> ${l}`);
    }
    lines.push('');
  }

  // Honesty footer.
  lines.push('---');
  lines.push(`_${copy.footer}_`);

  return lines.join('\n');
}
