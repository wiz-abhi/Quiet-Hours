/**
 * Central configuration for Quiet Hours.
 *
 * Loads `.env` (via dotenv) and exposes a typed-ish `config` object plus a
 * small `getEnv` helper. All other modules read tuning from here so thresholds
 * live in exactly one place.
 */

import 'dotenv/config';

/**
 * Read an environment variable with an optional fallback.
 *
 * @param {string} name - Env var name.
 * @param {string} [fallback] - Value to return when the var is unset/empty.
 * @returns {string} The value, or the fallback, or '' if neither is present.
 */
export function getEnv(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

/**
 * Parse a comma-separated env list into a trimmed, non-empty array.
 *
 * @param {string} raw - Raw comma list, e.g. "C123, C456".
 * @returns {string[]} Cleaned list of ids.
 */
function parseList(raw) {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const timezoneOffsetHours = Number.parseInt(
  getEnv('QH_TIMEZONE_OFFSET_HOURS', '0'),
  10,
);

/**
 * Runtime configuration singleton.
 */
export const config = {
  /**
   * Detection thresholds — when *all* the "solo late-night grind" signals
   * cross these, the heuristic triggers an intervention.
   */
  thresholds: {
    minSoloMessages: 30,
    minSoloGapMin: 60,
    minLocalHour: 23,
    minSoloDurationMin: 180,
  },
  /** Channel ids we actively watch. */
  watchedChannels: parseList(getEnv('QH_WATCHED_CHANNELS', '')),
  /** Anthropic model for drafting handoff notes. */
  anthropicModel: getEnv('ANTHROPIC_MODEL', 'claude-sonnet-5'),
  /** PagerDuty schedule id used to resolve the backup on-call (optional). */
  pagerDutyScheduleId: getEnv('PAGERDUTY_SCHEDULE_ID', ''),
  /** UTC offset (hours) used to derive the responder's local hour. */
  timezoneOffsetHours: Number.isNaN(timezoneOffsetHours)
    ? 0
    : timezoneOffsetHours,
};
