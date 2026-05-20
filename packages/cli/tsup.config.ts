import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: false,
  noExternal: ['@page-dep-map/analyzer', '@page-dep-map/shared'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
