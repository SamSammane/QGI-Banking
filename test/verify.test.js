import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractCitationKeys,
  checkCitationKeys,
  checkStructure,
  checkSourcesConsistency,
  checkNumericClaims,
  checkProhibitedOutput,
  extractEntityCandidates,
} from '../src/verify/checkers.js';
import { runVerification, verdictOf } from '../src/verify/engine.js';

const WELL_FORMED = `
1. Short Answer — Covered institutions have SAR obligations.

2. Reasoning
   1. Recordkeeping and reporting duties arise under [BSA].
   2. Those duties were expanded by [AMLA2020].

3. Sources Used
   - [BSA]
   - [AMLA2020]

4. Caveats — Verify with primary sources and qualified counsel.
`;

test('extractCitationKeys finds bracketed tokens', () => {
  assert.deepEqual(extractCitationKeys('see [BSA] and [MRM-2026]'), ['BSA', 'MRM-2026']);
  assert.deepEqual(extractCitationKeys('no citations here'), []);
});

test('checkCitationKeys passes when every key exists', () => {
  const r = checkCitationKeys('grounded in [BSA] and [OFAC]');
  assert.equal(r.status, 'pass');
});

test('checkCitationKeys fails on a fabricated key', () => {
  const r = checkCitationKeys('as established by [FAKE-ACT-1999]');
  assert.equal(r.status, 'fail');
  assert.match(r.evidence[0], /FAKE-ACT-1999/);
});

test('checkCitationKeys warns when nothing is cited', () => {
  assert.equal(checkCitationKeys('an assertion with no support').status, 'warn');
});

test('checkStructure detects missing sections', () => {
  assert.equal(checkStructure(WELL_FORMED).status, 'pass');

  const r = checkStructure('Short Answer — yes. Reasoning: because.');
  assert.equal(r.status, 'fail');
  assert.equal(r.evidence.length, 2); // Sources Used, Caveats
});

test('checkSourcesConsistency flags a declared source that was never cited', () => {
  const text = WELL_FORMED.replace('   - [AMLA2020]', '   - [AMLA2020]\n   - [OFAC]');
  const r = checkSourcesConsistency(text);
  assert.equal(r.status, 'warn');
  assert.match(r.evidence.join(' '), /OFAC.*never cited/);
});

test('checkSourcesConsistency flags a cited key missing from the source list', () => {
  const text = WELL_FORMED.replace('expanded by [AMLA2020]', 'expanded by [AMLA2020] and [EO-14178]');
  const r = checkSourcesConsistency(text);
  assert.equal(r.status, 'warn');
  assert.match(r.evidence.join(' '), /EO-14178.*absent from Sources Used/);
});

test('checkSourcesConsistency passes when the two agree', () => {
  assert.equal(checkSourcesConsistency(WELL_FORMED).status, 'pass');
});

test('checkNumericClaims accepts figures present in the citation corpus', () => {
  // 20.877 comes from the IC3-2025 citation summary.
  const r = checkNumericClaims('IC3 reported approximately $20.877 billion in losses.');
  assert.equal(r.status, 'pass');
});

test('checkNumericClaims warns on a figure absent from the corpus', () => {
  const r = checkNumericClaims('Losses totalled $47.3 billion last year.');
  assert.equal(r.status, 'warn');
  assert.match(r.evidence[0], /47\.3/);
});

test('checkNumericClaims passes when no figures are asserted', () => {
  assert.equal(checkNumericClaims('A qualitative statement.').status, 'pass');
});

test('checkProhibitedOutput ignores a marker used while declining', () => {
  const r = checkProhibitedOutput('I cannot produce a SAR narrative; consult a qualified compliance professional.');
  assert.equal(r.status, 'pass');
});

test('checkProhibitedOutput flags a marker used affirmatively', () => {
  const r = checkProhibitedOutput('SAR narrative: the subject structured deposits across nine branches.');
  assert.equal(r.status, 'warn');
});

test('extractEntityCandidates collects capitalised runs and drops section headings', () => {
  const names = extractEntityCandidates('Acme Holdings transferred funds. Short Answer — see below.');
  assert.ok(names.includes('Acme Holdings'));
  assert.ok(!names.includes('Short Answer'));
});

test('verdictOf reduces to the worst status', () => {
  assert.equal(verdictOf([{ status: 'pass' }, { status: 'skipped' }]), 'PASS');
  assert.equal(verdictOf([{ status: 'pass' }, { status: 'warn' }]), 'WARN');
  assert.equal(verdictOf([{ status: 'warn' }, { status: 'fail' }]), 'FAIL');
});

test('runVerification passes a well-formed grounded answer', async () => {
  const report = await runVerification(WELL_FORMED, { expectFormat: true });
  assert.equal(report.verdict, 'PASS');
  assert.equal(report.summary.fail, 0);
});

test('runVerification fails an answer citing a fabricated authority', async () => {
  const report = await runVerification(WELL_FORMED.replace('[BSA]', '[INVENTED-2031]'), { expectFormat: true });
  assert.equal(report.verdict, 'FAIL');
});

test('runVerification skips structure checks when the format is not expected', async () => {
  const report = await runVerification('A bare claim citing [OFAC].', { expectFormat: false });
  const ids = report.checks.map((c) => c.id);
  assert.ok(!ids.includes('structure'));
  assert.ok(ids.includes('citation-keys'));
});

test('runVerification reports unrun screening as skipped, not passed', async () => {
  const report = await runVerification('Acme Holdings cited [OFAC].', { expectFormat: false, screen: false });
  const screening = report.checks.find((c) => c.id === 'sanctions-screening');
  assert.equal(screening.status, 'skipped');
});
