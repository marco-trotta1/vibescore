import type { Issue } from './types.js';

export type RoastableIssueCode =
  | 'broken-import'
  | 'duplicate-block'
  | 'file-large'
  | 'file-very-large'
  | 'inconsistent-naming'
  | 'markers'
  | 'missing-ci'
  | 'missing-env-example'
  | 'missing-readme'
  | 'no-tests'
  | 'no-tests-critical'
  | 'placeholder-stub'
  | 'possibly-unused-dep'
  | 'potential-secret'
  | 'thin-readme';

type Roaster = (issue: Issue) => string;

function firstNumber(text: string): string {
  return text.match(/\d+/)?.[0] ?? 'Multiple';
}

function quoted(text: string): string | null {
  return text.match(/"([^"]+)"/)?.[1] ?? null;
}

function after(text: string, marker: string): string | null {
  const idx = text.indexOf(marker);
  if (idx === -1) return null;
  return text.slice(idx + marker.length).trim();
}

function secretKind(issue: Issue): string {
  return issue.message.match(/\(([^)]+)\)/)?.[1] ?? 'secret';
}

export const ROASTS: Record<RoastableIssueCode, Roaster> = {
  'broken-import': (issue) => {
    const spec = quoted(issue.message) ?? 'some imaginary file';
    return `You imported "${spec}" from the land of make-believe. The runtime is not going to manifest your missing module.`;
  },
  'duplicate-block': (issue) => {
    const count = firstNumber(issue.message);
    return `A ${count}-line copy-paste shrine. Apparently abstraction was busy and Ctrl+C was leading architecture.`;
  },
  'file-large': (issue) => {
    const lines = issue.message.match(/\((\d+) lines\)/)?.[1] ?? firstNumber(issue.message);
    return `${lines} lines in one file. This is not a module, it is a junk drawer with exports.`;
  },
  'file-very-large': (issue) => {
    const lines = issue.message.match(/\((\d+) lines\)/)?.[1] ?? firstNumber(issue.message);
    return `${lines} lines in one file. At this size, scrolling counts as onboarding.`;
  },
  'inconsistent-naming': (issue) => {
    const dir = issue.file ?? after(issue.message, ' in ')?.replace(/:.*$/, '') ?? 'this directory';
    return `${dir} is hosting a filename identity crisis. Pick a convention before the next file asks for a personality test.`;
  },
  markers: (issue) => {
    const count = firstNumber(issue.message);
    const top = after(issue.message, 'Top:');
    return `${count} monument${count === '1' ? '' : 's'} to your broken promises. You were not coming back to fix these${top ? `; ${top} kept the receipts` : ''}.`;
  },
  'missing-ci': () =>
    'No CI. The test suite is apparently a vibe check you perform manually after deployment catches fire.',
  'missing-env-example': () =>
    'You used env vars and left no .env.example. Future contributors get to play credential charades.',
  'missing-readme': () =>
    'No README at the repo root. Bold choice making the first user experience a scavenger hunt.',
  'no-tests': () =>
    'No tests found. The codebase is being held together by confidence and crossed fingers.',
  'no-tests-critical': (issue) => {
    const where = issue.file ? `/${issue.file}` : 'critical code';
    return `No tests for ${where}. Production is your QA department now, apparently.`;
  },
  'placeholder-stub': (issue) => {
    const text = quoted(issue.message) ?? 'placeholder code';
    return `Placeholder code made it into the repo: "${text}". The prototype costume is not fooling anyone.`;
  },
  'possibly-unused-dep': (issue) => {
    const dep = after(issue.message, 'Possibly unused dependency:') ?? 'this dependency';
    return `${dep} is sitting in package.json like a gym membership nobody uses.`;
  },
  'potential-secret': (issue) => {
    const kind = secretKind(issue);
    if (/AWS/i.test(kind)) {
      return 'Congrats, your AWS key is now open source. That is not infrastructure as code; that is a billing incident.';
    }
    return `Congrats, your ${kind} is now open source. Secret management saw this and filed a complaint.`;
  },
  'thin-readme': (issue) => {
    const missing = after(issue.message, 'README is missing:') ?? 'basic instructions';
    return `Your README skipped ${missing}. It is less documentation than a shrug in Markdown.`;
  },
};

export function roastIssue(issue: Issue): string {
  const roaster = ROASTS[issue.code as RoastableIssueCode];
  return roaster ? roaster(issue) : issue.message;
}

