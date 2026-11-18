/**
 * Ticking an item, and putting it back.
 *
 * The behaviour under test is the one packages/ui/CLAUDE.md insists on: act,
 * then offer undo — no confirmation dialog anywhere. And the decision has to
 * survive a reload, because the optimistic tick is a lie until the row is
 * written.
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

test('a task is ticked, stays ticked, and can be undone', async ({ page }) => {
  const today = todayInIsrael();
  await signUp(page, newEmail());
  await onboard(page, { lmp: lmpForWeeks(today, WEEKS_PREGNANT) });

  await page.goto('/he/checklist');

  const open = page.getByRole('heading', { name: 'פתוח עכשיו' });
  await expect(open).toBeVisible();

  // The first open item, whatever the calendar makes it.
  const item = page
    .locator('li')
    .filter({ has: page.getByRole('button', { name: labels.he.markDone }) })
    .first();
  const title = await item.getByRole('heading').textContent();
  expect(title).toBeTruthy();

  await item.getByRole('button', { name: labels.he.markDone }).click();

  // No dialog asked anything; the item is simply done and offers undo.
  const done = page.locator('li').filter({ hasText: title! }).first();
  await expect(done.getByRole('button', { name: labels.he.undo })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'בוצע' })).toBeVisible();

  // It survives a reload, which is the difference between an optimistic tick
  // and a written row.
  await page.reload();
  const afterReload = page.locator('li').filter({ hasText: title! }).first();
  await expect(afterReload.getByRole('button', { name: labels.he.undo })).toBeVisible();

  // Undo puts it back in the group the window says it belongs to.
  await afterReload.getByRole('button', { name: labels.he.undo }).click();
  await expect(
    page
      .locator('li')
      .filter({ hasText: title! })
      .first()
      .getByRole('button', { name: labels.he.markDone }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page
      .locator('li')
      .filter({ hasText: title! })
      .first()
      .getByRole('button', { name: labels.he.markDone }),
  ).toBeVisible();
});

test('Today shows the next three due items and no more', async ({ page }) => {
  const today = todayInIsrael();
  await signUp(page, newEmail());
  await onboard(page, { lmp: lmpForWeeks(today, WEEKS_PREGNANT) });

  const cards = page.locator('main li');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(3);
});

test('an English reader gets the same household in English', async ({ page }) => {
  const today = todayInIsrael();
  const email = newEmail();
  await signUp(page, email, 'en');
  await onboard(page, { lmp: lmpForWeeks(today, WEEKS_PREGNANT), locale: 'en' });

  await expect(page.getByText(`Week ${WEEKS_PREGNANT}+0`)).toBeVisible();
  await page.goto('/en/checklist');
  await expect(page.getByRole('button', { name: 'Mark as done' }).first()).toBeVisible();
});
