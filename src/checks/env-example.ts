import path from 'node:path';
import type { Check } from '../types.js';
import { safeReadText } from '../utils/files.js';

const ENV_REFERENCE_RE = /\b(process\.env|import\.meta\.env)\b/;
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt|vue|svelte|astro|sh|bash|zsh)$/i;

export const envExampleCheck: Check = async (ctx) => {
  // Look for .env.example or .env.sample in the top-level listing.
  const hasExample = ctx.topLevel.some((f) =>
    /^\.env\.(example|sample|template)$/i.test(f),
  );

  // Detect env usage in real code files only (skip tests, docs, configs).
  let envUsageFound = false;
  let exampleFile: string | null = null;
  for (const f of ctx.sourceFiles) {
    if (!CODE_EXT.test(f)) continue;
    if (/\.env\.[^/]*$/i.test(f)) continue;
    if (/(^|\/)(__tests__|tests?|fixtures?|examples?)\//i.test(f)) continue;
    if (/\.(test|spec)\.[^/]+$/i.test(f)) continue;
    const content = await safeReadText(path.join(ctx.root, f));
    if (!content) continue;
    if (ENV_REFERENCE_RE.test(content)) {
      envUsageFound = true;
      exampleFile = f;
      break;
    }
  }

  if (envUsageFound && !hasExample) {
    return {
      issues: [
        {
          severity: 'critical',
          code: 'missing-env-example',
          message: `Missing .env.example despite env usage (e.g. ${exampleFile ?? 'source files'})`,
          file: '.env.example',
          line: null,
          penalty: 12,
        },
      ],
    };
  }
  return { issues: [] };
};
