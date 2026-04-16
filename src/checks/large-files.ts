import path from 'node:path';
import type { Check, Issue } from '../types.js';
import { countLines, safeReadText } from '../utils/files.js';

const SOURCE_CODE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt|swift|c|cc|cpp|h|hpp|cs|php|scala|vue|svelte|astro)$/i;

export const largeFilesCheck: Check = async (ctx, opts) => {
  const issues: Issue[] = [];
  const warnThreshold = Math.max(50, Math.floor(opts.maxFileLines / 2));
  const severeThreshold = opts.maxFileLines;

  // Track how many large files we've found so we can bound penalties.
  let severeCount = 0;
  let warnCount = 0;

  for (const f of ctx.sourceFiles) {
    if (!SOURCE_CODE_RE.test(f)) continue;
    const content = await safeReadText(path.join(ctx.root, f));
    if (!content) continue;
    const lines = countLines(content);
    if (lines >= severeThreshold) {
      severeCount++;
      issues.push({
        severity: 'warning',
        code: 'file-very-large',
        message: `File exceeds ${severeThreshold} LOC (${lines} lines)`,
        file: f,
        line: lines,
        penalty: severeCount <= 6 ? 5 : 0,
      });
    } else if (lines >= warnThreshold) {
      warnCount++;
      issues.push({
        severity: 'warning',
        code: 'file-large',
        message: `File exceeds ${warnThreshold} LOC (${lines} lines)`,
        file: f,
        line: lines,
        penalty: warnCount <= 10 ? 2 : 0,
      });
    }
  }

  return { issues };
};
