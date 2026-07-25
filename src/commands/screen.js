import { screenEntity } from '../adapters/watchman.js';

export async function screen(name, opts = {}) {
  let res;
  try {
    res = await screenEntity(name, {
      type: opts.type || null,
      limit: Number(opts.limit) || 5,
      minMatch: opts.minMatch === undefined ? 0.85 : Number(opts.minMatch),
    });
  } catch (err) {
    console.error(err.message);

    // Whether the endpoint is unset or simply not answering, the fix is the
    // same: point the CLI at a running instance and confirm it responds.
    const endpointProblem = ['ADAPTER_NOT_CONFIGURED', 'ADAPTER_UNREACHABLE', 'ADAPTER_TIMEOUT'].includes(err.code);
    if (endpointProblem) {
      console.error('\nScreening needs a running Watchman instance:');
      console.error('  export MINEAI_WATCHMAN_URL=http://localhost:8084');
      console.error('  mineai adapter check watchman');
    }
    process.exit(err.code === 'ADAPTER_NOT_CONFIGURED' ? 3 : 5);
  }

  if (opts.json) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  console.log(`\n--- Sanctions / PEP screening: "${res.query.name}" ---`);
  console.log(`Source:    ${res.source}`);
  console.log(`Threshold: minMatch ${res.query.minMatch}\n`);

  if (res.matchCount === 0) {
    console.log('No matches at or above the threshold.\n');
    console.log('A clean result reflects the lists this instance has downloaded and the threshold used.\n');
    return;
  }

  for (const m of res.matches) {
    console.log(`  ${m.match ?? '?'}  ${m.name ?? '(unnamed)'}`);
    console.log(`         type=${m.type ?? '-'}  list=${m.source ?? '-'}  id=${m.sourceID ?? '-'}`);
  }
  console.log('\nMatches are name-similarity scores, not confirmed identifications. Adjudicate before acting.\n');
}
