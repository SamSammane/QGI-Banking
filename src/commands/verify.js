import { readFileSync, existsSync } from 'node:fs';
import { runVerification } from '../verify/engine.js';
import { readLastTrace } from './reason.js';

const STATUS_MARK = { pass: 'PASS', warn: 'WARN', fail: 'FAIL', skipped: 'SKIP' };

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
  });
}

async function resolveInput(opts) {
  if (opts.trace) {
    if (opts.trace !== 'last') {
      console.error('Only `--trace last` is supported.');
      process.exit(2);
    }
    const trace = readLastTrace();
    if (!trace) {
      console.error('No prior reasoning trace found. Run `mineai reason "..."` first.');
      process.exit(2);
    }
    // A trace came from the mandated prompt, so the format is fair to enforce.
    return { text: trace.answer || '', source: 'reason trace (last)', expectFormat: true };
  }

  if (opts.input) {
    if (!existsSync(opts.input)) {
      console.error(`Input not found: ${opts.input}`);
      process.exit(2);
    }
    return { text: readFileSync(opts.input, 'utf8'), source: opts.input, expectFormat: Boolean(opts.strict) };
  }

  if (opts.claim) {
    return { text: opts.claim, source: 'claim', expectFormat: Boolean(opts.strict) };
  }

  const piped = await readStdin();
  if (piped.trim()) {
    return { text: piped, source: 'stdin', expectFormat: Boolean(opts.strict) };
  }

  console.error('Nothing to verify. Use --trace last, --claim "...", --input <file>, or pipe text on stdin.');
  process.exit(2);
}

function printReport(report) {
  console.log(`\n--- Symbolic verification (${report.source}, ${report.characters} chars) ---\n`);

  for (const check of report.checks) {
    console.log(`[${STATUS_MARK[check.status]}] ${check.title}`);
    console.log(`       ${check.detail}`);
    for (const line of check.evidence) console.log(`       - ${line}`);
    console.log('');
  }

  const s = report.summary;
  console.log(`Verdict: ${report.verdict}  (pass ${s.pass}, warn ${s.warn}, fail ${s.fail}, skipped ${s.skipped})`);

  if (report.verdict === 'FAIL') {
    console.log('\nA failing check means the generated text asserts something the local sources do not support.');
  }
  console.log(
    '\nThese are deterministic checks against the local citation set and, when enabled, a sanctions\n' +
      'index. They do not establish that an answer is correct — only that specific failure modes are\n' +
      'absent. Skipped checks are unknowns, not passes.\n'
  );
}

export async function verify(opts) {
  const { text, source, expectFormat } = await resolveInput(opts);

  const report = await runVerification(text, {
    expectFormat,
    screen: Boolean(opts.screen),
    source,
  });

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  // Distinct from the usage (2) and credential (3) codes already in use, so a
  // caller can tell "the tool broke" from "the content failed".
  if (report.verdict === 'FAIL') process.exit(4);
}
