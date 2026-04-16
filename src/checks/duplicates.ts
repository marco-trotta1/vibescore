import path from 'node:path';
import crypto from 'node:crypto';
import type { Check, Issue } from '../types.js';
import { safeReadText } from '../utils/files.js';

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs|java|kt|swift|c|cc|cpp|h|hpp|cs|php|scala|vue|svelte|astro)$/i;

const WINDOW = 6; // lines per window
const MIN_LINE_LEN = 8; // drop trivial lines from normalization
const MAX_CLUSTERS_REPORTED = 10;

function normalizeLine(raw: string): string {
  let line = raw;
  // strip common single-line comments
  line = line.replace(/\/\/.*$/, '');
  line = line.replace(/#.*$/, '');
  // collapse whitespace
  line = line.replace(/\s+/g, ' ').trim();
  return line;
}

export const duplicatesCheck: Check = async (ctx) => {
  const issues: Issue[] = [];
  const hashToLocations = new Map<string, { file: string; start: number }[]>();

  for (const f of ctx.sourceFiles) {
    if (!CODE_EXT.test(f)) continue;
    const content = await safeReadText(path.join(ctx.root, f));
    if (!content) continue;
    const rawLines = content.split(/\r?\n/);
    const normalized: { line: string; idx: number }[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      const n = normalizeLine(rawLines[i]!);
      if (n.length >= MIN_LINE_LEN) normalized.push({ line: n, idx: i });
    }
    if (normalized.length < WINDOW) continue;
    for (let i = 0; i <= normalized.length - WINDOW; i++) {
      const slice = normalized.slice(i, i + WINDOW).map((n) => n.line).join('\n');
      const hash = crypto.createHash('sha1').update(slice).digest('hex').slice(0, 16);
      const locs = hashToLocations.get(hash) ?? [];
      locs.push({ file: f, start: normalized[i]!.idx + 1 });
      hashToLocations.set(hash, locs);
    }
  }

  const clusters = [...hashToLocations.entries()]
    .filter(([, locs]) => {
      if (locs.length < 2) return false;
      // Only count clusters that span 2+ distinct files OR 3+ occurrences in one file.
      const files = new Set(locs.map((l) => l.file));
      if (files.size >= 2) return true;
      return locs.length >= 3;
    });

  let reported = 0;
  for (const [, locs] of clusters) {
    if (reported >= MAX_CLUSTERS_REPORTED) break;
    const files = [...new Set(locs.map((l) => l.file))];
    const preview = locs
      .slice(0, 3)
      .map((l) => `${l.file}:${l.start}`)
      .join(', ');
    issues.push({
      severity: 'warning',
      code: 'duplicate-block',
      message: `Duplicate ${WINDOW}-line block found in ${files.length} file${files.length === 1 ? '' : 's'} (${preview})`,
      file: locs[0]?.file ?? null,
      line: locs[0]?.start ?? null,
      penalty: 3,
    });
    reported++;
  }
  return { issues };
};
