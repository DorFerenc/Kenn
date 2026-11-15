/**
 * Sign up, onboard, and arrive at a dated Today.
 *
 * This is the test that proves the whole pipeline: a session cookie, a
 * household created in SQL, anchors stored, the KB materialised through the
 * engine, and a gestational age on screen. If it passes, roadmap step 5a's
 * claim is true.
 */

import { todayInIsrael } from '@/lib/today.ts';
import { expect, test } from '@playwright/test';
import {
  labels,
  lmpForWeeks,
  newEmail,
  onboard,
  signUp,
  WEEKS_PREGNANT,
} from './fixtures.ts';

test('a new parent onboards and lands on a dated Today', async ({ page }) => {
  const today = todayInIsrael();
  await signUp(page, newEmail());

  // Signed in with no household: the app sends you to the wizard, not to an
  // empty Today.
  await expect(page).toHaveURL(/\/he\/onboarding$/);

  await onboard(page, { lmp: lmpForWeeks(today, WEEKS_PREGNANT) });

  // Week 20+0, counted by the engine from the LMP the wizard was given.
  await expect(page.getByText(`שבוע ${WEEKS_PREGNANT}+0`)).toBeVisible();

  // And the list is real: the late anatomy scan's window is open around now.
  await page.getByRole('link', { name: 'לרשימה המלאה' }).click();
  await expect(page).toHaveURL(/\/he\/checklist$/);
  await expect(page.getByRole('heading', { name: 'סקירת מערכות מאוחרת' })).toBeVisible();
});

test('the wizard addresses a Hebrew reader by the gender form they chose', async ({
  page,
}) => {
  const today = todayInIsrael();
  await signUp(page, newEmail());
  await page.goto('/he/onboarding');

  // Masculine chosen on step 1: the button on step 2 is `המשך`, not `המשיכי`.
  await page.getByRole('radio', { name: labels.he.gender.masculine }).check();
  await page.getByLabel(labels.he.householdName).fill('E2E household');
  await expect(page.getByRole('button', { name: 'המשך', exact: true })).toBeVisible();

  await page.getByRole('radio', { name: labels.he.gender.feminine }).check();
  await expect(page.getByRole('button', { name: 'המשיכי', exact: true })).toBeVisible();

  // And the choice reaches the database: the checklist's button follows it.
  await page.getByRole('button', { name: 'המשיכי' }).click();
  await page.getByLabel(labels.he.lmpDate).fill(lmpForWeeks(today, WEEKS_PREGNANT));
  await page.getByRole('button', { name: 'המשיכי' }).click();
  await page.getByRole('button', { name: 'המשיכי' }).click();
  await page.getByRole('button', { name: 'סיימי' }).click();

  await expect(page).toHaveURL(/\/he\/today$/);
  await expect(page.getByRole('button', { name: 'סמני כבוצע' }).first()).toBeVisible();
});

test('a household cannot be onboarded twice', async ({ page }) => {
  const today = todayInIsrael();
  await signUp(page, newEmail());
  await onboard(page, { lmp: lmpForWeeks(today, WEEKS_PREGNANT) });

  // A second household would orphan the first, so the wizard is a one-way door.
  await page.goto('/he/onboarding');
  await expect(page).toHaveURL(/\/he\/today$/);
});
