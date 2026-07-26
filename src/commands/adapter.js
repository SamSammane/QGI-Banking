import { listAdapters, getAdapter, resolveUrl } from '../adapters/registry.js';
import { probe } from '../adapters/http.js';

export async function adapterList(opts = {}) {
  const adapters = listAdapters();

  if (opts.json) {
    console.log(JSON.stringify(adapters, null, 2));
    return;
  }

  console.log('\nIntegration registry — sibling reference implementations this CLI can drive.\n');

  for (const a of adapters) {
    const configured = a.configuredUrl ? a.configuredUrl : 'not configured';
    console.log(`  ${a.id}`);
    console.log(`    repo:       ${a.repo}`);
    console.log(`    kind/role:  ${a.kind} / ${a.role}`);
    console.log(`    capability: ${a.capability}`);
    console.log(`    status:     ${a.status}`);
    if (a.env) console.log(`    endpoint:   ${configured}  (${a.env})`);
    if (a.notes) console.log(`    notes:      ${a.notes}`);
    console.log('');
  }

  console.log('Role "symbolic" means deterministic and reproducible — those adapters can act as');
  console.log('verification oracles. Role "neural" means the output is a claim to be checked.\n');
  console.log('Use `mineai adapter check [id]` to probe reachability.\n');
}

export async function adapterCheck(id, opts = {}) {
  const targets = id ? [getAdapter(id)].filter(Boolean) : listAdapters().filter((a) => a.probePath);

  if (id && targets.length === 0) {
    console.error(`Unknown adapter "${id}". Try \`mineai adapter list\`.`);
    process.exit(2);
  }

  const results = [];
  for (const a of targets) {
    const url = resolveUrl(a);
    if (!url) {
      results.push({ id: a.id, configured: false, reachable: false, url: null, error: a.env ? `Set ${a.env}.` : 'No endpoint to probe.' });
      continue;
    }
    const r = await probe(url, a.probePath, { adapter: a.id });
    results.push({ id: a.id, configured: true, ...r });
  }

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log('');
  for (const r of results) {
    const state = !r.configured ? 'UNCONFIGURED' : r.reachable ? 'REACHABLE' : 'UNREACHABLE';
    const timing = r.reachable ? ` (${r.latencyMs}ms)` : '';
    console.log(`  [${state}] ${r.id}${timing}`);
    if (r.url) console.log(`      ${r.url}`);
    if (r.error) console.log(`      ${r.error}`);
  }
  console.log('');
}
