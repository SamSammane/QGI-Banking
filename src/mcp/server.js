// MCP server over stdio, spoken directly as newline-delimited JSON-RPC 2.0.
//
// Written by hand rather than pulled from an SDK: the protocol surface a tool
// provider needs is three methods, and this CLI's main virtue is that it
// installs with one dependency. Nothing here is transport-specific beyond
// readLine/writeMessage, so a different transport only replaces those.

import { toolDefinitions, findTool } from './tools.js';

export const SUPPORTED_PROTOCOL_VERSION = '2025-06-18';

const JSON_RPC_ERRORS = {
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  PARSE_ERROR: -32700,
};

/**
 * Handle one decoded JSON-RPC message.
 * Returns a response object, or null for notifications (which take no reply).
 */
export async function handleMessage(msg, { serverInfo }) {
  const { id, method, params } = msg || {};
  const isNotification = id === undefined || id === null;

  // Notifications are fire-and-forget; replying to one is a protocol error.
  if (isNotification) {
    return null;
  }

  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

  switch (method) {
    case 'initialize':
      return reply({
        // Echo the client's version when it names one, so a client on an older
        // revision is not handed a version it did not ask for.
        protocolVersion: params?.protocolVersion || SUPPORTED_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo,
      });

    case 'ping':
      return reply({});

    case 'tools/list':
      return reply({ tools: toolDefinitions() });

    case 'tools/call': {
      const name = params?.name;
      const tool = findTool(name);
      if (!tool) {
        return fail(JSON_RPC_ERRORS.INVALID_PARAMS, `Unknown tool: ${name}`);
      }
      try {
        const data = await tool.handler(params?.arguments || {});
        return reply({
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
          isError: false,
        });
      } catch (err) {
        // Tool failures are reported in-band so the model can see and react to
        // them, rather than as transport errors that abort the call.
        return reply({
          content: [{ type: 'text', text: `Tool "${name}" failed: ${err.message}` }],
          isError: true,
        });
      }
    }

    default:
      return fail(JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method not supported: ${method}`);
  }
}

export function serve({ input = process.stdin, output = process.stdout, serverInfo } = {}) {
  return new Promise((resolve) => {
    let buffer = '';

    const write = (obj) => {
      output.write(`${JSON.stringify(obj)}\n`);
    };

    input.setEncoding('utf8');

    input.on('data', async (chunk) => {
      buffer += chunk;

      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;

        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          write({ jsonrpc: '2.0', id: null, error: { code: JSON_RPC_ERRORS.PARSE_ERROR, message: 'Invalid JSON' } });
          continue;
        }

        try {
          const response = await handleMessage(msg, { serverInfo });
          if (response) write(response);
        } catch (err) {
          if (msg?.id !== undefined && msg?.id !== null) {
            write({
              jsonrpc: '2.0',
              id: msg.id,
              error: { code: JSON_RPC_ERRORS.INTERNAL_ERROR, message: err.message },
            });
          }
        }
      }
    });

    input.on('end', resolve);
  });
}
