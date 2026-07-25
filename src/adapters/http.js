// Minimal JSON-over-HTTP helper shared by the service adapters. Deliberately
// dependency-free: every sibling service we call speaks plain JSON, and adding
// a client library would widen the install surface of a CLI whose whole appeal
// is that it installs in one step.

const DEFAULT_TIMEOUT_MS = 10_000;

export class AdapterError extends Error {
  constructor(message, { code = 'ADAPTER_ERROR', adapter = null, status = null } = {}) {
    super(message);
    this.name = 'AdapterError';
    this.code = code;
    this.adapter = adapter;
    this.status = status;
  }
}

export async function getJson(url, { timeoutMs = DEFAULT_TIMEOUT_MS, adapter = null, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new AdapterError(`Request to ${url} timed out after ${timeoutMs}ms.`, {
        code: 'ADAPTER_TIMEOUT',
        adapter,
      });
    }
    throw new AdapterError(`Could not reach ${url}: ${err.message}`, {
      code: 'ADAPTER_UNREACHABLE',
      adapter,
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new AdapterError(`HTTP ${res.status} ${res.statusText} from ${url}\n${text.slice(0, 500)}`, {
      code: 'ADAPTER_HTTP_ERROR',
      adapter,
      status: res.status,
    });
  }

  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new AdapterError(`Response from ${url} was not valid JSON:\n${text.slice(0, 500)}`, {
      code: 'ADAPTER_BAD_JSON',
      adapter,
    });
  }
}

// Liveness probe used by `mineai adapter check`. Reachability is reported as a
// value rather than thrown, because checking every adapter should not stop at
// the first one that happens to be down.
export async function probe(url, path, { timeoutMs = 3000, adapter = null } = {}) {
  const target = `${url}${path || '/'}`;
  const started = Date.now();
  try {
    await getJson(target, { timeoutMs, adapter });
    return { reachable: true, url: target, latencyMs: Date.now() - started, error: null };
  } catch (err) {
    // A non-JSON or error-status response still proves something is listening,
    // which is what a liveness probe is actually asking.
    const listening = err.code === 'ADAPTER_HTTP_ERROR' || err.code === 'ADAPTER_BAD_JSON';
    return {
      reachable: listening,
      url: target,
      latencyMs: Date.now() - started,
      error: listening ? null : err.message,
    };
  }
}
