import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createServer } from 'node:http';

import { ADAPTERS, listAdapters, getAdapter, resolveUrl, isConfigured } from '../src/adapters/registry.js';
import { screenEntity, checkWatchman } from '../src/adapters/watchman.js';
import { runProcess } from '../src/adapters/process.js';
import { runVerification } from '../src/verify/engine.js';

/**
 * Stand up a stub that answers with Watchman's documented response shape:
 * SearchResponse{entities: []SearchedEntity} where SearchedEntity embeds Entity
 * and adds `match` (pkg/search/model_searched_entity.go).
 */
function withStubWatchman(handler) {
  return async (t) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      res.setHeader('content-type', 'application/json');
      if (url.pathname === '/v2/listinfo') {
        res.end(JSON.stringify({ lists: {} }));
        return;
      }
      res.end(
        JSON.stringify({
          entities: [
            { name: url.searchParams.get('name'), type: 'person', source: 'us_ofac', sourceID: '12345', match: 0.947321 },
            { name: 'OTHER PERSON', type: 'person', source: 'eu_csl', sourceID: '999', match: 0.881 },
          ],
        })
      );
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const previous = process.env.MINEAI_WATCHMAN_URL;
    process.env.MINEAI_WATCHMAN_URL = `http://127.0.0.1:${server.address().port}`;

    try {
      await handler(t, server);
    } finally {
      if (previous === undefined) delete process.env.MINEAI_WATCHMAN_URL;
      else process.env.MINEAI_WATCHMAN_URL = previous;
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

test('every registry entry declares the fields the commands render', () => {
  for (const a of ADAPTERS) {
    assert.equal(typeof a.id, 'string');
    assert.equal(typeof a.repo, 'string');
    assert.ok(a.capability.length > 0, `${a.id} needs a capability`);
    assert.ok(['symbolic', 'neural', 'reference'].includes(a.role), `${a.id} has an unexpected role`);
    assert.ok(['implemented', 'declared'].includes(a.status), `${a.id} has an unexpected status`);
  }
});

test('adapter ids are unique', () => {
  const ids = ADAPTERS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('watchman is the implemented adapter and is tagged symbolic', () => {
  const watchman = getAdapter('watchman');
  assert.equal(watchman.status, 'implemented');
  assert.equal(watchman.role, 'symbolic');
});

test('getAdapter returns null for an unknown id', () => {
  assert.equal(getAdapter('nonexistent'), null);
});

test('environment overrides the default endpoint', () => {
  const watchman = getAdapter('watchman');
  const previous = process.env.MINEAI_WATCHMAN_URL;
  try {
    delete process.env.MINEAI_WATCHMAN_URL;
    assert.equal(resolveUrl(watchman), 'http://localhost:8084');

    process.env.MINEAI_WATCHMAN_URL = 'https://watchman.internal:9000/';
    assert.equal(resolveUrl(watchman), 'https://watchman.internal:9000', 'trailing slash should be trimmed');
    assert.equal(isConfigured(watchman), true);
  } finally {
    if (previous === undefined) delete process.env.MINEAI_WATCHMAN_URL;
    else process.env.MINEAI_WATCHMAN_URL = previous;
  }
});

test('adapters without an endpoint resolve to null', () => {
  assert.equal(resolveUrl(getAdapter('finance-llms')), null);
  assert.equal(isConfigured(getAdapter('finance-llms')), false);
});

test('listAdapters annotates each entry with its resolved endpoint', () => {
  const entry = listAdapters().find((a) => a.id === 'watchman');
  assert.ok(Object.hasOwn(entry, 'configuredUrl'));
});

test('screenEntity rejects an empty name before any network call', async () => {
  await assert.rejects(() => screenEntity('   '), /name is required/i);
});

test('screenEntity reports missing configuration distinctly', async () => {
  const previous = process.env.MINEAI_WATCHMAN_URL;
  const adapter = getAdapter('watchman');
  const defaultUrl = adapter.defaultUrl;
  try {
    delete process.env.MINEAI_WATCHMAN_URL;
    adapter.defaultUrl = null; // simulate a build with no default endpoint
    await assert.rejects(() => screenEntity('Acme'), (err) => err.code === 'ADAPTER_NOT_CONFIGURED');
  } finally {
    adapter.defaultUrl = defaultUrl;
    if (previous !== undefined) process.env.MINEAI_WATCHMAN_URL = previous;
  }
});

test(
  'screenEntity maps the documented Watchman response shape',
  withStubWatchman(async () => {
    const res = await screenEntity('Vladimir Petrov', { limit: 3, minMatch: 0.85 });
    assert.equal(res.matchCount, 2);

    const [top] = res.matches;
    assert.equal(top.name, 'Vladimir Petrov');
    assert.equal(top.source, 'us_ofac');
    assert.equal(top.sourceID, '12345');
    assert.equal(top.match, 0.9473, 'scores are rounded for display, not reinterpreted');
    assert.deepEqual(res.query, { name: 'Vladimir Petrov', type: null, limit: 3, minMatch: 0.85 });
  })
);

test(
  'checkWatchman probes a reachable instance',
  withStubWatchman(async () => {
    const status = await checkWatchman();
    assert.equal(status.configured, true);
    assert.equal(status.reachable, true);
  })
);

test(
  'verify --screen turns a sanctions hit into a warning',
  withStubWatchman(async () => {
    const report = await runVerification('Funds routed through Vladimir Petrov, citing [OFAC].', { screen: true });
    const screening = report.checks.find((c) => c.id === 'sanctions-screening');
    assert.equal(screening.status, 'warn');
    assert.match(screening.evidence.join(' '), /us_ofac/);
    assert.equal(report.verdict, 'WARN');
  })
);

test('screening degrades to skipped when the backend is unreachable', async () => {
  const previous = process.env.MINEAI_WATCHMAN_URL;
  process.env.MINEAI_WATCHMAN_URL = 'http://127.0.0.1:1';
  try {
    const report = await runVerification('Acme Holdings moved funds, citing [OFAC].', { screen: true });
    const screening = report.checks.find((c) => c.id === 'sanctions-screening');
    assert.equal(screening.status, 'skipped', 'an unrun check must not read as a clean one');
    assert.match(screening.detail, /unknown, not clean/);
  } finally {
    if (previous === undefined) delete process.env.MINEAI_WATCHMAN_URL;
    else process.env.MINEAI_WATCHMAN_URL = previous;
  }
});

test('runProcess captures stdout and the exit code', async () => {
  const res = await runProcess(process.execPath, ['-e', 'process.stdout.write("ok")']);
  assert.equal(res.code, 0);
  assert.equal(res.stdout, 'ok');
});

test('runProcess surfaces a non-zero exit rather than throwing', async () => {
  const res = await runProcess(process.execPath, ['-e', 'process.stderr.write("bad"); process.exit(3)']);
  assert.equal(res.code, 3);
  assert.equal(res.stderr, 'bad');
});

test('runProcess kills a process that exceeds its timeout', async () => {
  await assert.rejects(
    () => runProcess(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], { timeoutMs: 200 }),
    (err) => err.code === 'ADAPTER_TIMEOUT'
  );
});
