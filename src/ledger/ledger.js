// @ts-check
/**
 * @file src/ledger/ledger.js
 * JSON-file backed persistence for IncidentSessions.
 *
 * Storage lives at ./data/ledger.json. The directory and file are created
 * lazily on first write. All fs access is synchronous — this keeps the module
 * simple and is perfectly adequate for the low write volume of an incident
 * ledger (a handful of sessions, a few updates each).
 *
 * @typedef {Object} IncidentSession
 * @property {string} id
 * @property {string} channelId
 * @property {string} userId
 * @property {number} startedAt        ms epoch
 * @property {number|null} endedAt     ms epoch or null while active
 * @property {number} soloMinutes
 * @property {number} messageCount
 * @property {string[]} pingsSilenced  message ts of bot pings we absorbed
 * @property {string|null} backupUserId
 * @property {number|null} pagedAt      ms epoch the backup was paged
 * @property {string|null} handoffNote
 * @property {string|null} handoffNoteTs
 * @property {'watching'|'intervened'|'handed_off'|'resolved'} status
 */

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve('./data');
const LEDGER_PATH = path.join(DATA_DIR, 'ledger.json');

/**
 * Ensure the data directory and ledger file exist. Called before any read.
 * @returns {void}
 */
function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LEDGER_PATH)) {
    fs.writeFileSync(LEDGER_PATH, JSON.stringify({ sessions: [] }, null, 2), 'utf8');
  }
}

/**
 * Read the whole ledger from disk.
 * @returns {{ sessions: IncidentSession[] }}
 */
function readStore() {
  ensureStore();
  try {
    const raw = fs.readFileSync(LEDGER_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.sessions)) {
      return { sessions: [] };
    }
    return parsed;
  } catch {
    // Corrupt or unreadable file — fail safe to an empty store rather than throw.
    return { sessions: [] };
  }
}

/**
 * Persist the whole ledger to disk.
 * @param {{ sessions: IncidentSession[] }} store
 * @returns {void}
 */
function writeStore(store) {
  ensureStore();
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(store, null, 2), 'utf8');
}

/**
 * Generate a session id like `qh_<timestamp>_<rand>`.
 * @returns {string}
 */
function generateId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `qh_${Date.now()}_${rand}`;
}

/**
 * Create and persist a new session, filling defaults for the full shape.
 * @param {Partial<IncidentSession>} partial
 * @returns {IncidentSession}
 */
export function createSession(partial = {}) {
  const store = readStore();
  const now = Date.now();

  /** @type {IncidentSession} */
  const session = {
    id: generateId(),
    channelId: '',
    userId: '',
    startedAt: now,
    endedAt: null,
    soloMinutes: 0,
    messageCount: 0,
    pingsSilenced: [],
    backupUserId: null,
    pagedAt: null,
    handoffNote: null,
    handoffNoteTs: null,
    status: 'watching',
    ...partial,
  };

  store.sessions.push(session);
  writeStore(store);
  return session;
}

/**
 * Fetch a session by id.
 * @param {string} id
 * @returns {IncidentSession|null}
 */
export function getSession(id) {
  const store = readStore();
  return store.sessions.find((s) => s.id === id) || null;
}

/**
 * Shallow-merge a patch into a session and persist.
 * @param {string} id
 * @param {Partial<IncidentSession>} patch
 * @returns {IncidentSession}
 */
export function updateSession(id, patch = {}) {
  const store = readStore();
  const idx = store.sessions.findIndex((s) => s.id === id);
  if (idx === -1) {
    throw new Error(`updateSession: no session with id ${id}`);
  }
  // Never let a patch overwrite the id.
  const { id: _ignore, ...safePatch } = patch;
  store.sessions[idx] = { ...store.sessions[idx], ...safePatch };
  writeStore(store);
  return store.sessions[idx];
}

/**
 * Return the active (not resolved, not ended) session for a channel, if any.
 * "Active" means status is 'watching' | 'intervened' | 'handed_off' and
 * endedAt is null. The most recently started match wins.
 * @param {string} channelId
 * @returns {IncidentSession|null}
 */
export function getActiveSessionForChannel(channelId) {
  const store = readStore();
  const active = store.sessions
    .filter(
      (s) =>
        s.channelId === channelId &&
        s.endedAt === null &&
        s.status !== 'resolved'
    )
    .sort((a, b) => b.startedAt - a.startedAt);
  return active[0] || null;
}

/**
 * List the most recent sessions, newest first.
 * @param {number} [limit=20]
 * @returns {IncidentSession[]}
 */
export function listRecentSessions(limit = 20) {
  const store = readStore();
  return [...store.sessions]
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, Math.max(0, limit));
}

/**
 * End a session: stamp endedAt and apply any final patch. Defaults status to
 * 'resolved' unless the patch overrides it.
 * @param {string} id
 * @param {Partial<IncidentSession>} patch
 * @returns {IncidentSession}
 */
export function endSession(id, patch = {}) {
  return updateSession(id, {
    endedAt: Date.now(),
    status: 'resolved',
    ...patch,
  });
}
