// Symbolic checkers.
//
// Each checker takes model-produced text and decides something about it using
// only deterministic rules and the local citation set — no second model call.
// That is the point: a generated answer is a claim, and a claim is only worth
// as much as the check you can run against it without asking the generator
// whether it was right.
//
// Every checker returns the same shape so the engine can treat them uniformly:
//   { id, title, status, detail, evidence[] }
// where status is 'pass' | 'warn' | 'fail' | 'skipped'.

import { CITATIONS, citationKeys } from '../policy/citations.js';

export const REQUIRED_SECTIONS = ['Short Answer', 'Reasoning', 'Sources Used', 'Caveats'];

function result(id, title, status, detail, evidence = []) {
  return { id, title, status, detail, evidence };
}

/** Bracketed citation tokens, e.g. [BSA] or [MRM-2026]. */
export function extractCitationKeys(text) {
  const found = [];
  const re = /\[([A-Za-z][A-Za-z0-9-]{1,30})\]/g;
  let m;
  while ((m = re.exec(String(text))) !== null) found.push(m[1]);
  return found;
}

/**
 * A citation key the model invented is the highest-value thing this tool can
 * catch, because it is indistinguishable from a real one at a glance and it is
 * exactly what a reader will rely on.
 */
export function checkCitationKeys(text) {
  const known = new Set(citationKeys());
  const used = extractCitationKeys(text);
  const unique = [...new Set(used)];

  if (unique.length === 0) {
    return result(
      'citation-keys',
      'Citation keys resolve to the local citation set',
      'warn',
      'No citation keys were found. A grounded answer should cite at least one key.',
      []
    );
  }

  const unknown = unique.filter((k) => !known.has(k));
  if (unknown.length > 0) {
    return result(
      'citation-keys',
      'Citation keys resolve to the local citation set',
      'fail',
      `${unknown.length} citation key(s) do not exist in the citation set and appear to be fabricated.`,
      unknown.map((k) => `[${k}] is not one of: ${[...known].join(', ')}`)
    );
  }

  return result(
    'citation-keys',
    'Citation keys resolve to the local citation set',
    'pass',
    `All ${unique.length} cited key(s) exist in the citation set.`,
    unique.map((k) => `[${k}] OK`)
  );
}

/** Section headings the reasoning prompt mandates. */
export function checkStructure(text) {
  const missing = REQUIRED_SECTIONS.filter((s) => !new RegExp(s.replace(/\s+/g, '\\s+'), 'i').test(text));
  if (missing.length > 0) {
    return result(
      'structure',
      'Answer follows the mandated reasoning format',
      'fail',
      `${missing.length} required section(s) are missing.`,
      missing.map((s) => `Missing section: ${s}`)
    );
  }
  return result('structure', 'Answer follows the mandated reasoning format', 'pass', 'All required sections are present.');
}

/**
 * The "Sources Used" list is the model's own summary of what it relied on. If
 * it disagrees with the keys actually cited in the reasoning chain, at least
 * one of the two is wrong.
 */
export function checkSourcesConsistency(text) {
  const sourcesIdx = text.search(/Sources\s+Used/i);
  if (sourcesIdx === -1) {
    return result('sources-consistency', 'Sources Used matches the reasoning chain', 'skipped', 'No "Sources Used" section to compare.');
  }

  const caveatsIdx = text.search(/Caveats/i);
  const sourcesBlock = text.slice(sourcesIdx, caveatsIdx > sourcesIdx ? caveatsIdx : undefined);
  const reasoningBlock = text.slice(0, sourcesIdx);

  const declared = new Set(extractCitationKeys(sourcesBlock));
  const cited = new Set(extractCitationKeys(reasoningBlock));

  // A key listed in Sources Used but never actually cited is padding; a key
  // cited but not listed means the summary understates what the answer leaned on.
  const undeclared = [...cited].filter((k) => !declared.has(k));
  const unused = [...declared].filter((k) => !cited.has(k));

  if (undeclared.length === 0 && unused.length === 0) {
    return result('sources-consistency', 'Sources Used matches the reasoning chain', 'pass', 'Declared sources match the keys cited in the reasoning.');
  }

  const evidence = [
    ...undeclared.map((k) => `[${k}] cited in reasoning but absent from Sources Used`),
    ...unused.map((k) => `[${k}] listed in Sources Used but never cited in reasoning`),
  ];
  return result(
    'sources-consistency',
    'Sources Used matches the reasoning chain',
    'warn',
    'The declared source list and the cited keys disagree.',
    evidence
  );
}

