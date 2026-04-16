import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { analyze } from '../src/index.js';

async function tempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'vibeclean-analyze-'));
}

async function write(root: string, rel: string, content: string): Promise<void> {
  const full = path.join(root, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content);
}

let dir: string;

beforeEach(async () => {
  dir = await tempDir();
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('analyze (end-to-end)', () => {
  it('returns a perfect-ish score for a tidy repo', async () => {
    await write(
      dir,
      'README.md',
      '# Tidy\n\nDoes nothing.\n\n## Install\n```\nnpm install tidy\n```\n\n## Usage\n```\ntidy\n```\n',
    );
    await write(dir, 'package.json', JSON.stringify({ name: 'tidy', scripts: { test: 'vitest' } }));
    await write(dir, '.github/workflows/ci.yml', 'name: CI');
    await write(dir, 'src/lib/core.ts', 'export const core = () => 1;\n');
    await write(dir, 'src/lib/core.test.ts', 'test("x", () => {});\n');

    const report = await analyze({
      target: dir,
      strict: false,
      funny: true,
      maxFileLines: 600,
    });

    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.band).toBe('Pristine');
    expect(report.summary.critical).toBe(0);
  });

  it('flags multiple issues in a messy repo', async () => {
    // missing README, missing CI, env usage without example, AWS key, big file, markers
    await write(dir, 'package.json', JSON.stringify({ name: 'mess' }));
    await write(dir, 'src/api/server.ts', 'const k = "AKIAABCDEFGHIJKLMNOP";\nconst key = process.env.FOO;\n');
    await write(dir, 'src/big.ts', 'const x = 1;\n'.repeat(700));
    await write(
      dir,
      'src/m.ts',
      '// TODO later\n// FIXME later\n// HACK later\n'.repeat(4),
    );

    const report = await analyze({
      target: dir,
      strict: false,
      funny: true,
      maxFileLines: 600,
    });

    const codes = report.issues.map((i) => i.code);
    expect(codes).toContain('missing-readme');
    expect(codes).toContain('missing-ci');
    expect(codes).toContain('missing-env-example');
    expect(codes).toContain('potential-secret');
    expect(codes).toContain('file-very-large');
    expect(codes).toContain('markers');
    expect(report.score).toBeLessThan(60);
  });

  it('strict mode lowers the score further', async () => {
    await write(dir, 'package.json', JSON.stringify({ name: 'x' }));
    await write(dir, 'src/a.ts', '// TODO\n'.repeat(5));
    await write(dir, 'README.md', '# X\n\nDoes things.\n\n## Install\n```\nnpm i x\n```\n\n## Usage\n```\nx\n```');
    await write(dir, '.github/workflows/ci.yml', 'name: CI');

    const loose = await analyze({ target: dir, strict: false, funny: true, maxFileLines: 600 });
    const strict = await analyze({ target: dir, strict: true, funny: true, maxFileLines: 600 });
    expect(strict.score).toBeLessThanOrEqual(loose.score);
  });

  it('includes verdict string', async () => {
    await write(dir, 'README.md', '# X\n\n## Install\n```\nnpm i\n```\n\n## Usage\n```\nx\n```');
    const report = await analyze({ target: dir, strict: false, funny: true, maxFileLines: 600 });
    expect(report.verdict.length).toBeGreaterThan(0);
  });
});
