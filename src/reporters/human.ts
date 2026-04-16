import path from 'node:path';
import chalk from 'chalk';
import type { Issue, Report } from '../types.js';

function formatLocation(issue: Issue): string {
  if (!issue.file) return '';
  if (issue.line != null && issue.line > 0) {
    return chalk.dim(`  (${issue.file}:${issue.line})`);
  }
  return chalk.dim(`  (${issue.file})`);
}

function section(
  title: string,
  color: (s: string) => string,
  issues: Issue[],
): string {
  if (issues.length === 0) return '';
  const lines: string[] = [];
  lines.push('');
  lines.push(color(title));
  for (const issue of issues) {
    lines.push(`  ${color('-')} ${issue.message}${formatLocation(issue)}`);
  }
  return lines.join('\n');
}

type Colorer = typeof chalk.green;

function bandColor(band: string): Colorer {
  switch (band) {
    case 'Pristine':
      return chalk.greenBright;
    case 'Clean':
      return chalk.green;
    case 'Chaotic Neutral':
      return chalk.yellow;
    case 'Cursed':
      return chalk.redBright;
    case 'Biohazard':
      return chalk.red;
    default:
      return chalk.white;
  }
}

export interface HumanRenderOptions {
  funny: boolean;
  cwd?: string;
}

export function renderHuman(report: Report, opts: HumanRenderOptions): string {
  const lines: string[] = [];
  const relTarget = opts.cwd
    ? path.relative(opts.cwd, report.target) || '.'
    : report.target;
  const displayTarget = relTarget.startsWith('.') || path.isAbsolute(relTarget)
    ? relTarget
    : `./${relTarget}`;

  lines.push('');
  lines.push(chalk.bold(`🧼 Vibeclean Report for ${displayTarget}`));
  lines.push('');
  const color = bandColor(report.band);
  lines.push(
    `Vibe Score: ${color.bold(`${report.score}/100`)} ${chalk.dim(`(${report.band})`)}`,
  );
  if (report.strict) {
    lines.push(chalk.dim('Strict mode: on'));
  }

  const critical = report.issues.filter((i) => i.severity === 'critical');
  const warnings = report.issues.filter((i) => i.severity === 'warning');
  const info = report.issues.filter((i) => i.severity === 'info');

  lines.push(section('CRITICAL', chalk.red.bold, critical));
  lines.push(section('WARNINGS', chalk.yellow.bold, warnings));
  lines.push(section('INFO', chalk.cyan.bold, info));

  if (critical.length + warnings.length + info.length === 0) {
    lines.push('');
    lines.push(chalk.green('No issues found. Suspiciously clean.'));
  }

  if (report.verdict && opts.funny) {
    lines.push('');
    lines.push(chalk.bold('Verdict:'));
    lines.push(chalk.italic(report.verdict));
  } else if (report.verdict && !opts.funny) {
    lines.push('');
    lines.push(chalk.bold('Verdict:'));
    lines.push(report.verdict);
  }

  lines.push('');
  return lines.filter((l) => l !== undefined).join('\n');
}
