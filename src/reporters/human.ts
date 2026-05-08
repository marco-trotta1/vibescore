import path from 'node:path';
import type { Issue, Report } from '../types.js';
import { roastIssue } from '../roasts.js';
import { chalk } from '../utils/chalk.js';

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
  roast: boolean,
): string {
  if (issues.length === 0) return '';
  const lines: string[] = [];
  lines.push('');
  lines.push(color(title));
  for (const issue of issues) {
    const message = roast ? roastIssue(issue) : issue.message;
    lines.push(`  ${color('-')} ${message}${formatLocation(issue)}`);
  }
  return lines.join('\n');
}

type Colorer = (s: string) => string;

const SCORE_DIGITS: Record<string, string[]> = {
  '0': ['████', '█  █', '█  █', '█  █', '████'],
  '1': ['  █ ', ' ██ ', '  █ ', '  █ ', '████'],
  '2': ['████', '   █', '████', '█   ', '████'],
  '3': ['████', '   █', ' ███', '   █', '████'],
  '4': ['█  █', '█  █', '████', '   █', '   █'],
  '5': ['████', '█   ', '████', '   █', '████'],
  '6': ['████', '█   ', '████', '█  █', '████'],
  '7': ['████', '   █', '  █ ', ' █  ', '█   '],
  '8': ['████', '█  █', '████', '█  █', '████'],
  '9': ['████', '█  █', '████', '   █', '████'],
};

const ANSI_PATTERN = /\u001B\[[0-9;]*m/g;

function visibleLength(s: string): number {
  return s.replace(ANSI_PATTERN, '').length;
}

function padVisibleEnd(s: string, width: number): string {
  return `${s}${' '.repeat(Math.max(0, width - visibleLength(s)))}`;
}

function center(s: string, width: number): string {
  const left = Math.floor((width - visibleLength(s)) / 2);
  return padVisibleEnd(`${' '.repeat(Math.max(0, left))}${s}`, width);
}

function flash(s: string): string {
  if (chalk.level === 0) return s;
  return `\u001B[5m${s}\u001B[25m`;
}

function scoreColor(score: number): Colorer {
  if (score >= 90) return chalk.greenBright.bold;
  if (score >= 60) return chalk.yellow.bold;
  if (score >= 40) return chalk.red.bold;
  return (s: string) => flash(chalk.redBright.bold(s));
}

function scoreArt(score: number): string[] {
  const digits = String(score).split('');
  const rows = SCORE_DIGITS['0'] ?? [];
  return rows.map((_, row) =>
    digits.map((digit) => SCORE_DIGITS[digit]?.[row] ?? '').join('  '),
  );
}

function box(lines: string[], color: Colorer, border: 'single' | 'double'): string {
  const chars = border === 'double'
    ? { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' }
    : { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' };
  const width = Math.max(...lines.map(visibleLength));
  const top = `${chars.tl}${chars.h.repeat(width + 2)}${chars.tr}`;
  const bottom = `${chars.bl}${chars.h.repeat(width + 2)}${chars.br}`;
  const body = lines.map((line) =>
    `${chars.v} ${padVisibleEnd(line, width)} ${chars.v}`,
  );
  return [top, ...body, bottom].map((line) => color(line)).join('\n');
}

function renderScoreBox(report: Report): string {
  const color = scoreColor(report.score);
  const art = scoreArt(report.score);
  const label = `SCORE ${report.score}/100`;
  const band = `BAND  ${report.band}`;
  const width = Math.max(...art.map(visibleLength), label.length, band.length);
  return box(
    [
      ...art.map((line) => center(line, width)),
      '',
      center(label, width),
      center(band, width),
    ],
    color,
    'single',
  );
}

function renderSeverityBars(critical: number, warnings: number, info: number): string {
  const counts = [
    { label: 'CRITICAL', count: critical, color: chalk.red.bold },
    { label: 'WARNINGS', count: warnings, color: chalk.yellow.bold },
    { label: 'INFO', count: info, color: chalk.cyan.bold },
  ];
  const denominator = Math.max(10, ...counts.map(({ count }) => count));
  const barWidth = 10;
  const lines = [chalk.bold('Severity Chart')];

  for (const { label, count, color } of counts) {
    const filled = denominator === 0 ? 0 : Math.round((count / denominator) * barWidth);
    const empty = barWidth - filled;
    const bar = `${color('█'.repeat(filled))}${chalk.dim('░'.repeat(empty))}`;
    lines.push(`${color(label.padEnd(8))} ${bar} ${count}/${denominator}`);
  }

  return lines.join('\n');
}

function renderVerdictBox(verdict: string, funny: boolean): string {
  const verdictLines = [
    'VERDICT',
    '',
    ...(funny ? [chalk.italic(verdict)] : [verdict]),
  ];
  return box(verdictLines, chalk.bold, 'double');
}

export interface HumanRenderOptions {
  funny: boolean;
  roast?: boolean;
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
  lines.push(chalk.bold(`💀 BadVibes Report for ${displayTarget}`));
  lines.push('');
  lines.push(renderScoreBox(report));
  if (report.strict) {
    lines.push(chalk.dim('Strict mode: on'));
  }

  const critical = report.issues.filter((i) => i.severity === 'critical');
  const warnings = report.issues.filter((i) => i.severity === 'warning');
  const info = report.issues.filter((i) => i.severity === 'info');

  lines.push('');
  lines.push(renderSeverityBars(critical.length, warnings.length, info.length));

  const roast = opts.funny && opts.roast === true;

  lines.push(section('CRITICAL', chalk.red.bold, critical, roast));
  lines.push(section('WARNINGS', chalk.yellow.bold, warnings, roast));
  lines.push(section('INFO', chalk.cyan.bold, info, roast));

  if (critical.length + warnings.length + info.length === 0) {
    lines.push('');
    lines.push(chalk.green('No issues found. Suspiciously clean.'));
  }

  if (report.verdict && opts.funny) {
    lines.push('');
    lines.push(renderVerdictBox(report.verdict, true));
  } else if (report.verdict && !opts.funny) {
    lines.push('');
    lines.push(renderVerdictBox(report.verdict, false));
  }

  lines.push('');
  return lines.filter((l) => l !== undefined).join('\n');
}
