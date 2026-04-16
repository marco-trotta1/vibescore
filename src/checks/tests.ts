import type { Check, Issue } from '../types.js';

const TEST_FILE_RE = /(^|\/)(__tests__\/|tests?\/|.+\.(test|spec)\.[tj]sx?$|.+\.test\.py$|.+_test\.go$)/i;

const CRITICAL_DIRS = ['src/api', 'src/server', 'src/routes', 'src/lib', 'api', 'server', 'routes', 'lib'];

export const testsCheck: Check = (ctx) => {
  const issues: Issue[] = [];
  const hasTests = ctx.files.some((f) => TEST_FILE_RE.test(f));

  const hasCriticalCode = ctx.files.some((f) =>
    CRITICAL_DIRS.some((d) => f === d || f.startsWith(`${d}/`)),
  );

  if (!hasTests) {
    if (hasCriticalCode) {
      const which = CRITICAL_DIRS.filter((d) =>
        ctx.files.some((f) => f === d || f.startsWith(`${d}/`)),
      );
      issues.push({
        severity: 'critical',
        code: 'no-tests-critical',
        message: `No tests found despite critical code in /${which[0]}`,
        file: which[0] ?? null,
        line: null,
        penalty: 15,
      });
    } else if (ctx.sourceFiles.some((f) => /^src\//.test(f))) {
      issues.push({
        severity: 'warning',
        code: 'no-tests',
        message: 'No tests found in repository',
        file: null,
        line: null,
        penalty: 6,
      });
    }
  }

  return { issues };
};
