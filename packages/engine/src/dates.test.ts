import { describe, expect, it } from 'vitest';
import {
  addDays,
  assertIsoDate,
  dayOfWeek,
  diffDays,
  formatGestation,
  gestationalAge,
  isIsoDate,
  isShabbat,
} from './dates.ts';

describe('ISO date handling', () => {
  it('accepts a real date and rejects an impossible one', () => {
    expect(isIsoDate('2027-02-28')).toBe(true);
    expect(isIsoDate('2027-02-30')).toBe(false); // February has no 30th
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2027-3-1')).toBe(false); // must be zero-padded
    expect(isIsoDate('2027-03-01T00:00:00Z')).toBe(false); // no times, ever
    expect(isIsoDate(new Date())).toBe(false);
  });

  it('accepts a leap day in a leap year and rejects it otherwise', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
  });

  it('throws with a useful message on a bad date', () => {
    expect(() => assertIsoDate('yesterday', 'lmp')).toThrow(
      /lmp must be an ISO date string/,
    );
  });
});

describe('arithmetic is timezone-proof', () => {
  // This suite is run under TZ=America/Los_Angeles in CI. Every one of these
  // would be off by a day if the engine touched local time.
  it('adds and subtracts days across a month boundary', () => {
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });

  it('adds across a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('adds across a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('survives a DST transition, which is the classic off-by-one', () => {
    // Israel moves its clocks on the last Friday of March; the US in mid-March.
    expect(addDays('2027-03-25', 3)).toBe('2027-03-28');
    expect(diffDays('2027-03-25', '2027-03-28')).toBe(3);
    expect(addDays('2027-03-13', 1)).toBe('2027-03-14');
  });

  it('counts days in both directions', () => {
    expect(diffDays('2026-06-08', '2027-03-15')).toBe(280);
    expect(diffDays('2027-03-15', '2026-06-08')).toBe(-280);
    expect(diffDays('2027-03-15', '2027-03-15')).toBe(0);
  });

  it('refuses a fractional number of days', () => {
    expect(() => addDays('2027-01-01', 1.5)).toThrow(/integer/);
  });
});

describe('weekdays', () => {
  it('knows which day of the week a date is, in UTC', () => {
    expect(dayOfWeek('2027-03-15')).toBe(1); // Monday
    expect(dayOfWeek('2027-02-27')).toBe(6); // Saturday
  });

  it('identifies Shabbat', () => {
    expect(isShabbat('2027-02-27')).toBe(true);
    expect(isShabbat('2027-02-28')).toBe(false);
  });
});

describe('gestational age', () => {
  it('reads as clinicians write it', () => {
    const lmp = '2026-06-08';
    expect(gestationalAge(lmp, '2027-02-15')).toEqual({ weeks: 36, days: 0 });
    expect(gestationalAge(lmp, '2027-02-28')).toEqual({ weeks: 37, days: 6 });
    expect(formatGestation(gestationalAge(lmp, '2026-08-24'))).toBe('11+0');
    expect(formatGestation(gestationalAge(lmp, '2026-09-13'))).toBe('13+6');
  });

  it('clamps before the LMP rather than reporting a negative week', () => {
    expect(gestationalAge('2026-06-08', '2026-06-01')).toEqual({ weeks: 0, days: 0 });
  });
});
