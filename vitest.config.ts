import { defineConfig } from 'vitest/config';

// One root test run for the whole workspace. Vitest `projects` (one config per
// package) is worth splitting out once a package needs its own environment —
// apps/web will need jsdom at step 5. Until then a single Node run is simpler.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/*/scripts/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['packages/*/src/**/*.ts'],
    },
  },
});
