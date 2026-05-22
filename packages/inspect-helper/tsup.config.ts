import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  globalName: 'PdmInspect',
  dts: false,
  clean: true,
  sourcemap: false,
  minify: false,
  target: 'es2020',
  platform: 'browser',
});
