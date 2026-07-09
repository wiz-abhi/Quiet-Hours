/**
 * Quiet Hours — Bolt entrypoint (Socket Mode).
 *
 * This file is WIRING ONLY. It builds the intervention engine from the sibling
 * modules, registers the watcher, the `/quiethours` slash command, the button
 * actions, and the App Home, then starts the app. All business logic lives in
 * the modules it imports — keep it that way.
 */

import boltPkg from '@slack/bolt';

import { config, getEnv } from './config.js';
import * as ledger from './ledger/ledger.js';
import * as dmBlocks from './ui/dmBlocks.js';
import * as canvas from './ui/canvas.js';
import * as appHome from './ui/appHome.js';
import { copy } from './ui/copy.js';
import * as mcp from './mcp/pagerdutyClient.js';
import * as agent from './agent/handoff.js';
import { makeInterventionEngine } from './agent/interventionEngine.js';
import { registerWatcher } from './detection/watcher.js';
import { evaluate } from './detection/heuristic.js';
import { fetchThreadContext } from './detection/rtsClient.js';
import { seedDemo, buildHeuristicContextFromScript } from './demo/seed.js';

const { App } = boltPkg;

/**
 * In-memory opt-in registry. Users who opt out are excluded from intervention.
 * (Kept intentionally simple — persistence lives in the ledger for sessions.)
 * @type {Set<string>}
 */
const optedInUsers = new Set();

// --- App construction -------------------------------------------------------

const app = new App({
  token: getEnv('SLACK_BOT_TOKEN'),
  appToken: getEnv('SLACK_APP_TOKEN'),
  signingSecret: getEnv('SLACK_SIGNING_SECRET'),
  socketMode: true,
});

/** The intervention engine wires ledger + UI + MCP + agent together. */
const engine = makeInterventionEngine({
  ledger,
  ui: { dmBlocks, canvas, appHome, copy },
  mcp,
  agent,
  config,
});

// --- Detection watcher ------------------------------------------------------

registerWatcher(app, { onTrigger: engine.onTrigger, ledger, config });

// --- Slash command ----------------------------------------------------------

