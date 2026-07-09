/**
 * Quiet Hours — intervention engine.
 *
 * This is the seam that ties everything together: it receives a detection
 * trigger, sends the warm "you've been alone a while" DM, and on the person's
 * consent, drafts a handoff note (Claude) and pages a rested backup (PagerDuty
 * via MCP), then produces the morning "thank-you" Canvas.
 *
 * It holds NO detection logic (that's the pure heuristic) and NO view markup
 * (that's src/ui/*). It only orchestrates: ledger + ui + mcp + agent.
 *
 * @module agent/interventionEngine
 */

import { getBuffer } from '../detection/watcher.js';

const SNOOZE_MINUTES = 30;

/**
 * Build a best-effort Observed snapshot for a session from the live channel
 * buffer plus the persisted session counters. Used by the button handlers,
 * which run in a separate interaction from the original trigger.
 *
 * @param {any} session
 * @returns {{soloMinutes:number, messageCount:number, firstMessageText:string, firstMessageTs:string, localHour:number}}
 */
function reconstructObserved(session) {
  const buf = getBuffer(session.channelId);
  const messages = (buf && buf.messages) || [];
  const firstHuman =
    messages.find((m) => m && !m.isBot && m.text && m.text.trim()) ||
    messages.find((m) => m && m.text && m.text.trim()) ||
    null;
  return {
    soloMinutes: session.soloMinutes || 0,
    messageCount: session.messageCount || 0,
    firstMessageText: session.firstMessageText || firstHuman?.text || '',
    firstMessageTs: firstHuman?.ts || '',
    localHour: typeof session.localHour === 'number' ? session.localHour : 1,
  };
}

/**
 * Build a thread-context object (the shape draftHandoffNote expects) from the
 * live channel buffer, falling back to a single synthesized message.
 *
 * @param {any} session
 * @param {{firstMessageText?:string}} observed
 * @returns {{messages:{userId:string,ts:string,isBot:boolean,text:string}[], source:string}}
 */
function reconstructThreadContext(session, observed) {
  const buf = getBuffer(session.channelId);
  const messages = (buf && buf.messages) || [];
  if (messages.length > 0) {
    return { messages, source: 'buffer' };
  }
  return {
    messages: observed.firstMessageText
      ? [
          {
            userId: session.userId,
            ts: observed.firstMessageTs || '',
            isBot: false,
            text: observed.firstMessageText,
          },
        ]
      : [],
    source: 'synthetic',
  };
}

/**
 * Post a message to a user's DM. Posting with a user id as the channel opens
 * (or reuses) the IM conversation with the bot.
 *
 * @param {any} client
 * @param {string} userId
 * @param {object} payload - Extra chat.postMessage fields (text/blocks).
 * @returns {Promise<any>}
 */
async function dmUser(client, userId, payload) {
  return client.chat.postMessage({ channel: userId, ...payload });
}

/**
 * Convert the Canvas markdown into Slack message mrkdwn so the morning summary
 * always renders as a normal message, even if the Canvas API is unavailable on
 * the workspace. (Slack mrkdwn: single-asterisk bold, no `#` headers.)
 *
 * @param {string} md
 * @returns {string}
 */
function canvasMarkdownToMrkdwn(md) {
  return md
    .split('\n')
    .map((line) => {
      if (line.startsWith('## ')) return `*${line.slice(3).trim()}*`;
      if (line.startsWith('# ')) return `*${line.slice(2).trim()}*`;
      if (line.trim() === '---') return ' ';
      let out = line.replace(/\*\*(.+?)\*\*/g, '*$1*'); // bold
      out = out.replace(/^- /, '•  '); // bullets
      return out;
    })
    .join('\n');
}

/**
 * Create the intervention engine.
 *
 * @param {{
 *   ledger: any,
 *   ui: { dmBlocks: any, canvas: any, appHome: any, copy: any },
 *   mcp: any,
 *   agent: any,
 *   config: any,
 * }} deps
 * @returns {{
 *   onTrigger: (args:{session:any, observed:any, client:any}) => Promise<void>,
 *   handleHandoff: (args:{client:any, sessionId:string, userId?:string, body?:any}) => Promise<void>,
 *   handleKeepGoing: (args:{client:any, sessionId:string, userId?:string, body?:any}) => Promise<void>,
 *   handleSnooze: (args:{client:any, sessionId:string, userId?:string, body?:any}) => Promise<void>,
 *   postMorningCanvas: (args:{client:any, session:any}) => Promise<void>,
 * }}
 */
