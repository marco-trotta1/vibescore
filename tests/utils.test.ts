import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { countLines, isLikelyBinary, isSourceLike, buildRepoContext } from '../src/utils/files.js';
import { shannonEntropy } from '../src/utils/entropy.js';

describe('countLines', () => {
  it('handles empty and trailing newlines', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\n')).toBe(1);
    expect(countLines('a\nb')).toBe(2);
    expect(countLines('a\nb\n')).toBe(2);
    expect(countLines('a\nb\nc')).toBe(3);
  });
});

describe('isLikelyBinary / isSourceLike', () => {
  it('classifies known types', () => {
    expect(isLikelyBinary('a.png')).toBe(true);
    expect(isLikelyBinary('package-lock.json')).toBe(true);
    expect(isSourceLike('src/a.ts')).toBe(true);
    expect(isSourceLike('README.md')).toBe(true);
    expect(isSourceLike('.eslintrc')).toBe(true);
    expect(isSourceLike('image.png')).toBe(false);
  });
});

describe('shannonEntropy', () => {
  it('returns 0 for empty', () => {
    expect(shannonEntropy('')).toBe(0);
  });
  it('is higher for mixed strings', () => {
    const low = shannonEntropy('aaaaaaaaaaaa');
    const high = shannonEntropy('aB3$jklKLMqrP91xY');
    expect(high).toBeGreaterThan(low);
  });
});

describe('buildRepoContext', () => {
  it('reads files and package.json from a temp dir', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibeclean-ctx-'));
    try {
      await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'x' }));
      await fs.mkdir(path.join(dir, 'src'));
      await fs.writeFile(path.join(dir, 'src', 'a.ts'), 'export const a = 1;');
      const ctx = await buildRepoContext(dir);
      expect(ctx.packageJson?.name).toBe('x');
      expect(ctx.files).toContain('package.json');
      expect(ctx.files).toContain('src/a.ts');
      expect(ctx.sourceFiles).toContain('src/a.ts');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
