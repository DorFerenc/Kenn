/**
 * What every end-to-end test needs: a fresh account, and a household dated
 * from the day the test runs.
 *
 * Dates are computed rather than fixed. A fixture pinned to a calendar date
 * passes in January and fails in March, which is the slowest possible way to
 * find out that a test was asserting against the clock. `addDays` comes from
 * @kenn/engine for the same reason every other date in Kenn does: there is one
 * place that does date arithmetic.
 */

import { addDays, type IsoDate } from '@kenn/engine';
import { expect, type Page } from '@playwright/test';

/**
 * The two locales the UI translates. A union rather than `string`, so
 * `labels[locale]` is a value and not a maybe —  `noUncheckedIndexedAccess`
 * is on, and every call site would otherwise carry a `!`.
 */
export type TestLocale = 'he' | 'en';
export type GenderChoice = 'feminine' | 'masculine' | 'neutral';

/** 20 weeks: past the NT scan, inside the anatomy-scan window. */
export const WEEKS_PREGNANT = 20;

export function lmpForWeeks(today: IsoDate, weeks: number): IsoDate {
  return addDays(today, -weeks * 7);
}

/** Unique per run, and a reserved test domain — hard rule 11. */
export function newEmail(prefix = 'parent'): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}@kenn.test`;
}

const PASSWORD = 'correct-horse-battery';

export async function signUp(
  page: Page,
  email: string,
  locale: TestLocale = 'he',
): Promise<void> {
  await page.goto(`/${locale}/sign-in?mode=signUp`);
  await page.getByLabel(labels[locale].email).fill(email);
  await page.getByLabel(labels[locale].password, { exact: false }).fill(PASSWORD);
  await page.getByRole('button', { name: labels[locale].signUp }).click();
  await waitUntilSignedIn(page, locale, 'sign-up');
}

export async function signIn(
  page: Page,
  email: string,
  locale: TestLocale = 'he',
): Promise<void> {
  await page.goto(`/${locale}/sign-in`);
  await page.getByLabel(labels[locale].email).fill(email);
  await page.getByLabel(labels[locale].password, { exact: false }).fill(PASSWORD);
  await page.getByRole('button', { name: labels[locale].signIn }).click();
  await waitUntilSignedIn(page, locale, 'sign-in');
}

/**
 * Wait for the whole redirect chain, and fail here rather than three locators
 * later.
 *
 * Two bugs in one helper. The first: a fixture that carries on after its
 * precondition failed turns one clear problem into a confusing one — when the
 * local stack started refusing sign-ups on its rate limit, every test failed on
 * a missing radio button and none of them mentioned auth. The second: the
 * action answers with a redirect to `/<locale>`, which redirects again to the
 * wizard or to Today, and a plain assertion on the URL passes as soon as the
 * first hop lands. The next `goto` then cancels the hop still in flight and
 * arrives without a session.
 */
async function waitUntilSignedIn(
  page: Page,
  locale: TestLocale,
  what: string,
): Promise<void> {
  try {
    await page.waitForURL((url) => !url.pathname.startsWith(`/${locale}/sign-in`), {
      timeout: 20_000,
    });
  } catch {
    // The form's own error, for the message. Scoped to `main`, because Next.js
    // keeps an empty `role="alert"` of its own on every page — its route
    // announcer — and an unscoped look for one finds that instead, then reports
    // a failure that says nothing at all.
    const said = (await formError(page).allTextContents()).join(' ').trim();
    throw new Error(
      `${what} failed${said ? `: the form says "${said}"` : ''} — still at ${page.url()}`,
    );
  }
  await page.waitForLoadState('load');
}

/** The app's own error message, not Next.js's empty route announcer. */
export function formError(page: Page) {
  return page.locator('main [role="alert"]');
}

/**
 * Walk the wizard. Deliberately driven through the real controls rather than
 * by inserting rows: onboarding is the one flow where a parent's first
 * impression and the correctness of every later date are the same code path.
 */
export async function onboard(
  page: Page,
  options: { lmp: IsoDate; locale?: TestLocale; genderForm?: GenderChoice },
): Promise<void> {
  const locale = options.locale ?? 'he';
  const l = labels[locale];

  await page.goto(`/${locale}/onboarding`);
  await expect(page.getByText(l.step(1))).toBeVisible();

  // Step 1 — how to address you, which language, and the household's name.
  await page
    .getByRole('radio', { name: l.gender[options.genderForm ?? 'feminine'] })
    .check();
  await page.getByLabel(l.householdName).fill('E2E household');
  await next(page, l, 2);

  // Step 2 — dating. LMP is the default method.
  await page.getByLabel(l.lmpDate).fill(options.lmp);
  await next(page, l, 3);

  // Step 3 — one baby, already the default.
  await next(page, l, 4);

  // Step 4 — the optional profile answers, all left unanswered on purpose: an
  // unanswered condition must not match.
  await page.getByRole('button', { name: l.finish }).click();

  await expect(page).toHaveURL(new RegExp(`/${locale}/today$`));
}

/**
 * Advance one step, and wait for it to have happened.
 *
 * Waiting on the step indicator is not belt-and-braces. The wizard renders
 * `next` and `finish` in the same place in the same flex row, so a click
 * dispatched while React is still re-rendering can land on the button that
 * replaced the one Playwright resolved — which submitted the form three steps
 * early, left the submit button disabled, and produced a timeout on a flow
 * that had in fact already succeeded. One assertion per step removes the race
 * instead of papering over it.
 */
async function next(page: Page, l: Labels, expected: number): Promise<void> {
  await page.getByRole('button', { name: l.next }).click();
  await expect(page.getByText(l.step(expected))).toBeVisible();
}

/**
 * The strings the tests drive the UI by, in both locales.
 *
 * Read from the catalogues would be circular — a test that reads its
 * expectations from the file under test asserts nothing. These are written out,
 * so a changed Hebrew imperative fails a test and gets looked at.
 */
interface Labels {
  email: string;
  /** "Step 2 of 4", the wizard's own progress line. */
  step: (current: number) => string;
  password: string;
  signIn: string;
  signUp: string;
  next: string;
  finish: string;
  householdName: string;
  lmpDate: string;
  markDone: string;
  /**
   * The same key in the neutral plural — what a member who has not chosen a
   * gender form sees. A parent who joined by invite never walked the wizard, so
   * this is the form on their screen while their partner reads `סמני`.
   */
  markDoneNeutral: string;
  undo: string;
  gender: Record<GenderChoice, string>;
}

export const labels: Record<TestLocale, Labels> = {
  he: {
    email: 'דוא״ל',
    step: (current) => `שלב ${current} מתוך 4`,
    password: 'סיסמה',
    signIn: 'היכנסו',
    signUp: 'פתחו חשבון',
    // The wizard's buttons follow the gender form chosen on step 1, so these
    // are the feminine forms the fixture picks by default.
    next: 'המשיכי',
    finish: 'סיימי',
    householdName: 'שם הבית',
    lmpDate: 'היום הראשון של הווסת האחרונה',
    markDone: 'סמני כבוצע',
    markDoneNeutral: 'סמנו כבוצע',
    undo: 'בטלי',
    gender: {
      feminine: 'בלשון נקבה',
      masculine: 'בלשון זכר',
      neutral: 'בלשון רבים',
    },
  },
  en: {
    email: 'Email',
    step: (current) => `Step ${current} of 4`,
    password: 'Password',
    signIn: 'Sign in',
    signUp: 'Create account',
    next: 'Next',
    finish: 'Finish',
    householdName: 'Household name',
    lmpDate: 'First day of the last period',
    markDone: 'Mark as done',
    // English has no gendered imperative, so there is one form of it.
    markDoneNeutral: 'Mark as done',
    undo: 'Undo',
    gender: {
      feminine: 'Feminine',
      masculine: 'Masculine',
      neutral: 'Plural (neutral)',
    },
  },
};
