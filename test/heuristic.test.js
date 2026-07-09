// @ts-check
/**
 * @file test/heuristic.test.js
 * Tests for the PURE detection heuristic.
 *
 * Run with `node --test` (requires src/config.js to exist so the thresholds
 * import resolves). Uses only node:test + node:assert — no external deps.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/detection/heuristic.js';

/** Fixed "now" so tests are deterministic. */
const NOW = Date.UTC(2026, 6, 9, 6, 0, 0); // 2026-07-09T06:00:00Z

/**
 * Build a Slack ts string (seconds) for a given minutes-ago-from-NOW.
 * @param {number} minutesAgo
 * @returns {string}
 */
function tsMinutesAgo(minutesAgo) {
  return String((NOW - minutesAgo * 60_000) / 1000);
}

test('(a) 35 solo late-night messages with a 70-min gap => triggered', () => {
  /** @type {import('../src/detection/heuristic.js').Message[]} */
  const messages = [];

  // One other human spoke 70 minutes ago (the gap starts there).
  messages.push({
    userId: 'U_OTHER',
    ts: tsMinutesAgo(70),
    isBot: false,
    text: 'you good over there?',
  });

  // 35 solo messages from U_SOLO, all within the last 65 minutes.
  for (let i = 0; i < 35; i++) {
    messages.push({
      userId: 'U_SOLO',
      ts: tsMinutesAgo(65 - i), // spread from 65 min ago up to ~31 min ago
      isBot: false,
      text: `working the incident, step ${i}`,
    });
  }

  const verdict = evaluate({
    messages,
    now: NOW,
    localHour: 2, // small hours => late night (wraps past midnight)
  });

  assert.equal(verdict.triggered, true, verdict.reasons.join('\n'));
  assert.equal(verdict.observed.messageCount, 35);
  assert.ok(verdict.observed.soloMinutes > 0);
});

test('(b) two humans alternating => not triggered', () => {
  /** @type {import('../src/detection/heuristic.js').Message[]} */
  const messages = [];

  // 40 messages alternating between two humans, recent — no solo gap.
  for (let i = 0; i < 40; i++) {
    messages.push({
      userId: i % 2 === 0 ? 'U_A' : 'U_B',
      ts: tsMinutesAgo(40 - i),
      isBot: false,
      text: `msg ${i}`,
    });
  }

  const verdict = evaluate({
    messages,
    now: NOW,
    localHour: 2,
  });

  assert.equal(verdict.triggered, false, verdict.reasons.join('\n'));
});

test('(c) only 10 messages => not triggered', () => {
  /** @type {import('../src/detection/heuristic.js').Message[]} */
  const messages = [];

  for (let i = 0; i < 10; i++) {
    messages.push({
      userId: 'U_SOLO',
      ts: tsMinutesAgo(120 - i),
      isBot: false,
      text: `msg ${i}`,
    });
  }

  const verdict = evaluate({
    messages,
    now: NOW,
    localHour: 2,
  });

  assert.equal(verdict.triggered, false, verdict.reasons.join('\n'));
  assert.equal(verdict.observed.messageCount, 10);
});
