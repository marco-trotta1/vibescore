export type Severity = 'critical' | 'warning' | 'info';

export interface Issue {
  severity: Severity;
  code: string;
  message: string;
  file?: string | null;
  line?: number | null;
  /** Penalty applied to the score for this single issue. */
  penalty?: number;
}

export interface AnalyzeOptions {
  target: string;
  strict: boolean;
  funny: boolean;
  maxFileLines: number;
}

export interface ScoreBand {
  name: string;
  min: number;
  max: number;
  verdicts: string[];
  dryVerdicts: string[];
}

export interface Report {
  target: string;
  score: number;
  band: string;
  strict: boolean;
  summary: {
    critical: number;
    warnings: number;
    info: number;
  };
  issues: Issue[];
  verdict: string;
}

export interface RepoContext {
  /** Absolute path of the target repo. */
  root: string;
  /** All non-ignored files with paths relative to root. */
  files: string[];
  /** Source-ish files (code + configs), excluding lockfiles/binaries. */
  sourceFiles: string[];
  /** Parsed package.json if present, else null. */
  packageJson: PackageJson | null;
  /** Raw root file listing (top-level only). */
  topLevel: string[];
}

export interface PackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  bin?: string | Record<string, string>;
  [key: string]: unknown;
}

export interface CheckResult {
  issues: Issue[];
}

export type Check = (ctx: RepoContext, opts: AnalyzeOptions) => Promise<CheckResult> | CheckResult;
