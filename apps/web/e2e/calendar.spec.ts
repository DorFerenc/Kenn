/**
 * The private calendar feed, end to end (roadmap step 6a).
 *
 * The feed is fetched by a calendar server that has no session, so the link is
 * requested here from a fresh request context with no cookies — the way
 * Google's servers would see it. What must hold: the link works with no
 * session, it is one household's windows in the creator's language, and
 * rotating or revoking it makes the old link a bare 404 indistinguishable from
 * a link that never existed.
 */

import { todayInIsrael } from '@/lib/today.ts';
import { expect, request, test, type Page } from '@playwright/test';
import { lmpForWeeks, newEmail, onboard, signUp, WEEKS_PREGNANT } from './fixtures.ts';

async function makeLink(page: Page, button: string): Promise<string> {
  await page.getByRole('button', { name: button }).click();
  const link = await page
    .getByRole('textbox', { name: 'הקישור ליומן מוכן' })
    .inputValue();
  expect(link).toMatch(/\/api\/ics\/[0-9a-f]{64}$/);
  return link;
}

/** Fetched with no cookies at all: a calendar server's view. */
async function anonymousGet(url: string) {
  const anon = await request.newContext();
  const response = await anon.get(url);
  const result = {
    status: response.status(),
    type: response.headers()['content-type'] ?? '',
    cache: response.headers()['cache-control'] ?? '',
    body: await response.text(),
  };
  await anon.dispose();
  return result;
}

test('a calendar link serves the household’s windows with no session, until it is replaced or revoked', async ({
  page,
}) => {
  await signUp(page, newEmail('calendar'));
  await onboard(page, { lmp: lmpForWeeks(todayInIsrael(), WEEKS_PREGNANT) });
  await page.goto('/he/household');

  // The privacy warning is on screen before the link exists.
  await expect(page.getByText('שמות הבדיקות יופיעו ביומן שלכם')).toBeVisible();

  const first = await makeLink(page, 'צרי קישור ליומן');
  const feed = await anonymousGet(first);
  expect(feed.status).toBe(200);
  expect(feed.type).toContain('text/calendar');
  expect(feed.cache).toContain('no-store');
  expect(feed.body).toContain('BEGIN:VCALENDAR');
  expect(feed.body).toContain('BEGIN:VEVENT');
  // In Hebrew, because the link was made from the Hebrew page.
  expect(feed.body).toContain('חומצה פולית');

  // Making a new link cancels the old one.
  await page.reload();
  const second = await makeLink(page, 'צרי קישור חדש');
  expect((await anonymousGet(first)).status).toBe(404);
  expect((await anonymousGet(second)).status).toBe(200);

  // Revoking leaves a 404 with no body: nothing to tell a revoked link from
  // one that never existed.
  await page.reload();
  await page.getByRole('button', { name: 'בטלי את הקישור' }).click();
  await expect(page.getByText('עוד אין קישור ליומן.')).toBeVisible();
  const revoked = await anonymousGet(second);
  const unknown = await anonymousGet(second.replace(/[0-9a-f]{64}$/, '0'.repeat(64)));
  expect(revoked.status).toBe(404);
  expect(unknown.status).toBe(404);
  expect(revoked.body).toBe(unknown.body);
});

test('a ticked item leaves the calendar', async ({ page }) => {
  await signUp(page, newEmail('calendar-tick'));
  await onboard(page, { lmp: lmpForWeeks(todayInIsrael(), WEEKS_PREGNANT) });
  await page.goto('/he/household');
  const link = await makeLink(page, 'צרי קישור ליומן');

  const before = (await anonymousGet(link)).body.match(/BEGIN:VEVENT/g)?.length ?? 0;

  // On the Checklist, which keeps a done item on screen; Today drops it.
  await page.goto('/he/checklist');
  await page.getByRole('button', { name: 'סמני כבוצע' }).first().click();
  await expect(page.getByRole('button', { name: 'בטלי' }).first()).toBeVisible();

  // The tick on screen is optimistic; the row lands a moment later.
  await expect
    .poll(async () => (await anonymousGet(link)).body.match(/BEGIN:VEVENT/g)?.length ?? 0)
    .toBe(before - 1);
});
