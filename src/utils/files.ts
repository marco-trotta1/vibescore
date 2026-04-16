import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import type { PackageJson, RepoContext } from '../types.js';

const IGNORE_DIRS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.next',
  '.turbo',
  '.cache',
  'out',
  '.vercel',
  '.parcel-cache',
  '.svelte-kit',
  '.nuxt',
  '__pycache__',
];

const IGNORE_PATTERNS = IGNORE_DIRS.map((d) => `**/${d}/**`);

const LOCKFILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'npm-shrinkwrap.json',
  'bun.lockb',
  'bun.lock',
  'composer.lock',
  'Gemfile.lock',
  'poetry.lock',
  'Cargo.lock',
]);

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp', '.tiff',
  '.mp3', '.mp4', '.mov', '.webm', '.wav', '.ogg', '.flac',
  '.pdf', '.zip', '.gz', '.tar', '.7z', '.rar',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.wasm', '.so', '.dylib', '.dll', '.exe', '.bin',
  '.sqlite', '.db', '.psd', '.ai',
  '.lockb',
]);

const SOURCE_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.c', '.cc', '.cpp', '.h', '.hpp',
  '.cs', '.php', '.scala', '.sh', '.bash', '.zsh',
  '.html', '.css', '.scss', '.sass', '.less',
  '.vue', '.svelte', '.astro',
  '.json', '.yml', '.yaml', '.toml', '.ini', '.env',
  '.md', '.mdx',
  '.sql',
]);

export async function listRepoFiles(root: string): Promise<string[]> {
  const entries = await fg(['**/*'], {
    cwd: root,
    dot: true,
    onlyFiles: true,
    ignore: IGNORE_PATTERNS,
    followSymbolicLinks: false,
    suppressErrors: true,
  });
  return entries.sort();
}

export function isLikelyBinary(relPath: string): boolean {
  const ext = path.extname(relPath).toLowerCase();
  if (BINARY_EXT.has(ext)) return true;
  const base = path.basename(relPath);
  if (LOCKFILES.has(base)) return true;
  return false;
}

export function isSourceLike(relPath: string): boolean {
  if (isLikelyBinary(relPath)) return false;
  const ext = path.extname(relPath).toLowerCase();
  if (SOURCE_EXT.has(ext)) return true;
  // Accept dotfile configs without extensions.
  const base = path.basename(relPath);
  if (base.startsWith('.') && !base.includes(' ')) return true;
  return false;
}

export async function safeReadText(absPath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(absPath);
    if (!stat.isFile()) return null;
    // Skip very large files (>2MB) to keep the scanner snappy.
    if (stat.size > 2 * 1024 * 1024) return null;
    const buf = await fs.readFile(absPath);
    // Cheap binary sniff: null byte in first 4KB.
    const slice = buf.subarray(0, Math.min(buf.length, 4096));
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === 0) return null;
    }
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

export async function readPackageJson(root: string): Promise<PackageJson | null> {
  const pkgPath = path.join(root, 'package.json');
  try {
    const raw = await fs.readFile(pkgPath, 'utf8');
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}

export async function listTopLevel(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root);
    return entries.filter((e) => !IGNORE_DIRS.includes(e)).sort();
  } catch {
    return [];
  }
}

export async function buildRepoContext(root: string): Promise<RepoContext> {
  const abs = path.resolve(root);
  const [files, topLevel, packageJson] = await Promise.all([
    listRepoFiles(abs),
    listTopLevel(abs),
    readPackageJson(abs),
  ]);
  const sourceFiles = files.filter(isSourceLike);
  return {
    root: abs,
    files,
    sourceFiles,
    packageJson,
    topLevel,
  };
}

export function countLines(content: string): number {
  if (!content) return 0;
  let n = 1;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) n++;
  }
  // Trailing newline — the above counts EOL lines plus the last partial.
  // If the file ends with \n, the last "line" is empty; adjust.
  if (content.length > 0 && content.charCodeAt(content.length - 1) === 10) n--;
  return Math.max(n, 1);
}