/** Numbers that appear anywhere in the citation corpus, as bare digit strings. */
export function groundedNumbers() {
  const corpus = CITATIONS.map((c) => `${c.title} ${c.citation} ${c.summary}`).join(' ');
  return new Set((corpus.match(/\d+(?:\.\d+)?/g) || []));
}

/**
 * Any dollar or percentage figure that does not appear in the citation corpus
 * is unverifiable from local sources. This warns rather than fails: the figure
 * may be arithmetic the model derived legitimately, and this checker cannot
 * tell the difference. It marks what a reviewer must confirm by hand.
 */
export function checkNumericClaims(text) {
  const grounded = groundedNumbers();
  const figures = [];
  const re = /(?:\$\s?\d+(?:[.,]\d+)*(?:\s?(?:billion|million|trillion|thousand))?|\d+(?:\.\d+)?\s?%)/gi;
  let m;
  while ((m = re.exec(String(text))) !== null) figures.push(m[0].trim());

  if (figures.length === 0) {
    return result('numeric-grounding', 'Quantitative claims trace to the citation set', 'pass', 'No quantitative claims were made.');
  }

  const ungrounded = [...new Set(figures)].filter((f) => {
    const digits = f.match(/\d+(?:\.\d+)?/g) || [];
    return !digits.every((d) => grounded.has(d));
  });

  if (ungrounded.length === 0) {
    return result(
      'numeric-grounding',
      'Quantitative claims trace to the citation set',
      'pass',
      `All ${figures.length} figure(s) appear in the citation set.`
    );
  }

  return result(
    'numeric-grounding',
    'Quantitative claims trace to the citation set',
    'warn',
    `${ungrounded.length} figure(s) do not appear in the citation set and need a primary source.`,
    ungrounded.map((f) => `Unverified figure: ${f}`)
  );
}

const PROHIBITED_MARKERS = [
  { pattern: /SAR\s+narrative/i, label: 'SAR narrative' },
  { pattern: /suspicious\s+activity\s+report\s+narrative/i, label: 'SAR narrative' },
  { pattern: /legal\s+opinion/i, label: 'rendered legal opinion' },
  { pattern: /\bwe\s+advise\s+you\s+to\b/i, label: 'directive advice' },
  { pattern: /\byou\s+(?:must|are\s+required\s+to)\s+file\b/i, label: 'filing instruction' },
];

// Whether the surrounding sentence is declining to do the thing rather than
// doing it. Crude, and the reason this checker warns instead of failing.
const REFUSAL_NEAR = /\b(?:cannot|can't|will not|won't|do not|don't|unable to|not able to|redirect|consult|qualified)\b/i;

export function checkProhibitedOutput(text) {
  const hits = [];
  for (const { pattern, label } of PROHIBITED_MARKERS) {
    const m = pattern.exec(text);
    if (!m) continue;
    const start = Math.max(0, m.index - 120);
    const context = text.slice(start, m.index + m[0].length + 120);
    if (REFUSAL_NEAR.test(context)) continue; // mentioned while declining
    hits.push(`${label}: "...${context.replace(/\s+/g, ' ').trim()}..."`);
  }

  if (hits.length === 0) {
    return result('prohibited-output', 'No prohibited advisory output', 'pass', 'No SAR narrative or rendered legal opinion detected.');
  }

  return result(
    'prohibited-output',
    'No prohibited advisory output',
    'warn',
    `${hits.length} passage(s) may cross from research aid into regulated advice. Human review required.`,
    hits
  );
}

/**
 * Capitalised multi-word runs, as screening candidates. This is a shallow
 * heuristic, not named-entity recognition — it over-collects, and the screening
 * check is written to tolerate that.
 */
export function extractEntityCandidates(text) {
  const stop = new Set([
    ...REQUIRED_SECTIONS,
    'Short Answer',
    'Sources Used',
    'The Bank',
    'United States',
    'Executive Order',
    'Bank Secrecy Act',
  ]);
  const found = new Set();
  const re = /\b([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){1,3})\b/g;
  let m;
  while ((m = re.exec(String(text))) !== null) {
    const candidate = m[1].trim();
    if (!stop.has(candidate)) found.add(candidate);
  }
  return [...found];
}
