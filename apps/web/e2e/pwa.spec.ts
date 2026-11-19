/**
 * The installable, offline-aware app, and its Content-Security-Policy
 * (roadmap step 6a).
 *
 * The property most worth a browser test is a negative one: after a signed-in
 * session, **no household page is in any cache**. A caching default that
 * stored the checklist would pass every other test here.
 */

import { todayInIsrael } from '@/lib/today.ts';
import { expect, test, type Page } from '@playwright/test';
import { lmpForWeeks, newEmail, onboard, signUp, WEEKS_PREGNANT } from './fixtures.ts';

/** Every CSP violation the page reports, from the moment this is called. */
function collectViolations(page: Page): string[] {
  const seen: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) seen.push(message.text());
  });
  return seen;
}

async function workerReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
}

test('the manifest names the app and its icons exist', async ({ page }) => {
  const response = await page.request.get('/manifest.webmanifest');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.name).toBe('קֵן');
  expect(manifest.dir).toBe('rtl');
  expect(manifest.display).toBe('standalone');
  expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  for (const icon of manifest.icons) {
    expect((await page.request.get(icon.src)).status()).toBe(200);
  }
  expect((await page.request.get('/icons/apple-touch-icon.png')).status()).toBe(200);
});

test('every page carries a nonce-based CSP, and nothing on the way through violates it', async ({
  page,
}) => {
  const violations = collectViolations(page);

  const first = await page.goto('/he/sign-in');
  const csp = first?.headers()['content-security-policy'] ?? '';
  expect(csp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
  expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/);

  const second = await page.goto('/he/sign-in');
  expect(second?.headers()['content-security-policy']).not.toBe(csp);

  await signUp(page, newEmail('csp'));
  await onboard(page, { lmp: lmpForWeeks(todayInIsrael(), WEEKS_PREGNANT) });
  for (const path of ['/he/today', '/he/checklist', '/he/household', '/en/today']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }

  // Hydration ran under the policy: a tick works, which needs React.
  // On the Checklist, which keeps a done item on screen; Today drops it.
  await page.goto('/he/checklist');
  await page.getByRole('button', { name: 'סמני כבוצע' }).first().click();
  await expect(page.getByRole('button', { name: 'בטלי' }).first()).toBeVisible();

  expect(violations).toEqual([]);
});

test('offline, a page falls back to the offline page and no household page is cached', async ({
  page,
  context,
}) => {
  await signUp(page, newEmail('offline'));
  await onboard(page, { lmp: lmpForWeeks(todayInIsrael(), WEEKS_PREGNANT) });

  await page.goto('/he/today');
  await workerReady(page);
  // Visit the household's pages with the worker in control, so anything it
  // would cache, it has had the chance to.
  await page.reload();
  for (const path of ['/he/today', '/he/checklist', '/he/household']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }

  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
    }
    return urls;
  });
  expect(cached).toContain('/he/offline');
  expect(
    cached.filter((url) => /\/(today|checklist|household|onboarding)\b/.test(url)),
  ).toEqual([]);
  expect(cached.filter((url) => url.startsWith('/api/'))).toEqual([]);

  await context.setOffline(true);
  await page.goto('/he/checklist').catch(() => undefined);
  await expect(page.getByRole('heading', { name: 'אין חיבור' })).toBeVisible();

  // The offline page's one script has to run from the cache, under the CSP it
  // was cached with: still offline, Retry reloads — and the worker answers the
  // reload with the offline page again. A blocked script would do nothing.
  const reloaded = page.waitForEvent('framenavigated');
  await page.getByRole('button', { name: 'נסו שוב' }).click();
  await reloaded;
  await expect(page.getByRole('heading', { name: 'אין חיבור' })).toBeVisible();

  // Back online, the page asked for is the one that loads.
  await context.setOffline(false);
  await page.goto('/he/checklist');
  await expect(page.getByRole('heading', { name: 'הרשימה' })).toBeVisible();
});
