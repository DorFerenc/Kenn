/**
 * An iCalendar (RFC 5545) writer for all-day windows. Pure: no clock, no I/O.
 *
 * Small enough to own rather than import — the `ics` package pulls a schema
 * validator in at runtime to write what is, for Kenn, one shape of event — and
 * the parts that are easy to get wrong are each pinned by a test:
 *
 *   - **Folding is by octets, not characters** (§3.1). A Hebrew letter is two
 *     bytes in UTF-8, so a fold at 75 characters produces 150-byte lines, and a
 *     naive fold at 75 bytes can cut a letter in half. Both corrupt the title.
 *   - **An all-day DTEND is exclusive** (§3.6.1). A window that closes on the
 *     14th ends on the 15th, or every calendar shows it a day short — which for
 *     a test window is the one error that matters.
 *   - **TEXT escapes** backslash, semicolon, comma and newline (§3.3.11).
 *   - **UIDs are stable**, so a refresh updates an event rather than adding a
 *     second copy of it.
 */

import { addDays, type IsoDate } from '@kenn/engine';

export interface CalendarEvent {
  /** Stable across refreshes: the same window must keep the same UID. */
  uid: string;
  /** First day of the window. */
  start: IsoDate;
  /** Last day of the window, inclusive — as the engine and the screens say it. */
  end: IsoDate;
  title: string;
  description?: string;
  url?: string;
  /** 09:00 on the day it opens, and 09:00 three days before it closes. */
  remind: boolean;
}

export interface Calendar {
  name: string;
  /** The instant the feed was generated, as a UTC ISO timestamp. DTSTAMP is
   *  required on every event, and is a date-time, not a date. */
  stamp: string;
  events: CalendarEvent[];
}

const CRLF = '\r\n';
const FOLD_AT = 75;

export function escapeText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Split a content line into lines of at most 75 octets, never inside a
 * character. Continuation lines start with one space, which counts toward
 * their 75.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;

  // Iterating a string yields code points, so a surrogate pair stays whole.
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > FOLD_AT) {
      out.push(current);
      current = ' ';
      bytes = 1;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join(CRLF);
}

const compact = (date: IsoDate) => date.replaceAll('-', '');

/** `2026-11-19T05:10:00.123Z` → `20261119T051000Z` (RFC 5545 §3.3.5, UTC form). */
export function utcStamp(timestamp: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/.exec(
    timestamp,
  );
  if (!match) throw new Error(`utcStamp: not a UTC ISO timestamp: ${timestamp}`);
  const [, y, mo, d, h, mi, se] = match;
  return `${y}${mo}${d}T${h}${mi}${se}Z`;
}

function eventLines(event: CalendarEvent, stamp: string): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(stamp)}`,
    `DTSTART;VALUE=DATE:${compact(event.start)}`,
    `DTEND;VALUE=DATE:${compact(addDays(event.end, 1))}`,
    `SUMMARY:${escapeText(event.title)}`,
    // An all-day window should not mark anyone busy.
    'TRANSP:TRANSPARENT',
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.url) lines.push(`URL:${event.url}`);

  if (event.remind) {
    // RELATED=START is 00:00 on the first day, so +9h is 09:00 that morning.
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(event.title)}`,
      'TRIGGER;RELATED=START:PT9H',
      'END:VALARM',
    );
    // RELATED=END is 00:00 the day after the last day (DTEND is exclusive),
    // so -3 days -15 hours is 09:00 three days before the window closes.
    // Only when that falls after the window opened.
    if (addDays(event.end, -3) > event.start) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(event.title)}`,
        'TRIGGER;RELATED=END:-P3DT15H',
        'END:VALARM',
      );
    }
  }

  lines.push('END:VEVENT');
  return lines;
}

export function toIcs(calendar: Calendar): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kenn//Calendar feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    // How often a subscribing calendar should come back. Google decides for
    // itself, Apple and Outlook read these.
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    ...calendar.events.flatMap((event) => eventLines(event, calendar.stamp)),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
