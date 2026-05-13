import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATTERNS_DIR = join(__dirname, '..', '..', 'patterns');

function listPatternFiles() {
  if (!existsSync(PATTERNS_DIR)) return [];
  return readdirSync(PATTERNS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ name: basename(f, '.md'), file: join(PATTERNS_DIR, f) }));
}

function firstHeading(md) {
  const line = md.split('\n').find((l) => l.startsWith('# '));
  return line ? line.replace(/^#\s+/, '').trim() : '';
}

export async function patternList() {
  const items = listPatternFiles();
  if (items.length === 0) {
    console.log('No patterns installed.');
    return;
  }
  console.log('\nAvailable patterns (Module 2 — production risk-control & reconciliation):\n');
  for (const it of items) {
    let title = '';
    try {
      title = firstHeading(readFileSync(it.file, 'utf8'));
    } catch {}
    console.log(`  ${it.name}`);
    if (title) console.log(`    ${title}`);
  }
  console.log('\nUse `mineai pattern show <name>` to read one.\n');
}

export async function patternShow(name) {
  const items = listPatternFiles();
  const match = items.find((it) => it.name === name);
  if (!match) {
    console.error(`Pattern "${name}" not found. Try \`mineai pattern list\`.`);
    process.exit(2);
  }
  const md = readFileSync(match.file, 'utf8');
  process.stdout.write(md);
  if (!md.endsWith('\n')) process.stdout.write('\n');
}
