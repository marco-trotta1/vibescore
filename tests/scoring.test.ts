import { describe, it, expect } from 'vitest';
import {
  BANDS,
  bandFor,
  clampScore,
  computeScore,
  summarize,
  verdictFor,
} from '../src/scoring.js';
import type { Issue } from '../src/types.js';

function issue(severity: Issue['severity'], penalty: number): Issue {
  return { severity, code: 'x', message: 'x', penalty };
}

describe('scoring', () => {
  it('clamps to [0, 100]', () => {
    expect(clampScore(150)).toBe(100);
    expect(clampScore(-20)).toBe(0);
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(42.4)).toBe(42);
  });

  it('computes score by subtracting penalties from 100', () => {
    const issues = [issue('warning', 5), issue('info', 1), issue('critical', 12)];
    expect(computeScore(issues, false)).toBe(100 - 5 - 1 - 12);
  });

  it('applies strict multiplier to penalties', () => {
    const issues = [issue('warning', 4), issue('warning', 4)];
    // 4 * 1.5 = 6 per issue (ceiled)
    expect(computeScore(issues, true)).toBe(100 - 6 - 6);
  });

  it('never goes below 0', () => {
    const issues = Array.from({ length: 20 }, () => issue('critical', 20));
    expect(computeScore(issues, false)).toBe(0);
  });

  it('assigns bands for representative scores', () => {
    expect(bandFor(100).name).toBe('Pristine');
    expect(bandFor(90).name).toBe('Pristine');
    expect(bandFor(89).name).toBe('Clean');
    expect(bandFor(75).name).toBe('Clean');
    expect(bandFor(74).name).toBe('Chaotic Neutral');
    expect(bandFor(60).name).toBe('Chaotic Neutral');
    expect(bandFor(59).name).toBe('Cursed');
    expect(bandFor(40).name).toBe('Cursed');
    expect(bandFor(39).name).toBe('Biohazard');
    expect(bandFor(0).name).toBe('Biohazard');
  });

  it('bands cover 0..100 continuously', () => {
    for (let s = 0; s <= 100; s++) {
      const b = bandFor(s);
      expect(b).toBeDefined();
      expect(s).toBeGreaterThanOrEqual(b.min);
      expect(s).toBeLessThanOrEqual(b.max);
    }
  });

  it('has 5 bands', () => {
    expect(BANDS).toHaveLength(5);
  });

  it('summarize groups by severity', () => {
    const issues: Issue[] = [
      issue('critical', 10),
      issue('warning', 3),
      issue('warning', 2),
      issue('info', 1),
    ];
    expect(summarize(issues)).toEqual({ critical: 1, warnings: 2, info: 1 });
  });

  it('verdictFor returns different strings for funny vs dry', () => {
    const funny = verdictFor(65, true);
    const dry = verdictFor(65, false);
    expect(funny).not.toEqual('');
    expect(dry).not.toEqual('');
    expect(funny).not.toEqual(dry);
  });
});
