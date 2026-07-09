// src/ui/dmBlocks.js
// Pure view-builder: the private intervention DM shown to a lone on-call person.
// No Slack API calls, no side effects. Wording comes from copy.js.

import { copy } from './copy.js';

/**
 * Build the intervention DM as Slack Block Kit blocks.
 *
 * @param {import('../types').IncidentSession} session
 * @param {import('../types').Observed} observed
 * @returns {Array<object>} Slack Block[]
 *
 * @example
 * const blocks = buildInterventionDM(
 *   { id: 'sess_1', channelId: 'C123', userId: 'U123' },
 *   { soloMinutes: 100, messageCount: 42,
 *     firstMessageText: 'prod api 500s spiking, looking now',
 *     firstMessageTs: '1720000000.000100', localHour: 1 }
 * );
 * // => [{ type: 'header', ... }, { type: 'section', ... }, ...]
 */
export function buildInterventionDM(session, observed) {
  const solo = copy.fieldSoloTime(observed);
  const msgs = copy.fieldMessages(observed);
  const noReply = copy.fieldNoReply(observed);
  const localTime = copy.fieldLocalTime(observed);

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: copy.interventionHeader(observed),
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: copy.interventionBody(observed),
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*${solo.label}*\n${solo.value}` },
        { type: 'mrkdwn', text: `*${msgs.label}*\n${msgs.value}` },
        { type: 'mrkdwn', text: `*${noReply.label}*\n${noReply.value}` },
        { type: 'mrkdwn', text: `*${localTime.label}*\n${localTime.value}` },
      ],
    },
    { type: 'divider' },
  ];

  // Quote the incident's first message, if we observed one.
  if (observed.firstMessageText) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${copy.firstMessageCaption()}\n> ${observed.firstMessageText}`,
        },
      ],
    });
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        action_id: 'qh_handoff',
        style: 'primary',
        text: { type: 'plain_text', text: 'Hand off & sleep', emoji: true },
        value: session.id,
      },
      {
        type: 'button',
        action_id: 'qh_snooze',
        text: { type: 'plain_text', text: 'Snooze 30 min', emoji: true },
        value: session.id,
      },
      {
        type: 'button',
        action_id: 'qh_keep_going',
        text: { type: 'plain_text', text: "I'm okay, keep going", emoji: true },
        value: session.id,
      },
    ],
  });

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: copy.footer }],
  });

  return blocks;
}
