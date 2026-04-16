import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildRepoContext } from '../src/utils/files.js';
import { envExampleCheck } from '../src/checks/env-example.js';
import { markersCheck } from '../src/checks/markers.js';
import { largeFilesCheck } from '../src/checks/large-files.js';
import { secretsCheck } from '../src/checks/secrets.js';
import { testsCheck } from '../src/checks/tests.js';
import { ciCheck } from '../src/checks/ci.js';
import { readmeCheck } from '../src/checks/readme.js';
import { brokenImportsCheck } from '../src/checks/broken-imports.js';
import { duplicatesCheck } from '../src/checks/duplicates.js';
import { unusedDepsCheck } from '../src/checks/unused-deps.js';
import type { AnalyzeOptions } from '../src/types.js';

const DEFAULT_OPTS: AnalyzeOptions = {
  target: '.',
  strict: false,
  funny: true,
  maxFileLines: 600,
};

async function tempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'vibeclean-check-'));
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

describe('envExampleCheck', () => {
  it('flags when env usage exists but .env.example is missing', async () => {
    await write(dir, 'src/a.ts', 'const k = process.env.FOO;');
    const ctx = await buildRepoContext(dir);
    const res = await envExampleCheck(ctx, DEFAULT_OPTS);
    expect(res.issues).toHaveLength(1);
    expect(res.issues[0]!.code).toBe('missing-env-example');
    expect(res.issues[0]!.severity).toBe('critical');
  });

  it('is silent when .env.example is present', async () => {
    await write(dir, 'src/a.ts', 'const k = process.env.FOO;');
    await write(dir, '.env.example', 'FOO=');
    const ctx = await buildRepoContext(dir);
    const res = await envExampleCheck(ctx, DEFAULT_OPTS);
    expect(res.issues).toHaveLength(0);
  });

  it('is silent when no env usage is detected', async () => {
    await write(dir, 'src/a.ts', 'export const a = 1;');
    const ctx = await buildRepoContext(dir);
    const res = await envExampleCheck(ctx, DEFAULT_OPTS);
    expect(res.issues).toHaveLength(0);
  });
});

describe('markersCheck', () => {
  it('counts TODO/FIXME/HACK and caps penalty', async () => {
    const marker = '// TODO: later\n// FIXME: bug\n// HACK: lol\n';
    await write(dir, 'src/a.ts', marker.repeat(10));
    const ctx = await buildRepoContext(dir);
    const res = await markersCheck(ctx, DEFAULT_OPTS);
    expect(res.issues).toHaveLength(1);
    expect(res.issues[0]!.penalty).toBeLessThanOrEqual(12);
    expect(res.issues[0]!.message).toMatch(/marker/);
  });

  it('is silent when clean', async () => {
    await write(dir, 'src/a.ts', 'export const a = 1;');
    const ctx = await buildRepoContext(dir);
    const res = await markersCheck(ctx, DEFAULT_OPTS);
    expect(res.issues).toHaveLength(0);
  });
});

describe('largeFilesCheck', () => {
  it('flags files exceeding thresholds', async () => {
    const big = 'const x = 1;\n'.repeat(650);
    const medium = 'const y = 1;\n'.repeat(400);
    const small = 'const z = 1;\n'.repeat(50);
    await write(dir, 'src/big.ts', big);
    await write(dir, 'src/medium.ts', medium);
    await write(dir, 'src/small.ts', small);
    const ctx = await buildRepoContext(dir);
    const res = await largeFilesCheck(ctx, DEFAULT_OPTS);
    const codes = res.issues.map((i) => i.code).sort();
    expect(codes).toContain('file-very-large');
    expect(codes).toContain('file-large');
  });

  it('honors --max-file-lines override', async () => {
    const content = 'x\n'.repeat(120);
    await write(dir, 'src/a.ts', content);
    const ctx = await buildRepoContext(dir);
    const res = await largeFilesCheck(ctx, { ...DEFAULT_OPTS, maxFileLines: 100 });
    const severe = res.issues.find((i) => i.code === 'file-very-large');
    expect(severe).toBeDefined();
  });
});

describe('secretsCheck', () => {
  it('flags an AWS-style access key', async () => {
    await write(dir, 'src/config.ts', 'export const k = "AKIAABCDEFGHIJKLMNOP";');
    const ctx = await buildRepoContext(dir);
    const res = await secretsCheck(ctx, DEFAULT_OPTS);
    expect(res.issues.length).toBeGreaterThanOrEqual(1);
    expect(res.issues[0]!.code).toBe('potential-secret');
  });

  it('does not flag obvious placeholders', async () => {
    await write(dir, 'src/c.ts', 'const apiKey = "YOUR_API_KEY_HERE";');
    const ctx = await buildRepoContext(dir);
    const res = await secretsCheck(ctx, DEFAULT_OPTS);
    expect(res.issues).toHaveLength(0);
  });

  it('skips test and fixture directories', async () => {
    await write(dir, 'tests/fixture.ts', 'const k = "AKIAABCDEFGHIJKLMNOP";');
    const ctx = await buildRepoContext(dir);
    const res = await secretsCheck(ctx, DEFAULT_OPTS);
    expect(res.issues).toHaveLength(0);
  });
});

