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
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/** Path (relative to cwd) to the MCP server entrypoint. */
const SERVER_ARGS = ['src/mcp/pagerdutyServer.js'];

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
 * Connect to the server, invoke one tool, parse, and disconnect.
 *
 * @param {string} toolName - Tool to call (`get_oncall` | `page_backup`).
 * @param {Record<string, unknown>} toolArgs - Tool arguments.
 * @returns {Promise<object>} Parsed tool result.
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
