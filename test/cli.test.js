import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runProcess } from '../src/adapters/process.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'bin', 'mineai.js');

// The screening adapter must never be reached by these tests; point it at a
// port nothing is listening on so a stray call fails fast instead of hanging.
const ENV = { MINEAI_WATCHMAN_URL: 'http://127.0.0.1:1' };

function mineai(args, opts = {}) {
  return runProcess(process.execPath, [BIN, ...args], { cwd: ROOT, env: ENV, timeoutMs: 30_000, ...opts });
}

test('--help lists the new commands', async () => {
  const { code, stdout } = await mineai(['--help']);
  assert.equal(code, 0);
  for (const cmd of ['verify', 'screen', 'adapter', 'mcp']) {
    assert.match(stdout, new RegExp(`\\b${cmd}\\b`), `${cmd} should appear in help`);
  }
});

test('adapter list --json reports every integration point', async () => {
  const { code, stdout } = await mineai(['adapter', 'list', '--json']);
  assert.equal(code, 0);
  const adapters = JSON.parse(stdout);
  assert.ok(adapters.length >= 9);
  assert.ok(adapters.some((a) => a.id === 'watchman' && a.status === 'implemented'));
});

test('verify --claim exits 0 on a grounded claim', async () => {
  const { code, stdout } = await mineai(['verify', '--claim', 'Reporting duties arise under [BSA].', '--json']);
  assert.equal(code, 0);
  assert.equal(JSON.parse(stdout).verdict, 'PASS');
});

test('verify exits 4 when a citation is fabricated', async () => {
  const { code, stdout } = await mineai(['verify', '--claim', 'Required by [MADE-UP-ACT].', '--json']);
  assert.equal(code, 4, 'content failure must be distinguishable from a usage error');
  assert.equal(JSON.parse(stdout).verdict, 'FAIL');
});

test('verify exits 2 when given nothing to check', async () => {
  const { code, stderr } = await mineai(['verify'], { input: '' });
  assert.equal(code, 2);
  assert.match(stderr, /Nothing to verify/);
});

test('verify reads piped text from stdin', async () => {
  const { code, stdout } = await mineai(['verify', '--json'], { input: 'Grounded in [OFAC].\n' });
  assert.equal(code, 0);
  const report = JSON.parse(stdout);
  assert.equal(report.source, 'stdin');
  assert.equal(report.verdict, 'PASS');
});

test('screen exits 5 and points at the endpoint when Watchman is unreachable', async () => {
  const { code, stderr } = await mineai(['screen', 'Acme Holdings']);
  assert.equal(code, 5, 'an unreachable backend is distinct from a usage error');
  assert.match(stderr, /MINEAI_WATCHMAN_URL/);
});

test('mcp tools --json advertises the tool surface', async () => {
  const { code, stdout } = await mineai(['mcp', 'tools', '--json']);
  assert.equal(code, 0);
  assert.ok(JSON.parse(stdout).tools.some((t) => t.name === 'screen_entity'));
});

test('mcp serve answers a JSON-RPC handshake over stdio', async () => {
  const requests =
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }) +
    '\n' +
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) +
    '\n' +
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) +
    '\n';

  const { stdout } = await mineai(['mcp', 'serve'], { input: requests });
  const frames = stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

  assert.equal(frames.length, 2, 'the notification must not produce a frame');
  assert.equal(frames[0].result.serverInfo.name, 'mineai');
  assert.ok(frames[1].result.tools.length >= 8);
});
