import { describe, it, expect } from 'vitest';
import { renderJson } from '../src/reporters/json.js';
import { renderHuman } from '../src/reporters/human.js';
import { ROASTS, type RoastableIssueCode } from '../src/roasts.js';
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

  it('can render roasted issue messages', () => {
    const out = renderJson(makeReport(), { roast: true });
    const parsed = JSON.parse(out);
    expect(parsed.issues[0].message).toContain('credential charades');
    expect(parsed.issues[1].message).toContain('junk drawer');
    expect(parsed.issues[2].message).toContain('monuments to your broken promises');
    expect(parsed.issues[3].message).toContain('gym membership');
  });
});

describe('renderHuman', () => {
  it('includes score, band, and section headers', () => {
    const out = renderHuman(makeReport(), { funny: true });
    const stripped = out.replace(/\u001b\[[0-9;]*m/g, '');
    expect(stripped).toContain('BadVibes Report');
    expect(stripped).toContain('63/100');
    expect(stripped).toContain('Neutral');
    expect(stripped).toContain('Severity Chart');
    expect(stripped).toContain('████');
    expect(stripped).toContain('░░');
    expect(stripped).toContain('CRITICAL');
    expect(stripped).toContain('WARNINGS');
    expect(stripped).toContain('INFO');
    expect(stripped).toContain('╔');
    expect(stripped).toContain('VERDICT');
    expect(stripped).toContain('Functional, but worth cleaning up before shipping.');
  });

  it('omits verdict in no-funny mode but includes dry text', () => {
    const dryReport = makeReport({ verdict: 'Several issues worth addressing.' });
    const out = renderHuman(dryReport, { funny: false });
    const stripped = out.replace(/\u001b\[[0-9;]*m/g, '');
    expect(stripped).toContain('VERDICT');
    expect(stripped).toContain('Several issues worth addressing.');
  });

  it('uses roast messages when roast mode is enabled', () => {
    const out = renderHuman(makeReport(), { funny: true, roast: true });
    const stripped = out.replace(/\u001b\[[0-9;]*m/g, '');
    expect(stripped).toContain('credential charades');
    expect(stripped).toContain('junk drawer');
    expect(stripped).toContain('monuments to your broken promises');
    expect(stripped).toContain('gym membership');
    expect(stripped).not.toContain('Missing .env.example');
  });

  it('keeps neutral issue messages when no-funny suppresses roast mode', () => {
    const out = renderHuman(makeReport(), { funny: false, roast: true });
    const stripped = out.replace(/\u001b\[[0-9;]*m/g, '');
    expect(stripped).toContain('Missing .env.example');
    expect(stripped).not.toContain('credential charades');
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

describe('roast coverage', () => {
  it('has a roast for every current issue code', () => {
    const existingCodes: RoastableIssueCode[] = [
      'broken-import',
      'duplicate-block',
      'file-large',
      'file-very-large',
      'inconsistent-naming',
      'markers',
      'missing-ci',
      'missing-env-example',
      'missing-readme',
      'no-tests',
      'no-tests-critical',
      'placeholder-stub',
      'possibly-unused-dep',
      'potential-secret',
      'thin-readme',
    ];

    expect(Object.keys(ROASTS).sort()).toEqual([...existingCodes].sort());
  });
});
