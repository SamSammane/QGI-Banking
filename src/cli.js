import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { detect } from './commands/detect.js';
import { benchmark } from './commands/benchmark.js';
import { patternList, patternShow } from './commands/pattern.js';
import { reason, reasonTrace } from './commands/reason.js';
import { verify } from './commands/verify.js';
import { screen } from './commands/screen.js';
import { adapterList, adapterCheck } from './commands/adapter.js';
import { mcpServe, mcpTools } from './commands/mcp.js';

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

  program
    .command('verify')
    .description(
      'Check model-generated text against the local citation set with deterministic rules (Module 4, neural-symbolic).'
    )
    .option('--trace <which>', 'Verify the last `mineai reason` answer. Currently only "last" is supported.')
    .option('--claim <text>', 'Verify a claim passed inline.')
    .option('--input <path>', 'Verify the contents of a file.')
    .option('--screen', 'Also screen extracted entity names against sanctions lists (needs Watchman).')
    .option('--strict', 'Enforce the mandated section structure on non-trace input.')
    .option('--json', 'Emit the report as JSON.')
    .action(verify);

  program
    .command('screen')
    .argument('<name>', 'Entity name to screen.')
    .description('Screen a name against sanctions / PEP lists via a configured Watchman instance.')
    .option('--type <type>', 'person | business | organization | aircraft | vessel')
    .option('--limit <n>', 'Maximum matches to return.', '5')
    .option('--min-match <score>', 'Minimum similarity score, 0 to 1.', '0.85')
    .option('--json', 'Emit results as JSON.')
    .action(screen);

  const adapter = program
    .command('adapter')
    .description('Integration registry for the sibling reference implementations.');

  adapter
    .command('list')
    .description('List known integration points and whether each is configured.')
    .option('--json', 'Emit the registry as JSON.')
    .action(adapterList);

  adapter
    .command('check')
    .argument('[id]', 'Adapter id. Omit to probe every adapter that has an endpoint.')
    .description('Probe adapter reachability.')
    .option('--json', 'Emit probe results as JSON.')
    .action(adapterCheck);

  const mcp = program.command('mcp').description('Expose these capabilities to MCP clients.');

  mcp
    .command('serve')
    .description('Run an MCP server over stdio.')
    .action(mcpServe);

  mcp
    .command('tools')
    .description('List the tools that `mcp serve` exposes.')
    .option('--json', 'Emit tool definitions as JSON.')
    .action(mcpTools);

  await program.parseAsync(argv);
}
