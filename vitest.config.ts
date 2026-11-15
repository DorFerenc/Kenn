import { defineConfig } from 'vitest/config';

// One root test run for the whole workspace. Vitest `projects` (one config per
// package) is worth splitting out once a package needs its own environment.
// apps/web's tests are still a Node run: they cover the service layer against a
// fake client, the one module that reads a clock, and two repository scans —
// none of which wants a DOM. The screens are covered by Playwright, which uses
// a real browser rather than an imitation of one.
export default defineConfig({
  test: {
    include: [
      'packages/*/*.test.ts',
      'packages/*/src/**/*.test.ts',
      'packages/*/scripts/**/*.test.ts',
      'scripts/**/*.test.mjs',
      'apps/web/lib/**/*.test.ts',
    ],
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
