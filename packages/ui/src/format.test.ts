/**
 * Run this suite outside UTC before believing it:
 *
 *   TZ=America/Los_Angeles pnpm test
 *
 * Every assertion here is about a date that must not move. Los Angeles is
 * eight hours behind, so a formatter that lets a `Date` touch local time
 * renders 13 March for 14 March and the test says so.
 */

import { describe, expect, it } from 'vitest';
import { formatIsoDate } from './format.ts';

describe('formatIsoDate', () => {
  it('renders Hebrew as 14/03/2027', () => {
    expect(formatIsoDate('2027-03-14', 'he')).toBe('14/03/2027');
  });

  it('renders English as March 14, 2027', () => {
    expect(formatIsoDate('2027-03-14', 'en')).toBe('March 14, 2027');
  });

  it('keeps the leading zero in Hebrew, which English drops', () => {
    expect(formatIsoDate('2027-01-05', 'he')).toBe('05/01/2027');
    expect(formatIsoDate('2027-01-05', 'en')).toBe('January 5, 2027');
  });

  it.each([
    ['2027-01-01', '01/01/2027', 'January 1, 2027'],
    ['2027-12-31', '31/12/2027', 'December 31, 2027'],
    ['2028-02-29', '29/02/2028', 'February 29, 2028'],
  ])('does not shift %s in any timezone', (iso, hebrew, english) => {
    // The year boundaries and a leap day: the three dates a local-time bug
    // moves most visibly.
    expect(formatIsoDate(iso, 'he')).toBe(hebrew);
    expect(formatIsoDate(iso, 'en')).toBe(english);
  });

  it.each([
    '2027-03-14T00:00:00Z',
    '2027-03-14T22:00:00+02:00',
    '14/03/2027',
    '2027-3-14',
    '2027-02-30',
    '',
  ])('refuses %s rather than rendering a plausible wrong day', (bad) => {
    expect(() => formatIsoDate(bad, 'he')).toThrow(TypeError);
  });

  it('refuses a Date object', () => {
    expect(() => formatIsoDate(new Date('2027-03-14'), 'en')).toThrow(TypeError);
  });
});
