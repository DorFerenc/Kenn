/**
 * Two parents, one household.
 *
 * The invite is a link rather than an email, so the whole flow is testable
 * without a mail server: parent A creates it, parent B redeems it, and both are
 * then looking at one checklist. The three things that must hold are that it
 * works once, that it works only once, and that revoking it works — a link sent
 * over WhatsApp can be forwarded, so reuse and revocation are the controls that
 * make showing it once survivable.
 */

import { todayInIsrael } from '@/lib/today.ts';
import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  labels,
  lmpForWeeks,
  newEmail,
  onboard,
  signUp,
  WEEKS_PREGNANT,
} from './fixtures.ts';

/** Parent A: a household, and an invite link ready to send. */
async function householdWithInvite(browser: Browser): Promise<{
  page: Page;
  close: () => Promise<void>;
  link: string;
}> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await signUp(page, newEmail('parent-a'));
  await onboard(page, { lmp: lmpForWeeks(todayInIsrael(), WEEKS_PREGNANT) });

  await page.goto('/he/household');
  await page.getByLabel('הדוא״ל של ההורה השני').fill(newEmail('parent-b'));
  await page.getByRole('button', { name: 'צרי קישור', exact: true }).click();

  const shown = await page.getByRole('textbox', { name: 'הקישור מוכן' }).inputValue();
  expect(shown).toMatch(/\/he\/join\/[0-9a-f]{64}$/);

  return { page, close: () => context.close(), link: new URL(shown).pathname };
}

test('the other parent joins and sees the same checklist', async ({ browser }) => {
  test.slow();
  const a = await householdWithInvite(browser);
  const contextB = await browser.newContext();

  try {
    const b = await contextB.newPage();
    await signUp(b, newEmail('parent-b-account'));
    await b.goto(a.link);
    await b.getByRole('button', { name: 'הצטרפו' }).click();
    await expect(b).toHaveURL(/\/he\/today$/);

    // One checklist, not a copy of one: B sees an item A can also see.
    //
    // B's buttons read `סמנו`, not `סמני`. A chose the feminine form in the
    // wizard; B joined by invite and never walked it, so B gets the neutral
    // plural — per member, not per household, which is the case the UI must get
    // right and the easiest one to forget to test. Looking for A's wording on
    // B's screen is how this test first failed, and the app was right.
    await b.goto('/he/checklist');
    const forB = b
      .locator('li')
      .filter({ has: b.getByRole('button', { name: labels.he.markDoneNeutral }) })
      .first();
    const title = (await forB.getByRole('heading').first().textContent())!;
    expect(title).toBeTruthy();

    await expect(b.getByRole('button', { name: labels.he.markDone })).toHaveCount(0);

    await a.page.goto('/he/checklist');
    const forA = a.page.locator('li').filter({ hasText: title }).first();
    await expect(forA).toBeVisible();
    await expect(forA.getByRole('button', { name: labels.he.markDone })).toBeVisible();

    // And B is listed as a member of A's household.
    await a.page.goto('/he/household');
    await expect(a.page.getByRole('listitem').filter({ hasText: 'הורה' })).toHaveCount(2);
  } finally {
    await a.close();
    await contextB.close();
  }
});

test('an invite link cannot be used twice', async ({ browser }) => {
  test.slow();
  const a = await householdWithInvite(browser);
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();

  try {
    const b = await contextB.newPage();
    await signUp(b, newEmail('parent-b-account'));
    await b.goto(a.link);
    await b.getByRole('button', { name: 'הצטרפו' }).click();
    await expect(b).toHaveURL(/\/he\/today$/);

    // A third person with the same forwarded link gets nothing. Reuse is
    // checked inside accept_invite(), in SQL, so this holds however the app is
    // called — including from a future MCP client.
    const c = await contextC.newPage();
    await signUp(c, newEmail('someone-else'));
    await c.goto(a.link);
    await c.getByRole('button', { name: 'הצטרפו' }).click();
    await expect(c).toHaveURL(/\/he\/join\/invalid$/);
  } finally {
    await a.close();
    await contextB.close();
    await contextC.close();
  }
});

test('a revoked invite stops working', async ({ browser }) => {
  test.slow();
  const a = await householdWithInvite(browser);
  const contextB = await browser.newContext();

  try {
    await a.page.getByRole('button', { name: 'בטלי הזמנה' }).click();
    await expect(a.page.getByText('אין הזמנות פתוחות.')).toBeVisible();

    const b = await contextB.newPage();
    await signUp(b, newEmail('parent-b-account'));
    await b.goto(a.link);
    await b.getByRole('button', { name: 'הצטרפו' }).click();
    await expect(b).toHaveURL(/\/he\/join\/invalid$/);
  } finally {
    await a.close();
    await contextB.close();
  }
});
