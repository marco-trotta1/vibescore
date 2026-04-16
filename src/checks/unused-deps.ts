import path from 'node:path';
import type { Check, Issue } from '../types.js';
import { safeReadText } from '../utils/files.js';

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro)$/i;

/**
 * Some packages are commonly used without a direct import in source, so skip them.
 */
const IMPLICIT_DEPS = new Set([
  'typescript',
  'tslib',
  'eslint',
  'prettier',
  'husky',
  'lint-staged',
  'vitest',
  'jest',
  'mocha',
  'chai',
  'nodemon',
  'ts-node',
  'tsx',
  'tsup',
  'esbuild',
  'rollup',
  'webpack',
  'vite',
  'next',
  'nuxt',
  '@types/node',
  'postcss',
  'tailwindcss',
  'autoprefixer',
  'sass',
  'less',
  'concurrently',
  'rimraf',
  'cross-env',
  'dotenv',
  'dotenv-cli',
]);

export const unusedDepsCheck: Check = async (ctx) => {
  const issues: Issue[] = [];
  const pkg = ctx.packageJson;
  if (!pkg) return { issues };

  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const depNames = Object.keys(deps);
  if (depNames.length === 0) return { issues };

  // Build a blob of code files only (package.json would match dep names against
  // themselves). Bounded per file.
  const blobs: string[] = [];
  for (const f of ctx.sourceFiles) {
    if (!CODE_EXT.test(f)) continue;
    const content = await safeReadText(path.join(ctx.root, f));
    if (!content) continue;
    blobs.push(content);
  }
  const corpus = blobs.join('\n');

  // Also scan package.json scripts for CLI usage of deps.
  const scriptsBlob = Object.values(pkg.scripts ?? {}).join(' ');

  const unused: string[] = [];
  for (const dep of depNames) {
    if (IMPLICIT_DEPS.has(dep)) continue;
    if (dep.startsWith('@types/')) continue;
    if (isMentioned(dep, corpus) || isScriptMentioned(dep, scriptsBlob)) continue;
    unused.push(dep);
  }

  if (unused.length > 0) {
    // Info level — we don't want to overclaim.
    for (const dep of unused.slice(0, 20)) {
      issues.push({
        severity: 'info',
        code: 'possibly-unused-dep',
        message: `Possibly unused dependency: ${dep}`,
        file: 'package.json',
        line: null,
        penalty: 1,
      });
    }
  }

  return { issues };
};

function isMentioned(dep: string, corpus: string): boolean {
  // Escape regex specials.
  const esc = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match import/require forms and plain string mentions for subpaths.
  const re = new RegExp(
    `(from\\s+['"\`]${esc}(?:/[^'"\`]*)?['"\`])|(require\\(\\s*['"\`]${esc}(?:/[^'"\`]*)?['"\`])|(['"\`]${esc}(?:/[^'"\`]*)?['"\`])`,
  );
  return re.test(corpus);
}

function isScriptMentioned(dep: string, scripts: string): boolean {
  const bin = dep.split('/').pop() ?? dep;
  const escBin = bin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escFull = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b(${escBin}|${escFull})\\b`);
  return re.test(scripts);
}
