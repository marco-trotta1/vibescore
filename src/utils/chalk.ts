interface Style {
  (value: string): string;
  bold: Style;
  cyan: Style;
  dim: Style;
  green: Style;
  greenBright: Style;
  italic: Style;
  red: Style;
  redBright: Style;
  white: Style;
  yellow: Style;
  [style: string]: Style;
}

export interface SafeChalk {
  bold: Style;
  cyan: Style;
  dim: Style;
  green: Style;
  greenBright: Style;
  italic: Style;
  level: number;
  red: Style;
  redBright: Style;
  white: Style;
  yellow: Style;
}

const passthrough = ((value: string) => value) as Style;

const fallbackStyle: Style = new Proxy(passthrough, {
  get: () => fallbackStyle,
});

const fallbackChalk: SafeChalk = new Proxy(fallbackStyle, {
  get: (_target, property) => (property === 'level' ? 0 : fallbackStyle),
}) as unknown as SafeChalk;

async function loadChalk(): Promise<SafeChalk> {
  try {
    const mod = await import('chalk');
    return mod.default as unknown as SafeChalk;
  } catch {
    return fallbackChalk;
  }
}

export const chalk = await loadChalk();
