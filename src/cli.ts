import { pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';
import { Command } from 'commander';
import { analyze } from './index.js';
import { renderHuman } from './reporters/human.js';
import { renderJson } from './reporters/json.js';

const VERSION = '0.1.0';

export interface CliFlags {
  json: boolean;
  strict: boolean;
  funny: boolean;
  maxFileLines: number;
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('vibescore')
    .description('Lint for AI slop. Audits a repo and prints a Vibe Score from 0 to 100.')
    .version(VERSION, '-v, --version', 'Print version')
    .argument('[path]', 'Path to repo to audit', '.')
    .option('--json', 'Print structured JSON report instead of human output', false)
    .option('--strict', 'Apply harsher scoring', false)
    .option('--no-funny', 'Remove verdict line / dry output')
    .option(
      '--max-file-lines <number>',
      'Severe-size threshold for files (lines). Warn threshold is half this.',
      (val) => Number.parseInt(val, 10),
      600,
    )
    .action(async (pathArg: string, opts: Record<string, unknown>) => {
      const json = Boolean(opts.json);
      const strict = Boolean(opts.strict);
      const funny = opts.funny !== false;
      const maxFileLines = typeof opts.maxFileLines === 'number' && Number.isFinite(opts.maxFileLines)
        ? Math.max(50, opts.maxFileLines)
        : 600;

      const report = await analyze({
        target: pathArg || '.',
        strict,
        funny,
        maxFileLines,
      });

      if (json) {
        process.stdout.write(renderJson(report) + '\n');
      } else {
        process.stdout.write(renderHuman(report, { funny, cwd: process.cwd() }) + '\n');
      }

      if (strict) {
        const hasCritical = report.issues.some((i) => i.severity === 'critical');
        if (hasCritical || report.score < 70) {
          process.exitCode = 1;
          return;
        }
      }
      process.exitCode = 0;
    });
  return program;
}

export async function runCli(argv: string[]): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv, { from: 'user' });
}

function isDirectInvocation(): boolean {
  try {
    const entry = process.argv[1];
    if (!entry) return false;
    const entryUrl = pathToFileURL(realpathSync(entry)).href;
    return entryUrl === import.meta.url;
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  runCli(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`vibescore: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  });
}
