/**
 * Quiet Hours — PagerDuty MCP server.
 *
 * A genuine Model Context Protocol server (stdio transport) wrapping the
 * PagerDuty REST API v2. It exposes two tools the Quiet Hours agent uses to
 * execute a real on-call handoff:
 *
 *   - `get_oncall`  — who is on call now, and who the rested backup is.
 *   - `page_backup` — create a PagerDuty incident assigned to the backup.
 *
 * Offline-first: if `PAGERDUTY_TOKEN` is missing or any PagerDuty call fails,
 * every tool returns clearly-labeled MOCK data (`mock: true`) so the demo runs
 * with no PagerDuty account. Tools never throw — failures are returned as
 * `{ isError: true, ... }` content instead.
 *
 * Run directly:  node src/mcp/pagerdutyServer.js
 *
 * @module mcp/pagerdutyServer
 */

import 'dotenv/config';
import { pathToFileURL } from 'node:url';

// NOTE: These import paths target @modelcontextprotocol/sdk ^1.x. If the
// installed version differs, verify against the SDK's `dist/esm` layout after
// `npm install` — the subpath exports (server/index.js, server/stdio.js) are
// stable across the 1.x line but may need adjustment on a major bump.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const PAGERDUTY_API = 'https://api.pagerduty.com';

/** Realistic mock on-call pair, used when no token / on any failure. */
const MOCK_ONCALL = {
  mock: true,
  current: {
    id: 'PABC123',
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
  },
  backup: {
    id: 'PXYZ789',
    name: 'Marcus Lee',
    email: 'marcus.lee@example.com',
  },
};

/**
 * Build the standard PagerDuty auth headers.
 *
 * @param {string} token - PagerDuty API token.
 * @returns {Record<string, string>} Request headers.
 */
function pdHeaders(token) {
  return {
    Authorization: `Token token=${token}`,
    Accept: 'application/vnd.pagerduty+json;version=2',
    'Content-Type': 'application/json',
  };
}

/**
 * Wrap a JSON-serializable object as MCP tool result content.
 *
 * @param {unknown} obj - Payload to return.
 * @param {boolean} [isError=false] - Whether to flag the result as an error.
 * @returns {{ content: {type:'text', text:string}[], isError?: boolean }}
 */
function jsonResult(obj, isError = false) {
  const result = {
    content: [{ type: 'text', text: JSON.stringify(obj) }],
  };
  if (isError) result.isError = true;
  return result;
}

/**
 * Fetch the current + backup on-call for a schedule from PagerDuty.
 *
 * Falls back to labeled mock data when there's no token or the call fails.
 *
 * @param {{ scheduleId?: string }} args - Tool input.
 * @returns {Promise<object>} Parsed on-call info (may be `{ mock:true, ... }`).
 */
async function getOncall(args = {}) {
  const token = process.env.PAGERDUTY_TOKEN;
  const scheduleId = args.scheduleId || process.env.PAGERDUTY_SCHEDULE_ID || '';

  if (!token) return MOCK_ONCALL;

  try {
    // Query on-calls for the schedule, ordered so the earliest (current) is
    // first. We pull a small window and pick the current + next distinct user.
    const params = new URLSearchParams();
    if (scheduleId) params.append('schedule_ids[]', scheduleId);
    params.append('earliest', 'true');
    params.append('limit', '25');

    const res = await fetch(`${PAGERDUTY_API}/oncalls?${params.toString()}`, {
      headers: pdHeaders(token),
    });

    if (!res.ok) {
      return { ...MOCK_ONCALL, note: `pagerduty ${res.status}; using mock` };
    }

    const data = await res.json();
    const oncalls = Array.isArray(data.oncalls) ? data.oncalls : [];

    // First entry with a user is the current on-call; the next distinct user
    // (or the schedule's next rotation) is the backup.
    const withUser = oncalls.filter((o) => o && o.user);
    const current = withUser[0]?.user || null;
    const backup =
      withUser.find((o) => o.user && o.user.id !== current?.id)?.user || null;

    if (!current) {
      return { ...MOCK_ONCALL, note: 'no on-call found; using mock' };
    }

    return {
      mock: false,
      current: { id: current.id, name: current.summary, email: current.email },
      backup: backup
        ? { id: backup.id, name: backup.summary, email: backup.email }
        : MOCK_ONCALL.backup,
    };
  } catch (err) {
    return { ...MOCK_ONCALL, note: `error: ${err.message}; using mock` };
  }
}

