/**
 * Quiet Hours — PagerDuty MCP client.
 *
 * Thin wrapper that spawns the real PagerDuty MCP server
 * (`src/mcp/pagerdutyServer.js`) over stdio, calls a tool, parses the JSON
 * result, tears the transport down, and returns the parsed object.
 *
 * Connecting per call keeps this simple and robust for a hackathon: there's no
 * long-lived process to leak, and each call is fully isolated. A module-level
 * in-flight guard serializes concurrent calls so we don't spawn overlapping
 * server processes.
 *
 * @module mcp/pagerdutyClient
 */

// NOTE: These import paths target @modelcontextprotocol/sdk ^1.x. If the
// installed version differs, verify against the SDK's `dist/esm` layout after
// `npm install` — the client/index.js and client/stdio.js subpaths are stable
// across the 1.x line but may need adjustment on a major bump.
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * Absolute path to the MCP server entrypoint, resolved from THIS module — not
 * from the process cwd. StdioClientTransport spawns the child with the parent's
 * cwd (it never sets `cwd` here), so a cwd-relative path breaks the moment the
 * app is launched from any directory other than the repo root: the child exits
 * MODULE_NOT_FOUND and every tool call throws `Connection closed`. Resolving
 * absolutely keeps the spawn working regardless of where the app was started.
 */
const SERVER_ARGS = [fileURLToPath(new URL('./pagerdutyServer.js', import.meta.url))];

/**
 * Module-level guard: chain calls so we never run two stdio servers at once.
 * @type {Promise<unknown>}
 */
let inFlight = Promise.resolve();

/**
 * Parse the first text content block of an MCP tool result as JSON.
 *
 * @param {{ content?: {type:string, text?:string}[] }} result - MCP result.
 * @returns {object} Parsed object, or an error-shaped object on parse failure.
 */
function parseToolResult(result) {
  const block = (result?.content || []).find((c) => c && c.type === 'text');
  if (!block || typeof block.text !== 'string') {
    return { error: 'no text content in tool result', mock: true };
  }
  try {
    return JSON.parse(block.text);
  } catch (err) {
    return { error: `failed to parse tool result: ${err.message}`, mock: true };
  }
}

/**
 * Build a labeled mock result for a tool when the MCP server can't be reached
 * (spawn/transport failure). Mirrors the server's own mock shapes so callers
 * that read `.backup` / `.incidentId` still get a usable object and the handoff
 * degrades gracefully instead of aborting.
 *
 * @param {string} toolName - Tool that failed (`get_oncall` | `page_backup`).
 * @param {Record<string, unknown>} toolArgs - The attempted tool arguments.
 * @param {string} reason - Human-readable failure reason.
 * @returns {object} A `{ mock:true, ... }` fallback matching the tool's shape.
 */
function mockFallback(toolName, toolArgs, reason) {
  if (toolName === 'page_backup') {
    return {
      mock: true,
      incidentId: 'PQMOCK1',
      assignedTo: toolArgs?.userId,
      note: toolArgs?.contextNote,
      transportError: reason,
    };
  }
  // Default to the on-call shape (current + backup) for get_oncall / unknown.
  return {
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
    transportError: reason,
  };
}

/**
 * Connect to the server, invoke one tool, parse, and disconnect.
 *
 * Never throws: if the server can't be spawned or the transport dies, this
 * returns a labeled `{ mock:true, ... }` fallback so the handoff still
 * completes (a backup is still named and paged in mock) rather than aborting
 * silently in the caller.
 *
 * @param {string} toolName - Tool to call (`get_oncall` | `page_backup`).
 * @param {Record<string, unknown>} toolArgs - Tool arguments.
 * @returns {Promise<object>} Parsed tool result (may be `{ mock:true, ... }`).
 */
async function callTool(toolName, toolArgs) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: SERVER_ARGS,
    // Inherit env so the server sees PAGERDUTY_TOKEN etc.
    env: process.env,
  });

  const client = new Client(
    { name: 'quiet-hours-client', version: '1.0.0' },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: toolName,
      arguments: toolArgs,
    });
    return parseToolResult(result);
  } catch (err) {
    // Spawn/transport failure (e.g. server exited, connection closed). Degrade
    // to a labeled mock so the handoff still lands instead of throwing up to
    // the action handler, where it would die silently on camera.
    return mockFallback(toolName, toolArgs, err?.message || String(err));
  } finally {
    // Always tear down, even if the call threw.
    try {
      await client.close();
    } catch {
      /* ignore close errors */
    }
    try {
      await transport.close();
    } catch {
      /* ignore close errors */
    }
  }
}

/**
 * Serialize a call behind any in-flight call, so at most one server runs.
 *
 * @param {string} toolName - Tool to call.
 * @param {Record<string, unknown>} toolArgs - Tool arguments.
 * @returns {Promise<object>} Parsed tool result.
 */
function enqueue(toolName, toolArgs) {
  const run = inFlight.then(
    () => callTool(toolName, toolArgs),
    () => callTool(toolName, toolArgs),
  );
  // Keep the chain alive regardless of individual outcomes.
  inFlight = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Get the current + backup on-call for a schedule via the MCP server.
 *
 * @param {string} [scheduleId] - Optional PagerDuty schedule id.
 * @returns {Promise<object>} Parsed on-call info (may be `{ mock:true, ... }`).
 */
export async function getOncall(scheduleId) {
  const args = scheduleId ? { scheduleId } : {};
  return enqueue('get_oncall', args);
}

/**
 * Page the backup via the MCP server, creating a PagerDuty incident.
 *
 * @param {{ userId: string, contextNote: string, scheduleId?: string }} params
 * @returns {Promise<object>} Parsed incident info (may be `{ mock:true, ... }`).
 */
export async function pageBackup({ userId, contextNote, scheduleId }) {
  const args = { userId, contextNote };
  if (scheduleId) args.scheduleId = scheduleId;
  return enqueue('page_backup', args);
}
