import path from 'node:path';
import type { Check, Issue } from '../types.js';
import { safeReadText } from '../utils/files.js';
import { shannonEntropy } from '../utils/entropy.js';

// Patterns intentionally conservative. Each carries a short label for reporting.
const PATTERNS: { label: string; regex: RegExp }[] = [
  { label: 'AWS access key id', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'AWS secret access key', regex: /\baws(.{0,20})?(secret|private)[_-]?access[_-]?key\b.{0,5}['"][A-Za-z0-9/+=]{30,}['"]/i },
  { label: 'Google API key', regex: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { label: 'Slack token', regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { label: 'GitHub PAT', regex: /\bghp_[0-9A-Za-z]{30,}\b/ },
  { label: 'GitHub fine-grained token', regex: /\bgithub_pat_[0-9A-Za-z_]{30,}\b/ },
  { label: 'Stripe secret key', regex: /\bsk_(live|test)_[0-9A-Za-z]{20,}\b/ },
  { label: 'OpenAI key', regex: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { label: 'Anthropic key', regex: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/ },
  { label: 'Private key block', regex: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { label: 'Bearer token', regex: /\bBearer\s+[A-Za-z0-9_\-.=]{20,}\b/ },
  { label: 'JWT', regex: /\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/ },
];

const ASSIGNMENT_RE =
  /(?:api[_-]?key|secret|token|passwd|password|auth|access[_-]?key)\s*[:=]\s*['"`]([^'"`\s]{20,})['"`]/i;

const PLACEHOLDER_RE =
  /(your[_-]?|example|placeholder|xxxxx|\.\.\.|changeme|dummy|fake|redacted|<[^>]+>|sample)/i;

const SKIP_PATH_RE =
  /(^|\/)(node_modules|dist|build|coverage|\.git|test|tests|__tests__|fixtures?|examples?|\.env\.example|\.env\.sample|\.env\.template)(\/|$)/i;

const TEXT_LIKE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|yml|yaml|toml|env|ini|py|rb|go|rs|java|kt|sh|bash|zsh|php|cs|scala|sql|txt)$/i;

const MAX_FINDINGS_PER_FILE = 5;
const MAX_TOTAL_FINDINGS = 25;

export const secretsCheck: Check = async (ctx) => {
  const issues: Issue[] = [];
  let total = 0;

  for (const f of ctx.sourceFiles) {
    if (total >= MAX_TOTAL_FINDINGS) break;
    if (SKIP_PATH_RE.test(f)) continue;
    if (!TEXT_LIKE_EXT.test(f)) continue;

    const content = await safeReadText(path.join(ctx.root, f));
    if (!content) continue;

    const lines = content.split(/\r?\n/);
    let fileFindings = 0;

    for (let i = 0; i < lines.length; i++) {
      if (fileFindings >= MAX_FINDINGS_PER_FILE) break;
      const line = lines[i]!;
      if (line.length > 500) continue; // skip minified-looking lines

      const hit = detectSecretInLine(line);
      if (hit) {
        issues.push({
          severity: 'critical',
          code: 'potential-secret',
          message: `Potential committed secret (${hit}) in ${f}`,
          file: f,
          line: i + 1,
          penalty: 20,
        });
        fileFindings++;
        total++;
        if (total >= MAX_TOTAL_FINDINGS) break;
      }
    }
  }

  // Cap total penalty from secrets so a single noisy file doesn't tank everything absurdly.
  const cap = 60;
  let spent = 0;
  for (const issue of issues) {
    const remaining = Math.max(0, cap - spent);
    const before = issue.penalty ?? 0;
    const next = Math.min(before, remaining);
    issue.penalty = next;
    spent += next;
  }
  return { issues };
};

function detectSecretInLine(line: string): string | null {
  for (const { label, regex } of PATTERNS) {
    const m = line.match(regex);
    if (m && !PLACEHOLDER_RE.test(m[0] ?? '')) {
      return label;
    }
  }

  const assign = line.match(ASSIGNMENT_RE);
  if (assign) {
    const value = assign[1] ?? '';
    if (PLACEHOLDER_RE.test(value)) return null;
    if (shannonEntropy(value) >= 4.0 && value.length >= 24) {
      return 'high-entropy string in credential assignment';
    }
  }
  return null;
}
