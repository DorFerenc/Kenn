import { describe, expect, it } from 'vitest';
import { escapeText, foldLine, toIcs, type CalendarEvent } from './ics.ts';

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

describe('toIcs', () => {
  const ics = toIcs({ name: 'Kenn', stamp: '2026-11-18', events: [event()] });

  it('uses CRLF line endings throughout', () => {
    expect(ics.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/);
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  it('writes an all-day event whose exclusive end is the day after the last day', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20270110');
    expect(ics).toContain('DTEND;VALUE=DATE:20270125');
  });

  it('carries the UID it was given, so a refresh updates instead of duplicating', () => {
    expect(ics).toContain('UID:preg.nt-scan-abc123@kenn');
    const again = toIcs({ name: 'Kenn', stamp: '2026-11-19', events: [event()] });
    expect(again.match(/UID:.*/)?.[0]).toBe(ics.match(/UID:.*/)?.[0]);
  });

  it('reminds on the opening morning and three days before the close', () => {
    expect(ics).toContain('TRIGGER;RELATED=START:PT9H');
    expect(ics).toContain('TRIGGER;RELATED=END:-P3DT15H');
  });

  it('skips the closing reminder when the window is too short for it', () => {
    const short = toIcs({
      name: 'Kenn',
      stamp: '2026-11-18',
      events: [event({ start: '2027-01-10', end: '2027-01-12' })],
    });
    expect(short).toContain('RELATED=START');
    expect(short).not.toContain('RELATED=END');
  });

  it('writes no alarm at all when told not to remind', () => {
    const quiet = toIcs({
      name: 'Kenn',
      stamp: '2026-11-18',
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
    const empty = toIcs({ name: 'Kenn', stamp: '2026-11-18', events: [] });
    expect(empty).toContain('BEGIN:VCALENDAR');
    expect(empty).not.toContain('VEVENT');
  });
});
