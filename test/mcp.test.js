import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleMessage, SUPPORTED_PROTOCOL_VERSION } from '../src/mcp/server.js';
import { toolDefinitions, findTool } from '../src/mcp/tools.js';

const CTX = { serverInfo: { name: 'mineai', version: 'test' } };

test('initialize advertises tool capability and echoes the client protocol version', async () => {
  const res = await handleMessage(
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
    CTX
  );
  assert.equal(res.result.protocolVersion, '2025-03-26');
  assert.deepEqual(res.result.capabilities, { tools: {} });
  assert.equal(res.result.serverInfo.name, 'mineai');
});

test('initialize falls back to the supported version when the client names none', async () => {
  const res = await handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, CTX);
  assert.equal(res.result.protocolVersion, SUPPORTED_PROTOCOL_VERSION);
});

test('notifications receive no reply', async () => {
  assert.equal(await handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, CTX), null);
});

test('tools/list returns well-formed definitions', async () => {
  const res = await handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, CTX);
  const tools = res.result.tools;
  assert.ok(tools.length >= 8);
  for (const t of tools) {
    assert.equal(typeof t.name, 'string');
    assert.ok(t.description.length > 0);
    assert.equal(t.inputSchema.type, 'object');
  }
  assert.ok(tools.some((t) => t.name === 'verify_reasoning'));
});

test('tools/call runs a tool and returns text content', async () => {
  const res = await handleMessage(
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'verify_reasoning', arguments: { text: 'Grounded in [BSA].' } },
    },
    CTX
  );
  assert.equal(res.result.isError, false);
  const payload = JSON.parse(res.result.content[0].text);
  assert.equal(payload.verdict, 'PASS');
});

test('tools/call reports tool failure in-band rather than as a transport error', async () => {
  const res = await handleMessage(
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_pattern', arguments: { name: 'nope' } } },
    CTX
  );
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /not found/);
  assert.equal(res.error, undefined);
});

test('tools/call rejects an unknown tool with invalid params', async () => {
  const res = await handleMessage(
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'no_such_tool' } },
    CTX
  );
  assert.equal(res.error.code, -32602);
});

test('unsupported methods return method-not-found', async () => {
  const res = await handleMessage({ jsonrpc: '2.0', id: 6, method: 'resources/list' }, CTX);
  assert.equal(res.error.code, -32601);
});

test('ping is answered', async () => {
  const res = await handleMessage({ jsonrpc: '2.0', id: 7, method: 'ping' }, CTX);
  assert.deepEqual(res.result, {});
});

test('every advertised tool has a handler', () => {
  for (const def of toolDefinitions()) {
    assert.equal(typeof findTool(def.name).handler, 'function');
  }
});

test('read-only tools return data without a configured backend', async () => {
  for (const name of ['list_citations', 'list_patterns', 'list_models', 'list_adapters']) {
    const res = await handleMessage(
      { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name, arguments: {} } },
      CTX
    );
    assert.equal(res.result.isError, false, `${name} should not error`);
  }
});
