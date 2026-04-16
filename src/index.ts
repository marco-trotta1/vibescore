import type { AnalyzeOptions, Issue, Report } from './types.js';
import { buildRepoContext } from './utils/files.js';
import { bandFor, computeScore, summarize, verdictFor } from './scoring.js';

import { envExampleCheck } from './checks/env-example.js';
import { secretsCheck } from './checks/secrets.js';
import { testsCheck } from './checks/tests.js';
import { largeFilesCheck } from './checks/large-files.js';
import { markersCheck } from './checks/markers.js';
import { placeholdersCheck } from './checks/placeholders.js';
import { duplicatesCheck } from './checks/duplicates.js';
import { unusedDepsCheck } from './checks/unused-deps.js';
import { namingCheck } from './checks/naming.js';
import { ciCheck } from './checks/ci.js';
import { readmeCheck } from './checks/readme.js';
import { brokenImportsCheck } from './checks/broken-imports.js';

export type { Report, Issue, AnalyzeOptions } from './types.js';
export { bandFor, computeScore } from './scoring.js';

const CHECKS = [
  envExampleCheck,
  secretsCheck,
  testsCheck,
  largeFilesCheck,
  markersCheck,
  placeholdersCheck,
  duplicatesCheck,
  unusedDepsCheck,
  namingCheck,
  ciCheck,
  readmeCheck,
  brokenImportsCheck,
];

const SEVERITY_RANK: Record<Issue['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export async function analyze(opts: AnalyzeOptions): Promise<Report> {
  const ctx = await buildRepoContext(opts.target);
  const results = await Promise.all(CHECKS.map((c) => Promise.resolve(c(ctx, opts))));
  const issues = results
    .flatMap((r) => r.issues)
    .sort((a, b) => {
      const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (rank !== 0) return rank;
      return (a.file ?? '').localeCompare(b.file ?? '');
    });

  const score = computeScore(issues, opts.strict);
  const band = bandFor(score);
  const verdict = verdictFor(score, opts.funny);
  const summary = summarize(issues);

  return {
    target: ctx.root,
    score,
    band: band.name,
    strict: opts.strict,
    summary,
    issues,
    verdict,
  };
}
