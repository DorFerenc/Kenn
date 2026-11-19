/**
 * The only place in `apps/web` that reads a clock.
 *
 * @kenn/engine refuses to read one at all: `today` is a parameter everywhere,
 * so the same inputs always give the same windows and a test can stand in any
 * week of the pregnancy. Something still has to know what day it is, and this
 * is it — `pnpm test` asserts that nothing else in the app constructs a `Date`,
 * calls `Date.now()`, or multiplies its way to a day in milliseconds.
 *
 * Asia/Jerusalem, fixed, not the browser's zone. Both parents plan against
 * Israeli clinic hours, and a phone still set to another zone must not move a
 * window by a day. Same reasoning as the `timeZone` in i18n/request.ts.
 */

import { assertIsoDate, type IsoDate } from '@kenn/engine';

const ISRAEL = 'Asia/Jerusalem';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * `en-CA` because it formats as `YYYY-MM-DD`, which is the shape the engine
 * demands — and `assertIsoDate` fails loudly rather than trusting the ICU build
 * Node happens to ship.
 */
const israeliDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: ISRAEL,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Israel. The engine's `today` argument comes from here. */
export function todayInIsrael(now: Date = new Date()): IsoDate {
  return assertIsoDate(israeliDate.format(now), 'today');
}

/**
 * An instant, for a `timestamptz` column: when a task was ticked, when a row
 * was last written. A moment in time, not a date — no zone is involved, and
 * none should be, because `acted_at` is an instant and the day it falls on is
 * a rendering question.
 */
export function nowTimestamp(): string {
  return new Date().toISOString();
}

/** Whether an instant (an ISO timestamp from Postgres) is already behind us. */
export function hasPassed(timestamp: string): boolean {
  return Date.parse(timestamp) <= Date.now();
}

/** An instant `days` from now, for an invite's expiry. */
export function timestampInDays(days: number): string {
  return new Date(Date.now() + days * MILLISECONDS_PER_DAY).toISOString();
}
