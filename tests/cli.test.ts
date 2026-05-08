import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const CLI_ENTRY = path.join(REPO_ROOT, 'src', 'cli.ts');

let dir: string;

beforeAll(() => {
  // Ensure tsx is available via npx; just resolve path existence.
});

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'badvibes-cli-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(dir, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content);
}

function runCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['-y', 'tsx', CLI_ENTRY, ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, NO_COLOR: '1' },
      shell: process.platform === 'win32',
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

describe('cli smoke', () => {
  it('--json on a tidy fixture prints a valid report', async () => {
    await write(
      'README.md',
      '# Tidy\n\n## Install\n```\nnpm i tidy\n```\n\n## Usage\n```\ntidy .\n```\n',
    );
    await write('package.json', JSON.stringify({ name: 'tidy' }));
    await write('.github/workflows/ci.yml', 'name: CI');
    await write('src/lib/core.ts', 'export const core = () => 1;\n');
    await write('src/lib/core.test.ts', 'test("x", () => {});\n');

    const { code, stdout } = await runCli(['--json', dir]);
    expect(code).toBe(0);
    expect(stdout).not.toContain('/\\');
    expect(stdout).not.toContain('|  _ \\');
    const payload = JSON.parse(stdout);
    expect(payload).toHaveProperty('score');
    expect(payload).toHaveProperty('band');
    expect(payload).toHaveProperty('summary');
    expect(Array.isArray(payload.issues)).toBe(true);
  }, 30_000);

  it('--strict exits non-zero when score is low', async () => {
    await write('src/api/server.ts', 'const k = "AKIAABCDEFGHIJKLMNOP";\nconst x = process.env.FOO;');
    const { code } = await runCli(['--strict', '--json', dir]);
    expect(code).toBe(1);
  }, 30_000);

  it('prints the sword and BADVIBES banner before the human report', async () => {
    await write('README.md', '# Rough\n');
    await write('package.json', JSON.stringify({ name: 'rough' }));

    const { code, stdout } = await runCli([dir]);
    expect(code).toBe(0);

    const swordStart = stdout.indexOf('/\\');
    const wordmarkStart = stdout.indexOf('|  _ \\');
    const reportStart = stdout.indexOf('BadVibes Report');

    expect(swordStart).toBeGreaterThanOrEqual(0);
    expect(wordmarkStart).toBeGreaterThan(swordStart);
    expect(reportStart).toBeGreaterThan(wordmarkStart);
  }, 30_000);

  it('--help prints usage', async () => {
    const { code, stdout } = await runCli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toMatch(/badvibes/i);
    expect(stdout).toMatch(/--json/);
    expect(stdout).toMatch(/--strict/);
    expect(stdout).toMatch(/--roast/);
    expect(stdout).toMatch(/--max-file-lines/);
  }, 30_000);

  it('--no-funny suppresses --roast', async () => {
    await write('src/index.ts', 'const x = process.env.FOO;\n');

    const { code, stdout } = await runCli(['--roast', '--no-funny', dir]);
    expect(code).toBe(0);
    expect(stdout).toContain('Missing .env.example');
    expect(stdout).not.toContain('credential charades');
  }, 30_000);
});