app.command('/quiethours', async ({ command, ack, respond, client, logger }) => {
  await ack();
  try {
    const [subcommand = 'status', ...rest] = command.text.trim().split(/\s+/);
    const channelId = command.channel_id;
    const userId = command.user_id;

    switch (subcommand.toLowerCase()) {
      case 'watch': {
        const target = rest[0] || channelId;
        if (!config.watchedChannels.includes(target)) {
          config.watchedChannels.push(target);
        }
        await respond({
          response_type: 'ephemeral',
          text: `👀 Now watching <#${target}> for lone late-night on-call.`,
        });
        break;
      }

      case 'optin': {
        optedInUsers.add(userId);
        await respond({
          response_type: 'ephemeral',
          text: '✅ You are opted in. Quiet Hours will look out for you.',
        });
        break;
      }

      case 'optout': {
        optedInUsers.delete(userId);
        await respond({
          response_type: 'ephemeral',
          text: '🙈 You are opted out. Quiet Hours will leave you alone.',
        });
        break;
      }

      case 'demo': {
        await respond({
          response_type: 'ephemeral',
          text: '🎬 Seeding a demo incident… the 1:47am nudge will follow.',
        });
        // 1. Replay the scripted incident into the channel (visual timeline).
        const summary = await seedDemo(app, client, channelId, { userId });
        // 2. Force the intervention using the script's synthetic 01:47 context —
        //    the seeded messages post at "now", so we drive the trigger from the
        //    script's own timestamps rather than waiting three real hours.
        const verdict = evaluate(buildHeuristicContextFromScript());
        if (verdict.triggered) {
          // Clear any leftover active session from a previous demo run.
          const stale = ledger.getActiveSessionForChannel(channelId);
          if (stale) ledger.endSession(stale.id, { status: 'resolved' });

          const o = verdict.observed;
          const session = ledger.createSession({
            channelId,
            userId,
            status: 'intervened',
            startedAt: Date.now() - Math.round((o.soloMinutes || 0) * 60000),
            soloMinutes: o.soloMinutes,
            messageCount: o.messageCount,
            firstMessageText: o.firstMessageText,
            localHour: o.localHour,
            // The seeded incident's bot pings really happened — count them.
            pingsSilenced: Array.from(
              { length: summary?.botCount || 0 },
              (_, i) => `demo_ping_${i + 1}`,
            ),
          });
          await engine.onTrigger({ session, observed: o, client });
        }
        break;
      }

      case 'morning': {
        const recent = ledger.listRecentSessions
          ? ledger.listRecentSessions(50).filter((s) => s.channelId === channelId)
          : [];
        const handed =
          recent.find((s) => s.status === 'handed_off') || recent[0];
        if (!handed) {
          await respond({
            response_type: 'ephemeral',
            text: 'No incident found for this channel yet. Try `/quiethours demo` first.',
          });
          break;
        }
        await engine.postMorningCanvas({ client, session: handed });
        break;
      }

      case 'status': {
        const active = ledger.getActiveSessionForChannel
          ? ledger.getActiveSessionForChannel(channelId)
          : null;
        const text = active
          ? `Status: *${active.status}* — ${active.messageCount} solo msgs over ${active.soloMinutes} min.`
          : 'No active Quiet Hours session in this channel.';
        await respond({ response_type: 'ephemeral', text });
        break;
      }

      case 'test': {
        const threadContext = await fetchThreadContext(client, channelId, {
          limit: 50,
        });
        const result = evaluate({
          messages: threadContext?.messages ?? [],
          now: Date.now(),
          localHour: threadContext?.localHour ?? config.thresholds.minLocalHour,
        });
        await respond({
          response_type: 'ephemeral',
          text: `🧪 Detection test — triggered: *${result.triggered}*\nReasons: ${
            (result.reasons ?? []).join(', ') || 'none'
          }`,
        });
        break;
      }

      default: {
        await respond({
          response_type: 'ephemeral',
          text: 'Usage: `/quiethours [watch|optin|optout|demo|morning|status|test]`',
        });
      }
    }
  } catch (error) {
    logger.error('quiethours command failed', error);
    await respond({
      response_type: 'ephemeral',
      text: '⚠️ Something went wrong handling that command.',
    }).catch(() => {});
  }
});

// --- Button actions ---------------------------------------------------------

app.action('qh_handoff', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    const sessionId = body.actions?.[0]?.value;
    await engine.handleHandoff({ client, sessionId, userId: body.user.id, body });
  } catch (error) {
    logger.error('qh_handoff failed', error);
  }
});

app.action('qh_keep_going', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    const sessionId = body.actions?.[0]?.value;
    await engine.handleKeepGoing({ client, sessionId, userId: body.user.id, body });
  } catch (error) {
    logger.error('qh_keep_going failed', error);
  }
});

app.action('qh_snooze', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    const sessionId = body.actions?.[0]?.value;
    await engine.handleSnooze({ client, sessionId, userId: body.user.id, body });
  } catch (error) {
    logger.error('qh_snooze failed', error);
  }
});

// --- App Home ---------------------------------------------------------------

app.event('app_home_opened', async ({ event, client, logger }) => {
  try {
    const view = appHome.buildAppHome({
      userId: event.user,
      optedIn: optedInUsers.has(event.user),
      watchedChannels: config.watchedChannels,
      recentSessions: ledger.listRecentSessions
        ? ledger.listRecentSessions()
        : [],
    });
    await client.views.publish({ user_id: event.user, view });
  } catch (error) {
    logger.error('app_home_opened failed', error);
  }
});

// --- Startup ----------------------------------------------------------------

const PORT = Number.parseInt(getEnv('PORT', '3000'), 10);

(async () => {
  try {
    await app.start(PORT);
    console.log('────────────────────────────────────────────');
    console.log(' 🌙 Quiet Hours is awake and watching over on-call.');
    console.log(`    Socket Mode · watching ${config.watchedChannels.length} channel(s)`);
    console.log('────────────────────────────────────────────');
  } catch (error) {
    console.error('Failed to start Quiet Hours:', error);
    process.exit(1);
  }
})();
