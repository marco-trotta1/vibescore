import { describe, it, expect } from 'vitest';
import { renderJson } from '../src/reporters/json.js';
import { renderHuman } from '../src/reporters/human.js';
import type { Report } from '../src/types.js';

function makeReport(partial?: Partial<Report>): Report {
  return {
    target: '/tmp/demo',
    score: 63,
    band: 'Neutral',
    strict: false,
    summary: { critical: 1, warnings: 2, info: 1 },
    issues: [
      {
        severity: 'critical',
        code: 'missing-env-example',
        message: 'Missing .env.example',
        file: '.env.example',
        line: null,
        penalty: 12,
      },
      {
        severity: 'warning',
        code: 'file-large',
        message: 'File exceeds 300 LOC (401 lines)',
        file: 'src/big.ts',
        line: 401,
        penalty: 2,
      },
      {
        severity: 'warning',
        code: 'markers',
        message: '5 markers found',
        file: 'src/a.ts',
        line: null,
        penalty: 5,
      },
      {
        severity: 'info',
        code: 'possibly-unused-dep',
        message: 'Possibly unused dependency: foo',
        file: 'package.json',
        line: null,
        penalty: 1,
      },
    ],
    verdict: 'Functional, but worth cleaning up before shipping.',
    ...partial,
  };
}

describe('renderJson', () => {
  it('produces the documented shape', () => {
    const out = renderJson(makeReport());
    const parsed = JSON.parse(out);
    expect(parsed).toMatchObject({
      target: '/tmp/demo',
      score: 63,
      band: 'Neutral',
      strict: false,
      summary: { critical: 1, warnings: 2, info: 1 },
      verdict: expect.any(String),
    });
    expect(Array.isArray(parsed.issues)).toBe(true);
    expect(parsed.issues[0]).toEqual({
      severity: 'critical',
      code: 'missing-env-example',
      message: 'Missing .env.example',
      file: '.env.example',
      line: null,
    });
    // Penalty (internal) should not leak into JSON output.
    expect(parsed.issues[0].penalty).toBeUndefined();
  });
});

describe('renderHuman', () => {
  it('includes score, band, and section headers', () => {
    const out = renderHuman(makeReport(), { funny: true });
    const stripped = out.replace(/\u001b\[[0-9;]*m/g, '');
    expect(stripped).toContain('Vibescore Report');
    expect(stripped).toContain('63/100');
    expect(stripped).toContain('Neutral');
    expect(stripped).toContain('CRITICAL');
    expect(stripped).toContain('WARNINGS');
    expect(stripped).toContain('INFO');
    expect(stripped).toContain('Functional, but worth cleaning up before shipping.');
  });

  it('omits verdict in no-funny mode but includes dry text', () => {
    const dryReport = makeReport({ verdict: 'Several issues worth addressing.' });
    const out = renderHuman(dryReport, { funny: false });
    const stripped = out.replace(/\u001b\[[0-9;]*m/g, '');
    expect(stripped).toContain('Verdict:');
    expect(stripped).toContain('Several issues worth addressing.');
  });

  it('handles clean reports', () => {
    const clean = makeReport({
      score: 100,
      band: 'Pristine',
      summary: { critical: 0, warnings: 0, info: 0 },
      issues: [],
    });
    const out = renderHuman(clean, { funny: true });
    const stripped = out.replace(/\u001b\[[0-9;]*m/g, '');
    expect(stripped).toContain('100/100');
    expect(stripped).toContain('No issues found');
  });
});