export function makeInterventionEngine({ ledger, ui, mcp, agent, config }) {
  const { dmBlocks, canvas, copy } = ui;

  /**
   * A solo responder just crossed the threshold — send the private, warm DM
   * offering to take the incident off their hands.
   */
  async function onTrigger({ session, observed, client }) {
    const blocks = dmBlocks.buildInterventionDM(session, observed);
    await dmUser(client, session.userId, {
      blocks,
      text: copy.interventionHeader(observed),
    });
    console.log(
      `[engine] intervention DM sent to ${session.userId} (session ${session.id})`,
    );
  }

  /**
   * The person tapped "Hand off & sleep". Find the backup on PagerDuty (MCP),
   * draft the handoff note (Claude), page the backup (MCP), record it, and
   * confirm — then post the note into the channel so it's visible.
   */
  async function handleHandoff({ client, sessionId, userId }) {
    const session = ledger.getSession(sessionId);
    if (!session) {
      console.log(`[engine] handleHandoff: no session ${sessionId}`);
      return;
    }

    const observed = reconstructObserved(session);
    const threadContext = reconstructThreadContext(session, observed);

    // 1. Who is the rested backup? (MCP → PagerDuty, mock when no token.)
    const oncall = await mcp.getOncall(config.pagerDutyScheduleId || undefined);
    const backup = oncall?.backup || { id: 'unknown', name: 'your backup' };

    // 2. Draft the handoff note in the tired responder's voice (Claude → fallback).
    const note = await agent.draftHandoffNote({ threadContext, observed });

    // 3. Page the backup (MCP → PagerDuty, mock when no token).
    const paged = await mcp.pageBackup({
      userId: backup.id,
      contextNote: note,
      scheduleId: config.pagerDutyScheduleId || undefined,
    });

    // 4. Record everything we actually did.
    const now = Date.now();
    ledger.updateSession(sessionId, {
      status: 'handed_off',
      backupUserId: backup.id,
      backupName: backup.name,
      pagedAt: now,
      endedAt: now,
      handoffNote: note,
      handoffIncidentId: paged?.incidentId || null,
    });

    // 5. Confirm to the person and let them go.
    await dmUser(client, session.userId, {
      text: copy.handoffConfirm(backup.name),
    });

    // 6. Drop the handoff note into the channel so the next person sees it.
    try {
      await client.chat.postMessage({
        channel: session.channelId,
        text: `:handshake: *Handoff — paged ${backup.name}*\n>>> ${note}`,
      });
    } catch (err) {
      console.log('[engine] could not post handoff note to channel:', err?.message);
    }

    console.log(
      `[engine] handed off session ${sessionId} to ${backup.name}` +
        (paged?.mock ? ' (PagerDuty mock)' : ' (PagerDuty live)'),
    );
  }

  /** The person chose to stay on. Respect it; leave the door open. */
  async function handleKeepGoing({ client, sessionId, userId }) {
    const session = ledger.getSession(sessionId);
    if (session) {
      ledger.updateSession(sessionId, { status: 'watching' });
    }
    const target = userId || session?.userId;
    if (target) {
      await dmUser(client, target, { text: copy.keepGoingAck() });
    }
  }

  /** The person snoozed the nudge. Acknowledge warmly. */
  async function handleSnooze({ client, sessionId, userId }) {
    const session = ledger.getSession(sessionId);
    const target = userId || session?.userId;
    if (target) {
      await dmUser(client, target, { text: copy.snoozeAck(SNOOZE_MINUTES) });
    }
  }

  /**
   * Post the morning "thank-you" Canvas to the incident channel. Always posts a
   * rendered message (guaranteed to show); additionally attempts a real Slack
   * Canvas for the full experience when the workspace supports it.
   */
  async function postMorningCanvas({ client, session }) {
    const markdown = canvas.buildMorningCanvasMarkdown(session);

    // Best-effort: a real Slack Canvas. Not all workspaces expose this API, so
    // never let a failure here block the visible summary message.
    let canvasNote = '';
    try {
      if (client.canvases && typeof client.canvases.create === 'function') {
        const res = await client.canvases.create({
          title: copy.morningTitle(session.userName || session.userId),
          document_content: { type: 'markdown', markdown },
        });
        if (res?.canvas_id) {
          canvasNote = `\n\n_(also saved as a Canvas: ${res.canvas_id})_`;
        }
      }
    } catch (err) {
      console.log('[engine] canvas create skipped:', err?.message);
    }

    await client.chat.postMessage({
      channel: session.channelId,
      text: canvasMarkdownToMrkdwn(markdown) + canvasNote,
    });
    console.log(`[engine] morning canvas posted for session ${session.id}`);
  }

  return {
    onTrigger,
    handleHandoff,
    handleKeepGoing,
    handleSnooze,
    postMorningCanvas,
  };
}
