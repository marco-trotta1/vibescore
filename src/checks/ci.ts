import type { Check, Issue } from '../types.js';

const CI_MARKERS = [
  /^\.github\/workflows\//,
  /^\.gitlab-ci\.yml$/,
  /^\.circleci\/config\.yml$/,
  /^azure-pipelines\.yml$/,
  /^\.travis\.yml$/,
  /^bitbucket-pipelines\.yml$/,
  /^\.drone\.yml$/,
];

export const ciCheck: Check = (ctx) => {
  const issues: Issue[] = [];
  const hasCI = ctx.files.some((f) => CI_MARKERS.some((re) => re.test(f)));
  if (!hasCI) {
    issues.push({
      severity: 'warning',
      code: 'missing-ci',
      message: 'No CI configuration detected (GitHub Actions, GitLab CI, etc.)',
      file: '.github/workflows/',
      line: null,
      penalty: 5,
    });
  }
  return { issues };
};
