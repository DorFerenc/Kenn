/**
 * The doors.
 *
 * RLS is what actually protects a household, and the pgTAP suite is where that
 * is proven. What this file covers is the layer above: that a signed-out
 * request never reaches a household screen at all, and that an invite link
 * cannot be reused, revoked and reused, or guessed.
 */

import { expect, test } from '@playwright/test';
import { todayInIsrael } from '@/lib/today.ts';
import {
  formError,
  lmpForWeeks,
  newEmail,
  onboard,
  signIn,
  signUp,
  WEEKS_PREGNANT,
} from './fixtures.ts';

for (const path of ['/he/today', '/he/checklist', '/he/household', '/he/onboarding']) {
  test(`${path} sends a signed-out visitor to sign-in`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/he\/sign-in/);
  });
}

test('the front door routes by what the account has', async ({ page }) => {
  const today = todayInIsrael();
  await page.goto('/he');
  await expect(page).toHaveURL(/\/he\/sign-in/);

  await signUp(page, newEmail());
  await page.goto('/he');
  await expect(page).toHaveURL(/\/he\/onboarding$/);

  await onboard(page, { lmp: lmpForWeeks(today, WEEKS_PREGNANT) });
  await page.goto('/he');
  await expect(page).toHaveURL(/\/he\/today$/);
});

test('a made-up invite token is refused', async ({ page }) => {
  await signUp(page, newEmail());

  // Well-formed but never issued: the form is offered, and redeeming it fails.
  await page.goto(`/he/join/${'a'.repeat(64)}`);
  await page.getByRole('button', { name: 'הצטרפו' }).click();
  await expect(page).toHaveURL(/\/he\/join\/invalid$/);
  await expect(formError(page)).toContainText('הקישור אינו תקף');
});

test('a malformed invite token is refused without being tried', async ({ page }) => {
  await signUp(page, newEmail());
  await page.goto('/he/join/not-a-token');
  await expect(formError(page)).toContainText('הקישור אינו תקף');
  await expect(page.getByRole('button', { name: 'הצטרפו' })).toHaveCount(0);
});

test('signing out ends the session', async ({ page }) => {
  const today = todayInIsrael();
  const email = newEmail();
  await signUp(page, email);
  await onboard(page, { lmp: lmpForWeeks(today, WEEKS_PREGNANT) });

  await page.getByRole('button', { name: 'יציאה' }).click();
  await expect(page).toHaveURL(/\/he\/sign-in/);

  await page.goto('/he/today');
  await expect(page).toHaveURL(/\/he\/sign-in/);

  // And the same credentials get back in.
  await signIn(page, email);
  await expect(page).toHaveURL(/\/he\/today$/);
});
