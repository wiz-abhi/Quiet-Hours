// src/ui/copy.js
// All user-facing strings for Quiet Hours.
// Tone: warm, brief, honest, non-paternalistic. We show observed facts and offer
// help — we never diagnose ("burned out") or invent numbers.

/**
 * Format an epoch-ms timestamp to a local-looking HH:MM string.
 * @param {number} ms
 * @returns {string}
 */
function hhmm(ms) {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Turn a minute count into a friendly "1h 40m" / "45 min" phrase.
 * @param {number} mins
 * @returns {string}
 */
function humanMinutes(mins) {
  const n = Math.max(0, Math.round(mins || 0));
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export const copy = {
  humanMinutes,
  hhmm,

  /**
   * Header line for the intervention DM.
   * @param {import('../types').Observed} observed
   */
  interventionHeader(observed) {
    return `You've been on this alone for ${humanMinutes(observed.soloMinutes)} 🌙`;
  },

  /**
   * Body / lede for the intervention DM. States what we saw, then offers help.
   * No diagnosis — just the observed shape of the night.
   * @param {import('../types').Observed} observed
   */
  interventionBody(observed) {
    return (
      `It's ${humanMinutes(observed.soloMinutes)} into this and it looks like ` +
      `it's still just you. That's a lot to hold by yourself.\n\n` +
      `No pressure at all — but if you'd like, I can page your backup and write ` +
      `the handoff note for you so you can actually sleep.`
    );
  },

  /** Field label + value pairs shown in the DM. */
  fieldSoloTime(observed) {
    return { label: 'Solo so far', value: humanMinutes(observed.soloMinutes) };
  },
  fieldMessages(observed) {
    const n = observed.messageCount;
    return { label: 'Messages you sent', value: `${n} message${n === 1 ? '' : 's'}` };
  },
  fieldNoReply(observed) {
    return {
      label: 'Quietest stretch',
      value: `no one else has replied in ${humanMinutes(observed.soloMinutes)}`,
    };
  },
  fieldLocalTime(observed) {
    const h = String(observed.localHour).padStart(2, '0');
    return { label: 'Your local time', value: `${h}:00` };
  },

  /** Small caption above the quoted first message. */
  firstMessageCaption() {
    return 'This is where the night started:';
  },

  /**
   * Confirmation after the person taps "Hand off & sleep".
   * @param {string} backupName
   */
  handoffConfirm(backupName) {
    return (
      `Done. I've paged ${backupName} and posted your handoff note. 🌙\n` +
      `You're off the hook — go get some rest. We've got it from here.`
    );
  },

  /** Ack for "I'm okay, keep going". Respect the choice; leave the door open. */
  keepGoingAck() {
    return (
      `Got it — you're staying on. 💛\n` +
      `I'll stay quiet. If you change your mind, just tap *Hand off & sleep* ` +
      `and I'll take it from there.`
    );
  },

  /**
   * Ack for snoozing the nudge.
   * @param {number} minutes
   */
  snoozeAck(minutes) {
    return `Okay — I'll check back in ${minutes} min. Take your time. 💛`;
  },

  /** Morning canvas title. @param {string} userName */
  morningTitle(userName) {
    return `What ${userName} carried last night`;
  },

  /** Warm intro paragraph for the morning canvas. */
  morningIntro:
    "Last night one of us was on call alone into the small hours. Here's what " +
    'that actually looked like — so it doesn\'t go unseen. Nothing below is a ' +
    'guess; every line was observed in Slack.',

  /** App Home status line. @param {{optedIn:boolean, watchedCount:number}} state */
  appHomeStatus(state) {
    if (!state || !state.optedIn) {
      return "Quiet Hours is *off* for you. You won't get any nudges until you opt in.";
    }
    const n = state.watchedCount || 0;
    return `Quiet Hours is *on* for you, watching ${n} channel${n === 1 ? '' : 's'}. 🌙`;
  },

  /** The honesty footer. Shown on every surface that displays numbers. */
  footer:
    'Every number on this page was observed in Slack — nothing here is estimated or invented.',
};
