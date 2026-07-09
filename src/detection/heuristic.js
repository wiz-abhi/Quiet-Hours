// @ts-check
/**
 * @file src/detection/heuristic.js
 * PURE detection logic for the "lone late-night on-call firefighter" pattern.
 *
 * This module is deliberately free of I/O and of any dependency on the ledger
 * or Slack. It takes a plain HeuristicContext and returns a plain verdict.
 * Transparency is a product selling point: every condition contributes a
 * human-readable line to `reasons[]` explaining WHY it did or did not trigger.
 *
 * @typedef {Object} Message
 * @property {string} userId
 * @property {string} ts        Slack ts, seconds-with-fraction as string
 * @property {boolean} isBot
 * @property {string} text
 *
 * @typedef {Object} HeuristicContext
 * @property {Message[]} messages
 * @property {number} now         ms epoch "now"
 * @property {number} localHour   0..23 local hour for the on-call user
 *
 * @typedef {Object} Observed
 * @property {number} soloMinutes
 * @property {number} messageCount
 * @property {string} firstMessageText
 * @property {string} firstMessageTs
 * @property {number} localHour
 *
 * @typedef {Object} Verdict
 * @property {boolean} triggered
 * @property {string[]} reasons
 * @property {Observed} observed
 */

import { config } from '../config.js';

/**
 * Convert a Slack ts (seconds, possibly fractional, as string) to ms epoch.
 * @param {string} ts
 * @returns {number}
 */
function tsToMs(ts) {
  const seconds = Number.parseFloat(ts);
  return Number.isFinite(seconds) ? seconds * 1000 : NaN;
}

/**
 * Is the given local hour inside the "late night" window? The window wraps
 * past midnight, so we treat both `hour >= minLocalHour` (e.g. 23:00) and the
 * small hours (`hour < 6`) as late night.
 * @param {number} localHour
 * @param {number} minLocalHour
 * @returns {boolean}
 */
function isLateNight(localHour, minLocalHour) {
  return localHour >= minLocalHour || localHour < 6;
}

/**
 * Evaluate whether the on-call pattern is present.
 *
 * Logic (all human messages only, isBot === false):
 *   1. Find the dominant single human sender in the window (most messages).
 *   2. Compute how long ago the LAST message from any OTHER human was — the
 *      "solo gap". A large gap means this person is effectively alone.
 *   3. Trigger when:
 *        - dominant sender has >= minSoloMessages messages, AND
 *        - no other human has spoken for >= minSoloGapMin minutes, AND
 *        - it is late night (localHour, wrapping midnight)
 *            OR the solo run has lasted >= minSoloDurationMin.
 *
 * @param {HeuristicContext} context
 * @returns {Verdict}
 */
export function evaluate(context) {
  const { minSoloMessages, minSoloGapMin, minLocalHour, minSoloDurationMin } =
    config.thresholds;

  const now = context?.now ?? Date.now();
  const localHour = context?.localHour ?? 0;
  const allMessages = Array.isArray(context?.messages) ? context.messages : [];

  // Consider only human messages.
  const humanMessages = allMessages.filter((m) => m && m.isBot === false);

  /** @type {string[]} */
  const reasons = [];

  // --- Edge case: no human activity at all. ---
  if (humanMessages.length === 0) {
    reasons.push('No human messages in window — nothing to evaluate.');
    return {
      triggered: false,
      reasons,
      observed: {
        soloMinutes: 0,
        messageCount: 0,
        firstMessageText: '',
        firstMessageTs: '',
        localHour,
      },
    };
  }

  // --- 1. Find the dominant single human sender. ---
  /** @type {Map<string, Message[]>} */
  const bySender = new Map();
  for (const m of humanMessages) {
    const list = bySender.get(m.userId) || [];
    list.push(m);
    bySender.set(m.userId, list);
  }

  let dominantUserId = '';
  let dominantMessages = [];
  for (const [userId, list] of bySender) {
    if (list.length > dominantMessages.length) {
      dominantUserId = userId;
      dominantMessages = list;
    }
  }

  // Sort the dominant sender's messages chronologically by ts.
  const dominantSorted = [...dominantMessages].sort(
    (a, b) => tsToMs(a.ts) - tsToMs(b.ts)
  );
  const firstMsg = dominantSorted[0];
  const messageCount = dominantSorted.length;

  // --- 2. Compute the solo gap: time since the last OTHER human spoke. ---
  const otherHumanMessages = humanMessages.filter(
    (m) => m.userId !== dominantUserId
  );

  let soloGapMin;
  if (otherHumanMessages.length === 0) {
    // Nobody else has spoken in the entire window. Anchor the "gap" to the
    // dominant sender's first message so we don't claim an infinite gap.
    soloGapMin = (now - tsToMs(firstMsg.ts)) / 60000;
    reasons.push(
      `No other human has posted in the window; solo gap measured from the dominant sender's first message (~${Math.round(
        soloGapMin
      )} min).`
    );
  } else {
    const lastOtherMs = Math.max(
      ...otherHumanMessages.map((m) => tsToMs(m.ts))
    );
    soloGapMin = (now - lastOtherMs) / 60000;
    reasons.push(
      `Last message from another human was ~${Math.round(
        soloGapMin
      )} min ago.`
    );
  }

  // --- observed.soloMinutes: from dominant sender's first message to now. ---
  const soloMinutes = Math.round((now - tsToMs(firstMsg.ts)) / 60000);

  // --- 3. Evaluate each condition, recording a reason for pass/fail. ---
  const enoughMessages = messageCount >= minSoloMessages;
  reasons.push(
    `${enoughMessages ? 'PASS' : 'FAIL'}: dominant sender <@${dominantUserId}> has ${messageCount} messages (need >= ${minSoloMessages}).`
  );

  const bigEnoughGap = soloGapMin >= minSoloGapMin;
  reasons.push(
    `${bigEnoughGap ? 'PASS' : 'FAIL'}: solo gap is ${Math.round(
      soloGapMin
    )} min (need >= ${minSoloGapMin}).`
  );

  const lateNight = isLateNight(localHour, minLocalHour);
  const longRun = soloMinutes >= minSoloDurationMin;
  const timeCondition = lateNight || longRun;
  reasons.push(
    `${timeCondition ? 'PASS' : 'FAIL'}: time condition — localHour=${localHour} (late night if >= ${minLocalHour} or < 6 => ${lateNight}) OR soloMinutes=${soloMinutes} (long run if >= ${minSoloDurationMin} => ${longRun}).`
  );

  const triggered = enoughMessages && bigEnoughGap && timeCondition;
  reasons.push(
    triggered
      ? 'TRIGGERED: a lone on-call responder appears to be carrying an incident alone. Time to help them hand off and rest.'
      : 'Not triggered: at least one condition above did not pass.'
  );

  return {
    triggered,
    reasons,
    observed: {
      soloMinutes,
      messageCount,
      firstMessageText: firstMsg.text ?? '',
      firstMessageTs: firstMsg.ts ?? '',
      localHour,
    },
  };
}
