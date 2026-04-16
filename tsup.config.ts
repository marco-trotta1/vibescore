import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    dts: false,
    clean: true,
    splitting: false,
    sourcemap: true,
    shims: true,
    banner: { js: '#!/usr/bin/env node' },
  },
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    dts: true,
    clean: false,
    splitting: false,
    sourcemap: true,
    shims: true,
  },
]);