describe('testsCheck', () => {
  it('flags as critical when critical code but no tests', async () => {
    await write(dir, 'src/api/server.ts', 'export const s = 1;');
    const ctx = await buildRepoContext(dir);
    const res = await testsCheck(ctx, DEFAULT_OPTS);
    expect(res.issues[0]!.code).toBe('no-tests-critical');
  });

  it('is silent when tests exist', async () => {
    await write(dir, 'src/api/server.ts', 'export const s = 1;');
    await write(dir, 'src/api/server.test.ts', 'test("x", () => {})');
    const ctx = await buildRepoContext(dir);
    const res = await testsCheck(ctx, DEFAULT_OPTS);
    expect(res.issues).toHaveLength(0);
  });
});

describe('ciCheck', () => {
  it('warns when no CI config', async () => {
    await write(dir, 'src/a.ts', '');
    const ctx = await buildRepoContext(dir);
    const res = await ciCheck(ctx, DEFAULT_OPTS);
    expect(res.issues[0]!.code).toBe('missing-ci');
  });

  it('is silent with GitHub Actions config', async () => {
    await write(dir, '.github/workflows/ci.yml', 'name: CI');
    const ctx = await buildRepoContext(dir);
    const res = await ciCheck(ctx, DEFAULT_OPTS);
    expect(res.issues).toHaveLength(0);
  });
});

describe('readmeCheck', () => {
  it('flags missing README', async () => {
    await write(dir, 'src/a.ts', '');
    const ctx = await buildRepoContext(dir);
    const res = await readmeCheck(ctx, DEFAULT_OPTS);
    expect(res.issues[0]!.code).toBe('missing-readme');
  });

  it('flags thin README', async () => {
    await write(dir, 'README.md', 'hi');
    const ctx = await buildRepoContext(dir);
    const res = await readmeCheck(ctx, DEFAULT_OPTS);
    expect(res.issues[0]!.code).toBe('thin-readme');
  });

  it('passes a rich README', async () => {
    await write(
      dir,
      'README.md',
      '# My Tool\n\nDoes the thing.\n\n## Install\n```\nnpm install foo\n```\n\n## Usage\n```\nfoo .\n```\n',
    );
    const ctx = await buildRepoContext(dir);
    const res = await readmeCheck(ctx, DEFAULT_OPTS);
    expect(res.issues).toHaveLength(0);
  });
});

describe('brokenImportsCheck', () => {
  it('flags unresolved relative imports', async () => {
    await write(dir, 'src/a.ts', 'import { x } from "./missing";');
    const ctx = await buildRepoContext(dir);
    const res = await brokenImportsCheck(ctx, DEFAULT_OPTS);
    expect(res.issues[0]!.code).toBe('broken-import');
  });

  it('resolves .js specifiers to .ts files', async () => {
    await write(dir, 'src/a.ts', 'import { b } from "./b.js";');
    await write(dir, 'src/b.ts', 'export const b = 1;');
    const ctx = await buildRepoContext(dir);
    const res = await brokenImportsCheck(ctx, DEFAULT_OPTS);
    expect(res.issues).toHaveLength(0);
  });
});

describe('duplicatesCheck', () => {
  it('detects the same block copied across files', async () => {
    const block = Array.from({ length: 10 }, (_, i) => `const x${i} = computeSomething(${i});`).join('\n');
    await write(dir, 'src/a.ts', block);
    await write(dir, 'src/b.ts', block);
    const ctx = await buildRepoContext(dir);
    const res = await duplicatesCheck(ctx, DEFAULT_OPTS);
    expect(res.issues.length).toBeGreaterThan(0);
    expect(res.issues[0]!.code).toBe('duplicate-block');
  });
});

describe('unusedDepsCheck', () => {
  it('reports deps not used in source', async () => {
    await write(
      dir,
      'package.json',
      JSON.stringify({
        name: 'x',
        dependencies: { lodash: '1.0.0', chalk: '5.0.0' },
      }),
    );
    await write(dir, 'src/a.ts', "import chalk from 'chalk';\nconsole.log(chalk.red('hi'));");
    const ctx = await buildRepoContext(dir);
    const res = await unusedDepsCheck(ctx, DEFAULT_OPTS);
    const codes = res.issues.map((i) => i.message);
    expect(codes.some((m) => m.includes('lodash'))).toBe(true);
    expect(codes.some((m) => m.includes('chalk'))).toBe(false);
  });

  it('ignores implicit dev tooling like typescript', async () => {
    await write(
      dir,
      'package.json',
      JSON.stringify({
        name: 'x',
        devDependencies: { typescript: '5.0.0' },
      }),
    );
    await write(dir, 'src/a.ts', 'export const a = 1;');
    const ctx = await buildRepoContext(dir);
    const res = await unusedDepsCheck(ctx, DEFAULT_OPTS);
    expect(res.issues.some((i) => i.message.includes('typescript'))).toBe(false);
  });
});
