import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright arrives at roadmap step 5a, with the first screens worth testing.
 *
 * Three choices worth knowing:
 *
 * 1. **It runs against the local Supabase stack**, not a mock. The whole point
 *    of these tests is the part unit tests cannot reach: a real session cookie,
 *    a real RLS-filtered read, and two browsers watching one household.
 *    `pnpm db:start` first, then `pnpm dev:env`.
 * 2. **Each test makes its own household**, with dates computed from the day
 *    the test runs. A fixture pinned to a calendar date would pass today and
 *    fail in March; `seed.sql`'s placeholder pregnancy is for browsing, not for
 *    asserting against.
 * 3. **Chromium only.** The PWA's targets are both parents' phones, which is
 *    step 5b's business with a real deployment; what these tests cover is
 *    behaviour, not rendering engines.
 */
export default defineConfig({
  testDir: './e2e',
  // Each test signs up its own user, so nothing is shared to serialise over.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // Each test signs up an account and walks the wizard, which is four server
  // actions and a redirect.
  timeout: 90_000,

  use: {
    baseURL: process.env.KENN_BASE_URL ?? 'http://127.0.0.1:3000',
    // Recording every test costs about a third of the run's CPU. A failure is
    // re-run with `--trace on`.
    trace: 'off',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  /**
   * A production build, not `next dev`, and that was not a preference.
   *
   * The dev server compiles each route on first request, which put several
   * tests over their timeout while the app itself was working. Worse, it blocks
   * cross-origin requests to its own HMR endpoint, and reaching it on
   * `127.0.0.1` therefore left React unhydrated: Playwright could tick a radio
   * and watch the DOM change while the component's state never did — a failure
   * that looks exactly like a broken form.
   *
   * A built server has neither problem and is what actually ships.
   */
  webServer: {
    command: 'pnpm --filter @kenn/web build && pnpm --filter @kenn/web start',
    url: 'http://127.0.0.1:3000/he',
    cwd: '../..',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
