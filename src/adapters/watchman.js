// Screening adapter over a running Watchman instance.
//
// This is the symbolic half of the neural-symbolic loop: Watchman resolves a
// name against sanctions and PEP source lists by deterministic matching, so the
// same query returns the same score every time. That property is what makes it
// usable as an oracle for checking what a language model asserted.

import { getJson, probe, AdapterError } from './http.js';
import { getAdapter, resolveUrl } from './registry.js';

export const ADAPTER_ID = 'watchman';

export function watchmanUrl() {
  return resolveUrl(getAdapter(ADAPTER_ID));
}

export async function checkWatchman() {
  const adapter = getAdapter(ADAPTER_ID);
  const url = resolveUrl(adapter);
  if (!url) {
    return { configured: false, reachable: false, url: null, error: `Set ${adapter.env}.` };
  }
  const result = await probe(url, adapter.probePath, { adapter: ADAPTER_ID });
  return { configured: true, ...result };
}

/**
 * Screen a single entity name against the configured Watchman instance.
 * Returns matches sorted by descending score, as reported by the server.
 */
export async function screenEntity(name, { type = null, limit = 5, minMatch = 0.85, timeoutMs = 10_000 } = {}) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw new AdapterError('An entity name is required.', { code: 'ADAPTER_BAD_REQUEST', adapter: ADAPTER_ID });
  }

  const url = watchmanUrl();
  if (!url) {
    throw new AdapterError(
      'Watchman is not configured. Set MINEAI_WATCHMAN_URL to a running instance (default http://localhost:8084).',
      { code: 'ADAPTER_NOT_CONFIGURED', adapter: ADAPTER_ID }
    );
  }

  const params = new URLSearchParams({ name: trimmed, limit: String(limit) });
  if (minMatch > 0) params.set('minMatch', String(minMatch));
  if (type) params.set('type', String(type).toLowerCase());

  const body = await getJson(`${url}/v2/search?${params.toString()}`, { timeoutMs, adapter: ADAPTER_ID });
  const entities = Array.isArray(body?.entities) ? body.entities : [];

  return {
    query: { name: trimmed, type, limit, minMatch },
    source: url,
    matchCount: entities.length,
    matches: entities.map((e) => ({
      name: e.name ?? null,
      type: e.type ?? null,
      source: e.source ?? null,
      sourceID: e.sourceID ?? null,
      match: typeof e.match === 'number' ? Number(e.match.toFixed(4)) : null,
    })),
  };
}
