import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { detect } from './commands/detect.js';
import { benchmark } from './commands/benchmark.js';
import { patternList, patternShow } from './commands/pattern.js';
import { reason, reasonTrace } from './commands/reason.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const banner = `
Mine AI ${pkg.version}
Open-source reference implementations for AI-enabled payment security,
fraud detection, and AML/CFT compliance.

This is research and reference-implementation infrastructure.
Not financial, legal, or compliance advice.
`.trim();

export async function run(argv) {
  const program = new Command();

  program
    .name('mineai')
    .description(banner)
    .version(pkg.version, '-v, --version');

  program
    .command('detect')
    .description('Run a reference fraud-detection model card / feature snapshot over a sample.')
    .option('--model <name>', 'Model identifier: cnn-lstm | cssa | finscra', 'cnn-lstm')
    .option('--input <path>', 'Path to a transaction-graph sample (JSON).')
    .action(detect);

  program
    .command('benchmark')
    .description('Inspect the Phase I benchmark roadmap and target venues.')
    .option('--model <name>', 'Limit output to one model.')
    .option('--dataset <path>', 'Optional path to a dataset directory (informational).')
    .action(benchmark);

  const pattern = program
    .command('pattern')
    .description('Production risk-control and reconciliation patterns (Module 2).');

  pattern
    .command('list')
    .description('List available patterns.')
    .action(patternList);

  pattern
    .command('show <name>')
    .description('Print a pattern document.')
    .action(patternShow);

  program
    .command('reason')
    .argument('[question...]', 'A payment-security / AML/CFT research question.')
    .description('Interpretable, citation-grounded compliance-research reasoning (Module 3, calls an OpenAI-compatible endpoint).')
    .option('--trace <which>', 'Print the trace from the last reasoning call. Currently only "last" is supported.')
    .option('--model <id>', 'Override OPENAI_MODEL.')
    .action(async (questionParts, opts) => {
      if (opts.trace) return reasonTrace(opts.trace);
      const question = (questionParts || []).join(' ').trim();
      if (!question) {
        console.error('Usage: mineai reason "your question"');
        process.exit(2);
      }
      await reason(question, opts);
    });

  await program.parseAsync(argv);
}
