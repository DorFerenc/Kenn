import { describe, expect, it } from 'vitest';
import { escapeText, foldLine, toIcs, utcStamp, type CalendarEvent } from './ics.ts';

const bytes = (s: string) => new TextEncoder().encode(s).length;

const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  uid: 'preg.nt-scan-abc123@kenn',
  start: '2027-01-10',
  end: '2027-01-24',
  title: 'NT scan',
  remind: true,
  ...overrides,
});

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and newline', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });

  it('escapes the backslash first, so an escape is not escaped twice', () => {
    expect(escapeText(';')).toBe('\\;');
  });
});

describe('foldLine', () => {
  it('leaves a short line alone', () => {
    expect(foldLine('SUMMARY:NT scan')).toBe('SUMMARY:NT scan');
  });

  it('keeps every physical line within 75 octets for ASCII', () => {
    const folded = foldLine(`DESCRIPTION:${'x'.repeat(300)}`);
    for (const line of folded.split('\r\n')) expect(bytes(line)).toBeLessThanOrEqual(75);
  });

  it('counts octets, not characters, so Hebrew folds early enough', () => {
    const folded = foldLine(`SUMMARY:${'בדיקת שקיפות עורפית '.repeat(10)}`);
    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(3);
    for (const line of lines) expect(bytes(line)).toBeLessThanOrEqual(75);
  });

  it('never cuts a multi-byte letter in half', () => {
    const original = `SUMMARY:${'ש'.repeat(200)}`;
    const folded = foldLine(original);
    // Unfolding (§3.1) is removing every CRLF followed by one space.
    expect(folded.replaceAll('\r\n ', '')).toBe(original);
    expect(folded).not.toContain('�');
  });

  it('starts each continuation with exactly one space', () => {
    const lines = foldLine(`X:${'y'.repeat(200)}`).split('\r\n');
    for (const line of lines.slice(1)) expect(line).toMatch(/^ [^ ]/);
  });
});

describe('utcStamp', () => {
  it('writes the UTC date-time form RFC 5545 requires for DTSTAMP', () => {
    expect(utcStamp('2026-11-19T05:10:00.123Z')).toBe('20261119T051000Z');
    expect(utcStamp('2026-11-19T05:10:00Z')).toBe('20261119T051000Z');
  });

  it('refuses a timestamp that is not UTC, rather than mislabelling it', () => {
    expect(() => utcStamp('2026-11-19T05:10:00+02:00')).toThrow();
  });
});

describe('toIcs', () => {
  const ics = toIcs({
    name: 'Kenn',
    stamp: '2026-11-18T07:30:15.123Z',
    events: [event()],
  });

  it('uses CRLF line endings throughout', () => {
    expect(ics.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  it('writes an all-day event whose exclusive end is the day after the last day', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20270110');
    expect(ics).toContain('DTEND;VALUE=DATE:20270125');
  });

  it('stamps every event with the instant of the fetch, in UTC', () => {
    expect(ics).toContain('DTSTAMP:20261118T073015Z');
  });

  it('carries the UID it was given, so a refresh updates instead of duplicating', () => {
    expect(ics).toContain('UID:preg.nt-scan-abc123@kenn');
    const again = toIcs({
      name: 'Kenn',
      stamp: '2026-11-19T07:30:15.123Z',
      events: [event()],
    });
    expect(again.match(/UID:.*/)?.[0]).toBe(ics.match(/UID:.*/)?.[0]);
  });

  it('reminds on the opening morning and three days before the close', () => {
    expect(ics).toContain('TRIGGER;RELATED=START:PT9H');
    expect(ics).toContain('TRIGGER;RELATED=END:-P3DT15H');
  });

  // The closing alarm fires at 09:00 three days before the last day, so it is
  // only distinct from the opening alarm when that day is after the first.
  // Asserted at the boundary, not in the middle of the range.
  it.each([
    ['2027-01-12', false],
    ['2027-01-13', false],
    ['2027-01-14', true],
  ])('a window from 2027-01-10 to %s has a closing reminder: %s', (end, expected) => {
    const ics = toIcs({
      name: 'Kenn',
      stamp: '2026-11-18T07:30:15.123Z',
      events: [event({ start: '2027-01-10', end })],
    });
    expect(ics).toContain('RELATED=START');
    expect(ics.includes('RELATED=END')).toBe(expected);
  });

  it('writes no alarm at all when told not to remind', () => {
    const quiet = toIcs({
      name: 'Kenn',
      stamp: '2026-11-18T07:30:15.123Z',
      events: [event({ remind: false })],
    });
    expect(quiet).not.toContain('VALARM');
  });

  it('balances every BEGIN with an END', () => {
    const begins = ics.match(/^BEGIN:/gm)?.length;
    const ends = ics.match(/^END:/gm)?.length;
    expect(begins).toBe(ends);
  });

  it('writes an empty but valid calendar when nothing is due', () => {
    const empty = toIcs({ name: 'Kenn', stamp: '2026-11-18T07:30:15.123Z', events: [] });
    expect(empty).toContain('BEGIN:VCALENDAR');
    expect(empty).not.toContain('VEVENT');
  });
});
