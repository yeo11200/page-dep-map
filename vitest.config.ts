import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./packages/dashboard/src', import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    include: ['packages/**/__tests__/**/*.test.ts'],
  },
});
