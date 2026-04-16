import path from 'node:path';
import fs from 'node:fs/promises';
import type { Check, Issue } from '../types.js';
import { safeReadText } from '../utils/files.js';

const JS_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const INDEX_NAMES = JS_EXT.map((e) => `index${e}`);
const JS_FILE_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;

const IMPORT_RE =
  /(?:^|\s)(?:import\s+(?:[\s\S]+?\s+from\s+)?|export\s+[\s\S]+?\s+from\s+|require\s*\()\s*['"`]([^'"`]+)['"`]\s*\)?/gm;

const MAX_ISSUES = 10;

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveLocal(absDir: string, spec: string): Promise<boolean> {
  const base = path.resolve(absDir, spec);

  if (await pathExists(base)) return true;

  for (const ext of JS_EXT) {
    if (await pathExists(base + ext)) return true;
  }

  try {
    const stat = await fs.stat(base);
    if (stat.isDirectory()) {
      for (const name of INDEX_NAMES) {
        if (await pathExists(path.join(base, name))) return true;
      }
    }
  } catch {
    // not a directory
  }

  if (/\.(m?js)$/.test(spec)) {
    const stripped = base.replace(/\.m?js$/, '');
    for (const ext of ['.ts', '.tsx']) {
      if (await pathExists(stripped + ext)) return true;
    }
  }

  return false;
}

/**
 * Strip // line comments and block comments while preserving newlines and
 * string contents. Prevents false positives when we'd otherwise match import
 * patterns that appear inside comments.
 */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let inString: string | null = null;
  while (i < src.length) {
    const ch = src[i]!;
    const next = src[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < src.length) {
        out += src[i + 1];
        i += 2;
        continue;
      }
      if (ch === inString) inString = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      out += ch;
      i++;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

export const brokenImportsCheck: Check = async (ctx) => {
  const issues: Issue[] = [];

  for (const f of ctx.sourceFiles) {
    if (issues.length >= MAX_ISSUES) break;
    if (!JS_FILE_RE.test(f)) continue;
    const abs = path.join(ctx.root, f);
    const raw = await safeReadText(abs);
    if (!raw) continue;
    const content = stripComments(raw);
    const dir = path.dirname(abs);

    for (const match of content.matchAll(IMPORT_RE)) {
      const spec = match[1]!;
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
      const ok = await resolveLocal(dir, spec);
      if (!ok) {
        issues.push({
          severity: 'critical',
          code: 'broken-import',
          message: `Unresolved local import "${spec}" in ${f}`,
          file: f,
          line: lineOf(content, match.index ?? 0),
          penalty: 10,
        });
        if (issues.length >= MAX_ISSUES) break;
      }
    }
  }

  const cap = 40;
  let spent = 0;
  for (const issue of issues) {
    const before = issue.penalty ?? 0;
    const next = Math.min(before, Math.max(0, cap - spent));
    issue.penalty = next;
    spent += next;
  }

  return { issues };
};

function lineOf(text: string, offset: number): number {
  let n = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) n++;
  }
  return n;
}
