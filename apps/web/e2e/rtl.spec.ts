/**
 * Direction and digits, on a real screen.
 *
 * packages/ui/CLAUDE.md: "a component that has only been seen in LTR is not
 * done." The unit tests scan the source for physical CSS properties; only a
 * browser can say what the layout actually did, and only a browser can confirm
 * that a run of digits stayed left-to-right inside Hebrew text.
 */

import { todayInIsrael } from '@/lib/today.ts';
import { expect, test } from '@playwright/test';
import { lmpForWeeks, newEmail, onboard, signUp, WEEKS_PREGNANT } from './fixtures.ts';

test('Hebrew lays out right-to-left and English left-to-right', async ({ page }) => {
  await page.goto('/he/sign-in');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');

  await page.goto('/en/sign-in');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('a gestational age stays left-to-right inside Hebrew', async ({ page }) => {
  const today = todayInIsrael();
  await signUp(page, newEmail());
  await onboard(page, { lmp: lmpForWeeks(today, WEEKS_PREGNANT) });

  // `20+0` must not render as `0+20`. The `numeric` utility in tokens.css is
  // what prevents it, by isolating the run of digits from the surrounding
  // right-to-left text.
  const gestation = page.getByText(`שבוע ${WEEKS_PREGNANT}+0`);
  await expect(gestation).toBeVisible();
  await expect(gestation).toHaveClass(/numeric/);
  await expect(gestation).toHaveCSS('unicode-bidi', 'isolate');
  await expect(gestation).toHaveCSS('direction', 'ltr');
});

test('a 404 inside a locale is localised and right-to-left', async ({ page }) => {
  const response = await page.goto('/he/nope');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'הדף לא נמצא' })).toBeVisible();
  // The 404 renders inside Next's own error document, which carries no dir, so
  // the fragment states its own. This is the assertion that it does.
  await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
});