/**
 * Page the backup by creating a PagerDuty incident assigned to them.
 *
 * Falls back to a labeled mock incident when there's no token or the call
 * fails.
 *
 * @param {{ userId: string, contextNote: string, scheduleId?: string }} args
 * @returns {Promise<object>} Parsed incident info (may be `{ mock:true, ... }`).
 */
async function pageBackup(args = {}) {
  const token = process.env.PAGERDUTY_TOKEN;
  const { userId, contextNote } = args;
  const serviceId = process.env.PAGERDUTY_SERVICE_ID || '';
  const fromEmail = process.env.PAGERDUTY_FROM_EMAIL || '';

  const mock = {
    mock: true,
    incidentId: 'PQMOCK1',
    assignedTo: userId,
    note: contextNote,
  };

  // Without a token — or the identifiers PagerDuty requires to create an
  // incident — return the labeled mock so the demo still completes a handoff.
  if (!token || !serviceId || !fromEmail) return mock;

  try {
    const body = {
      incident: {
        type: 'incident',
        title: 'Quiet Hours: on-call handoff to rested backup',
        service: { id: serviceId, type: 'service_reference' },
        body: { type: 'incident_body', details: contextNote },
        assignments: [
          {
            assignee: { id: userId, type: 'user_reference' },
          },
        ],
      },
    };

    const res = await fetch(`${PAGERDUTY_API}/incidents`, {
      method: 'POST',
      headers: { ...pdHeaders(token), From: fromEmail },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { ...mock, note: `pagerduty ${res.status}; ${contextNote}` };
    }

    const data = await res.json();
    const incident = data.incident || {};

    return {
      mock: false,
      incidentId: incident.id,
      assignedTo: userId,
      note: contextNote,
      status: incident.status,
      htmlUrl: incident.html_url,
    };
  } catch (err) {
    return { ...mock, note: `error: ${err.message}; ${contextNote}` };
  }
}

/** JSON schema for the `get_oncall` tool input. */
const GET_ONCALL_SCHEMA = {
  type: 'object',
  properties: {
    scheduleId: {
      type: 'string',
      description:
        'PagerDuty schedule id to look up. Optional; falls back to PAGERDUTY_SCHEDULE_ID env.',
    },
  },
  additionalProperties: false,
};

/** JSON schema for the `page_backup` tool input. */
const PAGE_BACKUP_SCHEMA = {
  type: 'object',
  properties: {
    userId: {
      type: 'string',
      description: 'PagerDuty user id of the backup to page.',
    },
    contextNote: {
      type: 'string',
      description:
        'Handoff note used as the incident body — what is broken, what was tried.',
    },
    scheduleId: {
      type: 'string',
      description: 'Optional PagerDuty schedule id for context.',
    },
  },
  required: ['userId', 'contextNote'],
  additionalProperties: false,
};

/**
 * Construct and wire up the MCP server (tools list + call dispatch).
 *
 * @returns {Server} The configured MCP server instance.
 */
export function createServer() {
  const server = new Server(
    { name: 'quiet-hours-pagerduty', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'get_oncall',
        description:
          'Get the current on-call user and the next/backup on-call for a PagerDuty schedule. Returns labeled mock data when no PagerDuty token is configured.',
        inputSchema: GET_ONCALL_SCHEMA,
      },
      {
        name: 'page_backup',
        description:
          'Page a rested backup by creating a PagerDuty incident assigned to them, with the handoff note as the incident body. Returns a labeled mock incident when no PagerDuty token is configured.',
        inputSchema: PAGE_BACKUP_SCHEMA,
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      if (name === 'get_oncall') {
        return jsonResult(await getOncall(args || {}));
      }
      if (name === 'page_backup') {
        const input = args || {};
        if (!input.userId || !input.contextNote) {
          return jsonResult(
            { error: 'page_backup requires userId and contextNote' },
            true,
          );
        }
        return jsonResult(await pageBackup(input));
      }
      return jsonResult({ error: `unknown tool: ${name}` }, true);
    } catch (err) {
      // Defensive: no tool should reach here, but never let one throw.
      return jsonResult({ error: err.message, mock: true }, true);
    }
  });

  return server;
}

/**
 * Connect the server over stdio. Invoked when run directly.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stay alive on stdio; log to stderr so we don't corrupt the JSON-RPC stream.
  process.stderr.write('quiet-hours-pagerduty MCP server running on stdio\n');
}

// Run only when executed directly (not when imported for testing).
// pathToFileURL (imported at top) handles Windows drive letters/backslashes.
const invokedDirectly =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly || process.env.QH_MCP_FORCE_START === '1') {
  main().catch((err) => {
    process.stderr.write(`fatal: ${err.stack || err.message}\n`);
    process.exit(1);
  });
}

export { getOncall, pageBackup };
