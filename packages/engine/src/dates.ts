/**
 * Date arithmetic for the engine.
 *
 * Everything is an ISO date string, `YYYY-MM-DD`, and every calculation goes
 * through UTC. There is no `Date` with a time anywhere in this package, and no
 * local-timezone call: a `Date` carries an hour and an offset, and both produce
 * off-by-one days west of Greenwich. A window that opens a day early is a test
 * window missed.
 *
 * Run the suite under a non-UTC timezone before believing it:
 *   TZ=America/Los_Angeles pnpm test
 */

/** An ISO calendar date with no time and no zone: `YYYY-MM-DD`. */
export type IsoDate = string;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const m = ISO.exec(value);
  if (!m) return false;
  // Reject 2027-02-30: round-trip through UTC and require the same string back.
  const [, y, mo, d] = m;
  const t = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  return toIsoDate(t) === value;
}

export function assertIsoDate(value: unknown, what = 'date'): IsoDate {
  if (!isIsoDate(value)) {
    throw new TypeError(
      `${what} must be an ISO date string (YYYY-MM-DD), got ${String(value)}`,
    );
  }
  return value;
}

function toIsoDate(epochMs: number): IsoDate {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function toEpochUtc(date: IsoDate): number {
  const m = ISO.exec(date);
  if (!m) throw new TypeError(`not an ISO date: ${date}`);
  const [, y, mo, d] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d));
}

const DAY_MS = 86_400_000;

export function addDays(date: IsoDate, days: number): IsoDate {
  assertIsoDate(date);
  if (!Number.isInteger(days))
    throw new TypeError(`days must be an integer, got ${days}`);
  return toIsoDate(toEpochUtc(date) + days * DAY_MS);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round(
    (toEpochUtc(assertIsoDate(to)) - toEpochUtc(assertIsoDate(from))) / DAY_MS,
  );
}

/** 0 = Sunday … 6 = Saturday, in UTC. */
export function dayOfWeek(date: IsoDate): number {
  return new Date(toEpochUtc(assertIsoDate(date))).getUTCDay();
}

/** Saturday. Clinics and Tipat Halav are closed, so a due date here is useless. */
export function isShabbat(date: IsoDate): boolean {
  return dayOfWeek(date) === 6;
}

/** Friday: clinics close early, so it is a poor last day for an appointment. */
export function isFriday(date: IsoDate): boolean {
  return dayOfWeek(date) === 5;
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return diffDays(a, b) >= 0 ? a : b;
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return diffDays(a, b) >= 0 ? b : a;
}

/** Gestational age the way clinicians write it: `{ weeks: 36, days: 2 }`. */
export function gestationalAge(
  lmp: IsoDate,
  on: IsoDate,
): { weeks: number; days: number } {
  const total = diffDays(lmp, on);
  if (total < 0) return { weeks: 0, days: 0 };
  return { weeks: Math.floor(total / 7), days: total % 7 };
}

export function formatGestation(ga: { weeks: number; days: number }): string {
  return `${ga.weeks}+${ga.days}`;
}
