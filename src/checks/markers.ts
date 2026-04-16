import path from 'node:path';
import type { Check, Issue } from '../types.js';
import { safeReadText } from '../utils/files.js';

const MARKER_RE = /\b(TODO|FIXME|HACK|TEMP|XXX)\b/;

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt|swift|c|cc|cpp|h|hpp|cs|php|scala|vue|svelte|astro|sh|bash|zsh|sql)$/i;

const MAX_PENALTY = 12; // total cap across all markers

export const markersCheck: Check = async (ctx) => {
  const issues: Issue[] = [];
  const perFile = new Map<string, number>();
  let total = 0;

  for (const f of ctx.sourceFiles) {
    if (!CODE_EXT.test(f)) continue;
    const content = await safeReadText(path.join(ctx.root, f));
    if (!content) continue;
    const lines = content.split(/\r?\n/);
    let count = 0;
    for (const line of lines) {
      if (MARKER_RE.test(line)) count++;
    }
    if (count > 0) {
      perFile.set(f, count);
      total += count;
    }
  }

  if (total === 0) return { issues };

  const sorted = [...perFile.entries()].sort((a, b) => b[1] - a[1]);
  const topOffenders = sorted.slice(0, 3).map(([file, n]) => `${file} (${n})`);

  const penalty = Math.min(total, MAX_PENALTY);
  issues.push({
    severity: 'warning',
    code: 'markers',
    message: `${total} TODO/FIXME/HACK/TEMP/XXX marker${total === 1 ? '' : 's'} found. Top: ${topOffenders.join(', ')}`,
    file: sorted[0]?.[0] ?? null,
    line: null,
    penalty,
  });

  return { issues };
};
