import { readFileSync, existsSync } from 'node:fs';
import { getCard, listCards } from '../models/cards.js';

function printCard(card) {
  const p = card.paper || {};
  console.log(`\n=== ${card.name} ===\n`);
  console.log(`Purpose:\n  ${card.purpose}\n`);
  console.log('Addresses:');
  for (const a of card.addresses) console.log(`  - ${a}`);
  console.log('\nReference publication:');
  if (p.title) console.log(`  Title:     ${p.title}`);
  if (p.authors) console.log(`  Authors:   ${p.authors}`);
  if (p.venue) console.log(`  Venue:     ${p.venue}`);
  if (p.publisher) console.log(`  Publisher: ${p.publisher}`);
  if (p.year) console.log(`  Year:      ${p.year}`);
  if (p.doi) console.log(`  DOI:       ${p.doi}`);
  if (p.url) console.log(`  URL:       ${p.url}`);
  console.log(`\nStatus:\n  ${card.status}\n`);
}

function featureSnapshot(sample) {
  const txs = Array.isArray(sample?.transactions) ? sample.transactions : [];
  if (txs.length === 0) {
    return { error: 'No transactions[] array found in input sample.' };
  }

  const addresses = new Set();
  const edges = [];
  const amounts = [];
  let earliest = Infinity;
  let latest = -Infinity;

  for (const tx of txs) {
    if (tx.from) addresses.add(tx.from);
    if (tx.to) addresses.add(tx.to);
    if (tx.from && tx.to) edges.push([tx.from, tx.to]);
    if (typeof tx.amount === 'number') amounts.push(tx.amount);
    const ts = typeof tx.timestamp === 'number' ? tx.timestamp : Date.parse(tx.timestamp);
    if (Number.isFinite(ts)) {
      earliest = Math.min(earliest, ts);
      latest = Math.max(latest, ts);
    }
  }

  const total = amounts.reduce((s, x) => s + x, 0);
  const mean = amounts.length ? total / amounts.length : 0;
  const spanMs = Number.isFinite(earliest) && Number.isFinite(latest) ? latest - earliest : null;

  return {
    transactions: txs.length,
    unique_addresses: addresses.size,
    edges: edges.length,
    total_amount: total,
    mean_amount: Number(mean.toFixed(6)),
    time_span_seconds: spanMs == null ? null : Math.round(spanMs / 1000),
    labeled: txs.filter((t) => t.label !== undefined).length,
  };
}

export async function detect(opts) {
  const key = (opts.model || 'cnn-lstm').toLowerCase();
  const card = getCard(key);
  if (!card) {
    console.error(`Unknown model "${opts.model}". Available: ${listCards().join(', ')}`);
    process.exit(2);
  }
  printCard(card);

  if (!opts.input) {
    console.log('Hint: pass --input <sample.json> to compute a feature snapshot.');
    console.log('      A small synthetic sample is provided at samples/btc-fraud-sample.json.\n');
    return;
  }

  if (!existsSync(opts.input)) {
    console.error(`Input not found: ${opts.input}`);
    process.exit(2);
  }

  let sample;
  try {
    sample = JSON.parse(readFileSync(opts.input, 'utf8'));
  } catch (e) {
    console.error(`Failed to parse JSON input: ${e.message}`);
    process.exit(2);
  }

  console.log('--- Feature snapshot (illustrative, not a trained-model prediction) ---');
  const snap = featureSnapshot(sample);
  console.log(JSON.stringify(snap, null, 2));
  console.log(
    '\nNote: this is a graph-level descriptive summary intended to seed reproducible benchmark work.\n' +
      '      It is not the trained CNN-LSTM / CSSA / FinSCRA detector itself.\n' +
      '      Full training and inference reference code is tracked under Roadmap Phase I.\n'
  );
}
