/**
 * Locale-aware display of a date the engine computed.
 *
 * The boundary matters and is easy to blur, so it is stated here: @kenn/engine
 * *computes* dates and @kenn/ui *renders* them. This module does no arithmetic
 * — it adds no days, shifts nothing, and never reads a clock. It takes an ISO
 * date string the engine produced and turns it into the string a parent reads.
 *
 * It still pins UTC everywhere, for the reason packages/engine/CLAUDE.md gives:
 * a `Date` carries an hour and an offset, and both produce off-by-one days west
 * of Greenwich. `formatIsoDate('2027-03-14', 'en')` must say March 14 in Los
 * Angeles too. The suite proves it:
 *
 *   TZ=America/Los_Angeles pnpm test
 */

import { assertIsoDate, type IsoDate } from '@kenn/engine';
import { type Locale } from './locales.ts';

/**
 * Hebrew is rendered from the ISO parts rather than through `Intl`.
 *
 * docs/plan.md fixes the Hebrew form as `14/03/2027`, and ICU has used both
 * `14.3.2027` and `14/03/2027` for `he-IL` across versions. Slicing the string
 * makes the contract independent of the ICU build Node happens to ship.
 */
function hebrewNumeric(iso: IsoDate): string {
  const [year, month, day] = iso.split('-') as [string, string, string];
  return `${day}/${month}/${year}`;
}

/**
 * English goes through `Intl`, because `March` is ICU's to know, with the time
 * zone pinned to UTC so the ISO date cannot shift a day.
 */
const english = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

const FORMATTERS: Record<Locale, (iso: IsoDate) => string> = {
  he: hebrewNumeric,
  en: (iso) => english.format(new Date(`${iso}T00:00:00Z`)),
};

/**
 * Render an engine date for a reader: `14/03/2027` in Hebrew, `March 14, 2027`
 * in English.
 *
 * Throws on anything that is not a `YYYY-MM-DD` string, including a `Date` and
 * an ISO timestamp with a time — carrying a time this far is the bug, so it
 * fails loudly rather than rendering a plausible wrong day.
 */
export function formatIsoDate(iso: unknown, locale: Locale): string {
  return FORMATTERS[locale](assertIsoDate(iso, 'date to format'));
}

/**
 * Israeli clock date, for rendering a `timestamptz`.
 *
 * `task_state.acted_at` is an instant, not a date, and the day it fell on
 * depends on where you stand: 23:30 in Jerusalem is the previous day in UTC.
 * Slicing the ISO string — the obvious thing, and what this function exists to
 * stop — therefore shows "ticked yesterday" for anything done late in the
 * evening. The zone is Asia/Jerusalem for the same reason the app's clock is:
 * both parents plan against Israeli clinic hours.
 *
 * It is rendering, not arithmetic: no days are added and no window moves. The
 * boundary this file opens with still holds.
 */
const israeliDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatTimestampDate(timestamp: string, locale: Locale): string {
  const instant = new Date(timestamp);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`formatTimestampDate: not a timestamp: ${timestamp}`);
  }
  return formatIsoDate(israeliDay.format(instant), locale);
}
