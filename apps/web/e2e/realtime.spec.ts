/**
 * One household, two screens.
 *
 * The claim is narrow and is the reason `task_state` is in the realtime
 * publication: a change made on one screen appears on the other without a
 * reload. Two browser contexts, so two cookie jars, so genuinely two clients —
 * the same account signed in on a phone and a laptop, which is also the first
 * way a couple hits this in real life.
 *
 * The two-parent case is `invite.spec.ts`: it needs an invite, a join and two
 * accounts, and bundling it with this assertion produced one slow test that
 * could fail for four unrelated reasons.
 *
 * What travels over the socket is a notification, not data. The subscription
 * calls `router.refresh()`, and the server re-reads through the service layer
 * with that viewer's own JWT — so RLS decides what the second screen sees, and
 * the payload is never displayed.
 */

import { todayInIsrael } from '@/lib/today.ts';
import { expect, test } from '@playwright/test';
import {
  labels,
  lmpForWeeks,
  newEmail,
  onboard,
  signIn,
  signUp,
  WEEKS_PREGNANT,
} from './fixtures.ts';

test('a tick on one device reaches the other without a reload', async ({ browser }) => {
  const today = todayInIsrael();
  const email = newEmail('both-devices');

  const phoneContext = await browser.newContext();
  const laptopContext = await browser.newContext();

  try {
    const phone = await phoneContext.newPage();
    const laptop = await laptopContext.newPage();

    await signUp(phone, email);
    await onboard(phone, { lmp: lmpForWeeks(today, WEEKS_PREGNANT) });

    await signIn(laptop, email);
    await laptop.goto('/he/checklist');
    await phone.goto('/he/checklist');

    const onLaptop = laptop
      .locator('li')
      .filter({ has: laptop.getByRole('button', { name: labels.he.markDone }) })
      .first();
    const title = (await onLaptop.getByRole('heading').first().textContent())!;
    expect(title).toBeTruthy();

    // Ticked on the phone.
    await phone
      .locator('li')
      .filter({ hasText: title })
      .first()
      .getByRole('button', { name: labels.he.markDone })
      .click();

    // Seen on the laptop, which nobody touched.
    await expect(
      laptop
        .locator('li')
        .filter({ hasText: title })
        .first()
        .getByRole('button', { name: labels.he.undo }),
    ).toBeVisible({ timeout: 20_000 });
  } finally {
    await phoneContext.close();
    await laptopContext.close();
  }
});
