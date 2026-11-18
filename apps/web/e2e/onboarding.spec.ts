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

test('the wizard will not advance past a nameless household', async ({ page }) => {
  // The Finish button on step 4 used to be silently dead for anyone who left
  // the name blank: `required` on a `display: none` field is not focusable, so
  // the browser refused the submit and said so only in the console. The fix
  // validates the step the reader is on, where the field is visible.
  await signUp(page, newEmail());
  await page.goto('/he/onboarding');
  await page.getByRole('radio', { name: labels.he.gender.feminine }).check();

  // No name typed. Next must not move.
  await page.getByRole('button', { name: labels.he.next }).click();
  await expect(page.getByText(labels.he.step(1))).toBeVisible();

  await page.getByLabel(labels.he.householdName).fill('E2E household');
  await page.getByRole('button', { name: labels.he.next }).click();
  await expect(page.getByText(labels.he.step(2))).toBeVisible();
});

test('the tab bar says which tab you are on', async ({ page }) => {
  // Three identical links is what this looked like before: no aria-current and
  // no visual state, so neither a screen reader nor an eye could tell.
  const today = todayInIsrael();
  await signUp(page, newEmail());
  await onboard(page, { lmp: lmpForWeeks(today, WEEKS_PREGNANT) });

  await expect(page.getByRole('link', { name: 'היום' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('link', { name: 'הרשימה' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('link', { name: 'הרשימה' }).click();
  await expect(page).toHaveURL(/\/he\/checklist$/);
  await expect(page.getByRole('link', { name: 'הרשימה' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('link', { name: 'היום' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );

  // And the navigation landmark is not named after one of its own items.
  await expect(page.getByRole('navigation', { name: 'ניווט' })).toBeVisible();
});

test('every tap target on the checklist is at least 48 px tall', async ({ page }) => {
  // packages/ui/CLAUDE.md: "48 px minimum tap target. The app is used with one
  // thumb at 3 a.m." The evidence source link was a 43x21 px inline anchor,
  // which no scan for physical CSS properties could have seen — only a measured
  // box in a real browser.
  const today = todayInIsrael();
  await signUp(page, newEmail());
  await onboard(page, { lmp: lmpForWeeks(today, WEEKS_PREGNANT) });
  await page.goto('/he/checklist');

  const targets = page.locator('main li :is(button, a)');
  const count = await targets.count();
  expect(count).toBeGreaterThan(3);

  const tooSmall: { text: string; height: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const target = targets.nth(i);
    const box = await target.boundingBox();
    if (box && box.height < 48) {
      tooSmall.push({
        text: (await target.textContent())?.trim() ?? '',
        height: box.height,
      });
    }
  }
  expect(tooSmall).toEqual([]);
});

test('a household cannot be onboarded twice', async ({ page }) => {
  const today = todayInIsrael();
  await signUp(page, newEmail());
  await onboard(page, { lmp: lmpForWeeks(today, WEEKS_PREGNANT) });

  // A second household would orphan the first, so the wizard is a one-way door.
  await page.goto('/he/onboarding');
  await expect(page).toHaveURL(/\/he\/today$/);
});
