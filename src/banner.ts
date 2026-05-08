import { createRequire } from 'node:module';
import { chalk } from './utils/chalk.js';

const require = createRequire(import.meta.url);

const SWORD = [
  '                         /\\',
  '                        /  \\',
  '                       / /\\ \\',
  '                      / /  \\ \\',
  '                     / /    \\ \\',
  '                    /_/      \\_\\',
  '                       ||||||',
  '                       ||||||',
  '                       ||||||',
  '                       ||||||',
  '                       ||||||',
  '                       ||||||',
  '                 ______||||||______',
  '                /______||||||______\\',
  '                       ||||||',
  '                       ||||||',
  '                       ||||||',
  '                       ||||||',
  '                      /||||||\\',
  '                     /__||||__\\',
  '                        ||||',
  '                        ||||',
  '                    ____||||____',
  '                   /____||||____\\',
  '                        ||||',
  '                        ||||',
].join('\n');

const FALLBACK_WORDMARK = [
  'BBBB    AAA   DDDD  V   V III BBBB  EEEEE  SSS ',
  'B   B  A   A  D   D V   V  I  B   B E     S    ',
  'BBBB   AAAAA  D   D V   V  I  BBBB  EEEE   SSS ',
  'B   B  A   A  D   D  V V   I  B   B E         S',
  'BBBB   A   A  DDDD    V   III BBBB  EEEEE SSSS ',
].join('\n');

interface Figlet {
  textSync: (
    text: string,
    options?: {
      font?: string;
      horizontalLayout?: string;
      verticalLayout?: string;
      width?: number;
      whitespaceBreak?: boolean;
    },
  ) => string;
}

function loadFiglet(): Figlet | undefined {
  try {
    return require('figlet') as Figlet;
  } catch {
    return undefined;
  }
}

function renderWordmark(): string {
  const figlet = loadFiglet();
  if (!figlet) return FALLBACK_WORDMARK;

  try {
    return figlet.textSync('BADVIBES', { font: 'Big' }).trimEnd();
  } catch {
    return FALLBACK_WORDMARK;
  }
}

export function renderBanner(): string {
  return `${chalk.red(SWORD)}\n${chalk.red(renderWordmark())}\n`;
}
