import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  base: './',
  define: {
    // The face photo is optional; decide at build time so a missing file never 404s at runtime.
    __HAS_FACE__: JSON.stringify(existsSync('public/alex-face.png')),
  },
  build: {
    target: 'es2022',
    sourcemap: mode === 'e2e',
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
}));
