import path from 'node:path';
import type { Check, Issue } from '../types.js';
import { safeReadText } from '../utils/files.js';

const PHRASES: RegExp[] = [
  /\bsample data\b/i,
  /\bmock for now\b/i,
  /\btemporary\b/i,
  /\bfake data\b/i,
  /\bplaceholder\b/i,
  /\bstub\b/i,
  /\bdummy data\b/i,
  /\bfixme later\b/i,
];

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt|swift|c|cc|cpp|h|hpp|cs|php|scala|vue|svelte|astro)$/i;
const DOC_PATH_RE = /(^|\/)(readme|readme\.md|docs?\/|examples?\/|__tests__\/|tests?\/|fixtures?\/)/i;

const MAX_ISSUES = 15;

export const placeholdersCheck: Check = async (ctx) => {
  const issues: Issue[] = [];

  for (const f of ctx.sourceFiles) {
    if (issues.length >= MAX_ISSUES) break;
    if (!CODE_EXT.test(f)) continue;
    if (DOC_PATH_RE.test(f)) continue;
    const content = await safeReadText(path.join(ctx.root, f));
    if (!content) continue;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (issues.length >= MAX_ISSUES) break;
      const line = lines[i]!;
      if (!PHRASES.some((re) => re.test(line))) continue;
      issues.push({
        severity: 'warning',
        code: 'placeholder-stub',
        message: `Placeholder/stub language detected: "${line.trim().slice(0, 80)}"`,
        file: f,
        line: i + 1,
        penalty: 2,
      });
    }
  }

  return { issues };
};
