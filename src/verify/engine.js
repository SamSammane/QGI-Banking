// Verification engine: runs the symbolic checkers over model-produced text and
// reduces their results to a single verdict.
//
// The offline checkers always run. Screening is optional because it needs a
// live Watchman instance, and an unreachable service must degrade to 'skipped'
// rather than turn into a silent pass — an unrun check is not a clean check.

import {
  checkCitationKeys,
  checkStructure,
  checkSourcesConsistency,
  checkNumericClaims,
  checkProhibitedOutput,
  extractEntityCandidates,
} from './checkers.js';
import { screenEntity } from '../adapters/watchman.js';

const RANK = { pass: 0, skipped: 0, warn: 1, fail: 2 };

export function verdictOf(checks) {
  let worst = 'pass';
  for (const c of checks) {
    if (RANK[c.status] > RANK[worst]) worst = c.status;
  }
  return worst === 'fail' ? 'FAIL' : worst === 'warn' ? 'WARN' : 'PASS';
}

/**
 * @param {string} text                  Model output to verify.
 * @param {object} opts
 * @param {boolean} opts.expectFormat    Enforce the mandated section structure.
 * @param {boolean} opts.screen          Screen extracted entity names via Watchman.
 * @param {number}  opts.maxEntities     Cap on names sent to the screening service.
 * @param {string}  opts.source          Label for where the text came from.
 */
export async function runVerification(text, { expectFormat = false, screen = false, maxEntities = 10, source = 'input' } = {}) {
  const body = String(text || '');
  const checks = [];

  checks.push(checkCitationKeys(body));

  if (expectFormat) {
    checks.push(checkStructure(body));
    checks.push(checkSourcesConsistency(body));
  }

  checks.push(checkNumericClaims(body));
  checks.push(checkProhibitedOutput(body));
  checks.push(await screeningCheck(body, { screen, maxEntities }));

  const summary = { pass: 0, warn: 0, fail: 0, skipped: 0 };
  for (const c of checks) summary[c.status] += 1;

  return {
    source,
    characters: body.length,
    checks,
    summary,
    verdict: verdictOf(checks),
  };
}

async function screeningCheck(body, { screen, maxEntities }) {
  const base = { id: 'sanctions-screening', title: 'Named entities screened against sanctions lists', evidence: [] };

  if (!screen) {
    return { ...base, status: 'skipped', detail: 'Screening not requested. Pass --screen to enable.' };
  }

  const candidates = extractEntityCandidates(body).slice(0, maxEntities);
  if (candidates.length === 0) {
    return { ...base, status: 'pass', detail: 'No entity-like names were found to screen.' };
  }

  const hits = [];
  const errors = [];
  for (const name of candidates) {
    try {
      const res = await screenEntity(name, { limit: 3 });
      if (res.matchCount > 0) {
        const top = res.matches[0];
        hits.push(`${name} → ${res.matchCount} match(es); top: ${top.name} (${top.source ?? 'unknown list'}, score ${top.match})`);
      }
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
      break; // one unreachable service means the rest will fail identically
    }
  }

  if (errors.length > 0) {
    return {
      ...base,
      status: 'skipped',
      detail: 'Screening could not run; the result is unknown, not clean.',
      evidence: errors,
    };
  }

  if (hits.length > 0) {
    return {
      ...base,
      status: 'warn',
      detail: `${hits.length} of ${candidates.length} candidate name(s) matched a sanctions or PEP list. Heuristic name extraction — confirm each match by hand.`,
      evidence: hits,
    };
  }

  return { ...base, status: 'pass', detail: `Screened ${candidates.length} candidate name(s); no matches above threshold.` };
}
