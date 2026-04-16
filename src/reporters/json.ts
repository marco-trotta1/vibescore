import type { Report } from '../types.js';

/**
 * Shape matches the spec. We strip internal `penalty` and keep stable key order.
 */
export function renderJson(report: Report): string {
  const payload = {
    target: report.target,
    score: report.score,
    band: report.band,
    strict: report.strict,
    summary: report.summary,
    issues: report.issues.map((i) => ({
      severity: i.severity,
      code: i.code,
      message: i.message,
      file: i.file ?? null,
      line: i.line ?? null,
    })),
    verdict: report.verdict,
  };
  return JSON.stringify(payload, null, 2);
}
