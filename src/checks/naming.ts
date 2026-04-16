import path from 'node:path';
import type { Check, Issue } from '../types.js';

type Convention = 'kebab' | 'pascal' | 'snake' | 'camel' | 'other';

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|vue|svelte|astro)$/i;

function classify(name: string): Convention {
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(name)) return 'kebab';
  if (/^[A-Z][A-Za-z0-9]*$/.test(name) && /[A-Z]/.test(name.slice(1))) return 'pascal';
  if (/^[A-Z][a-z0-9]*$/.test(name)) return 'pascal';
  if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(name)) return 'snake';
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return 'camel';
  return 'other';
}

/**
 * Group files by their immediate parent directory and flag mixed conventions.
 */
export const namingCheck: Check = (ctx) => {
  const issues: Issue[] = [];
  const byDir = new Map<string, Map<Convention, string[]>>();

  for (const f of ctx.sourceFiles) {
    if (!f.startsWith('src/')) continue;
    if (!CODE_EXT.test(f)) continue;
    const base = path.basename(f, path.extname(f));
    if (/^index$/i.test(base)) continue;
    const conv = classify(base);
    if (conv === 'other') continue;
    const dir = path.dirname(f);
    const dirMap = byDir.get(dir) ?? new Map<Convention, string[]>();
    const list = dirMap.get(conv) ?? [];
    list.push(f);
    dirMap.set(conv, list);
    byDir.set(dir, dirMap);
  }

  for (const [dir, conventions] of byDir) {
    if (conventions.size < 2) continue;
    const counts = [...conventions.entries()].map(([c, list]) => `${c}(${list.length})`);
    issues.push({
      severity: 'info',
      code: 'inconsistent-naming',
      message: `Mixed filename conventions in ${dir}/: ${counts.join(', ')}`,
      file: dir,
      line: null,
      penalty: 1,
    });
  }

  return { issues };
};
