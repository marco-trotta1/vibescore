import path from 'node:path';
import type { Check, Issue } from '../types.js';
import { safeReadText } from '../utils/files.js';

export const readmeCheck: Check = async (ctx) => {
  const issues: Issue[] = [];
  const readme = ctx.topLevel.find((f) => /^readme(\.md|\.mdx|\.txt|)$/i.test(f));
  if (!readme) {
    issues.push({
      severity: 'warning',
      code: 'missing-readme',
      message: 'No README file found at repository root',
      file: 'README.md',
      line: null,
      penalty: 10,
    });
    return { issues };
  }

  const content = await safeReadText(path.join(ctx.root, readme));
  if (!content) return { issues };

  const lower = content.toLowerCase();
  const hasWhat = lower.length > 80; // any non-trivial content
  const hasInstall = /##\s*install|\binstall\b|\bnpm i\b|\bnpm install\b|\byarn add\b|\bpnpm add\b|\bpip install\b/i.test(content);
  const hasUsage = /##\s*usage|\busage\b|```[a-z]*\n[\s\S]*```/i.test(content);

  const missing: string[] = [];
  if (!hasWhat) missing.push('description');
  if (!hasInstall) missing.push('install section');
  if (!hasUsage) missing.push('usage section');

  if (missing.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'thin-readme',
      message: `README is missing: ${missing.join(', ')}`,
      file: readme,
      line: null,
      penalty: 4,
    });
  }

  return { issues };
};
