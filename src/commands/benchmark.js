import { MODEL_CARDS, listCards } from '../models/cards.js';

const PHASES = {
  'Phase I (0–6 months)': [
    'Publish a public benchmark dataset of labeled digital-asset payment-fraud and AML/CFT cases',
    'Source from public on-chain data, OFAC sanctions designations, and open fraud reports',
    'Release benchmark-methodology technical report',
    'Target dissemination venue: NeurIPS Datasets & Benchmarks Track (or analogous)',
  ],
  'Phase II (6–12 months)': [
    'Extend CNN-LSTM, CSSA, and FinSCRA with adversarial-robustness evaluation',
    'Run ablation studies and replication on the Phase-I benchmark',
    'Peer-review targets: AAAI, IJCAI, IEEE S&P, Financial Cryptography and Data Security',
    'Peer-review targets: KDD, ACL Industry Track, EMNLP, NeurIPS, ICML',
  ],
  'Phase III (12+ months)': [
    'Public workshops and open-source reference releases',
    'Standards or public-comment contributions where appropriate',
    'Outreach to compliance, RegTech, digital-asset risk, and model-governance practitioners',
  ],
};

export async function benchmark(opts) {
  const wanted = opts.model ? opts.model.toLowerCase() : null;
  if (wanted && !MODEL_CARDS[wanted]) {
    console.error(`Unknown model "${opts.model}". Available: ${listCards().join(', ')}`);
    process.exit(2);
  }

  console.log('\nMine AI — Benchmark Roadmap\n');

  for (const [phase, items] of Object.entries(PHASES)) {
    console.log(phase);
    for (const it of items) console.log(`  - ${it}`);
    console.log();
  }

  console.log('Models tracked in the benchmark suite:');
  for (const key of listCards()) {
    if (wanted && key !== wanted) continue;
    const card = MODEL_CARDS[key];
    console.log(`  - [${key}] ${card.name}`);
    console.log(`      ${card.status}`);
  }

  if (opts.dataset) {
    console.log(`\nDataset path (informational only — no harness shipped in v0.1): ${opts.dataset}`);
  }

  console.log(
    '\nNote: the benchmark harness itself is not shipped in v0.1.\n' +
      '      v0.1 ships model cards and the roadmap that governs benchmark construction.\n'
  );
}
