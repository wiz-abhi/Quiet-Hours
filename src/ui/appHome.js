// src/ui/appHome.js
// Pure view-builder: the Quiet Hours App Home tab. No Slack API calls, no side effects.

import { copy } from './copy.js';

/**
 * Format an epoch-ms timestamp to a short date like "Jul 8".
 * @param {number} ms
 * @returns {string}
 */
function shortDate(ms) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const d = new Date(ms);
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Summarize one recent session into a single mrkdwn line.
 * "minutes saved" = observed solo minutes that were carried before handoff.
 * @param {import('../types').IncidentSession} s
 */
function summarizeSession(s) {
  const when = s.startedAt ? shortDate(s.startedAt) : 'recently';
  const channel = s.channelId ? `<#${s.channelId}>` : 'a channel';
  const who = s.userName ? s.userName : s.userId ? `<@${s.userId}>` : 'a teammate';
  const mins = copy.humanMinutes(s.soloMinutes);
  return `*${when}* · ${channel} · helped ${who} · ${mins} of solo time carried`;
}

/**
 * Build the App Home view blocks.
 *
 * @param {{
 *   watchedChannels: string[],
 *   optedIn: boolean,
 *   recentSessions: import('../types').IncidentSession[]
 * }} state
 * @returns {Array<object>} Slack Block[]
 */
export function buildAppHome(state) {
  const watched = Array.isArray(state?.watchedChannels) ? state.watchedChannels : [];
  const recent = Array.isArray(state?.recentSessions) ? state.recentSessions : [];
  const optedIn = Boolean(state?.optedIn);

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Quiet Hours 🌙', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          "I watch the late-night on-call channels. When someone's been holding an " +
          'incident alone for too long, I quietly offer to page their backup and write ' +
          'the handoff — so they can actually rest.',
      },
    },
    { type: 'divider' },

    // Opt-in status + toggle.
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: copy.appHomeStatus({ optedIn, watchedCount: watched.length }),
      },
      accessory: {
        type: 'button',
        action_id: 'qh_optin_toggle',
        text: {
          type: 'plain_text',
          text: optedIn ? 'Turn off' : 'Turn on',
          emoji: true,
        },
        style: optedIn ? 'danger' : 'primary',
        // value is the *desired next* state.
        value: optedIn ? 'off' : 'on',
      },
    },
  ];

  // Watched channels.
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text:
        watched.length > 0
          ? `*Watching these channels*\n${watched.map((c) => `<#${c}>`).join('  ·  ')}`
          : '*Watching these channels*\n_None yet. Add Quiet Hours to an on-call channel to start._',
    },
  });

  blocks.push({ type: 'divider' });

  // Recent quiet nights.
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: '*Recent quiet nights*' },
  });

  if (recent.length === 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'No quiet nights yet — hopefully it stays that way. Rest easy. 💛',
        },
      ],
    });
  } else {
    for (const s of recent) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: summarizeSession(s) },
      });
    }
  }

  // Honesty footer.
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: copy.footer }],
  });

  return blocks;
}
