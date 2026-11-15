/**
 * The clock, and the rule that there is only one of it.
 *
 * Two different gates live here. The first asserts this module is right west
 * and east of Greenwich; the second asserts no other file in `apps/web` reads
 * a clock or multiplies its way to a day, which is the kind of rule that holds
 * exactly as long as somebody remembers it.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nowTimestamp, timestampInDays, todayInIsrael } from './today.ts';

describe('todayInIsrael', () => {
  it('is the Israeli date, not the UTC one, late in the evening', () => {
    // 21:30 UTC on 13 March is 23:30 in Jerusalem — still the 13th. An hour
    // later it is the 14th in Israel while UTC is still on the 13th, and that
    // hour is the whole reason this function exists.
    expect(todayInIsrael(new Date('2027-03-13T21:30:00Z'))).toBe('2027-03-13');
    expect(todayInIsrael(new Date('2027-03-13T22:30:00Z'))).toBe('2027-03-14');
  });

  it('is the Israeli date even when the process runs in Los Angeles', () => {
    // The suite runs under TZ=America/Los_Angeles in CI. 08:00 UTC is midnight
    // in LA and 10:00 in Jerusalem: one date, whatever the host thinks.
    expect(todayInIsrael(new Date('2027-07-01T08:00:00Z'))).toBe('2027-07-01');
  });

  it('crosses the Israeli midnight, not the local one', () => {
    expect(todayInIsrael(new Date('2026-12-31T21:59:00Z'))).toBe('2026-12-31');
    expect(todayInIsrael(new Date('2026-12-31T22:01:00Z'))).toBe('2027-01-01');
  });

  it('returns a string the engine accepts', () => {
    expect(todayInIsrael()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('timestamps', () => {
  it('nowTimestamp is an instant, not a date', () => {
    expect(nowTimestamp()).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it('timestampInDays moves by whole days', () => {
    const from = new Date(nowTimestamp()).getTime();
    const seven = new Date(timestampInDays(7)).getTime();
    expect(Math.round((seven - from) / 86_400_000)).toBe(7);
  });
});

// ---------------------------------------------------------------- the scan

const CLOCK_PATTERNS = [
  { pattern: /new Date\(/, why: 'constructs a Date' },
  { pattern: /Date\.now\(/, why: 'reads the clock' },
  { pattern: /24 \* 60 \* 60/, why: 'computes a day in milliseconds' },
  { pattern: /86[_,]?400[_,]?000/, why: 'computes a day in milliseconds' },
];

/** The one module allowed to know what time it is, and this test. */
const ALLOWED = ['apps/web/lib/today.ts', 'apps/web/lib/today.test.ts'];

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

/** Strip comments, so prose about `new Date()` does not trip the scan. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

export function clockReaders(files: { path: string; text: string }[]) {
  const offenders: { path: string; why: string }[] = [];
  for (const { path, text } of files) {
    if (ALLOWED.includes(path.replaceAll('\\', '/'))) continue;
    const code = stripComments(text);
    for (const { pattern, why } of CLOCK_PATTERNS) {
      if (pattern.test(code)) offenders.push({ path, why });
    }
  }
  return offenders;
}

describe('only one module in apps/web reads a clock', () => {
  it('holds across the whole app', () => {
    const files = sourceFiles('apps/web').map((path) => ({
      path,
      text: readFileSync(path, 'utf8'),
    }));
    // The scan must have something to scan: a glob that matches nothing is a
    // gate that reports success forever.
    expect(files.length).toBeGreaterThan(15);
    expect(clockReaders(files)).toEqual([]);
  });

  it('catches a component that reads the clock itself', () => {
    // Planted, because a gate verified only by hand is a gate verified only
    // once. This is the real bug it exists for: a date computed in a component
    // uses the browser's zone, so a phone set to UTC shows a parent in Israel
    // the wrong day's window.
    expect(
      clockReaders([
        {
          path: 'apps/web/app/[locale]/(app)/today/page.tsx',
          text: 'const t = new Date();',
        },
      ]),
    ).toEqual([
      {
        path: 'apps/web/app/[locale]/(app)/today/page.tsx',
        why: 'constructs a Date',
      },
    ]);
  });

  it('catches a hand-rolled day of milliseconds', () => {
    expect(
      clockReaders([
        {
          path: 'apps/web/lib/services/invites.ts',
          text: 'const d = 7 * 24 * 60 * 60 * 1000;',
        },
      ]).map((o) => o.why),
    ).toEqual(['computes a day in milliseconds']);
  });

  it('does not fire on prose that merely mentions one', () => {
    expect(
      clockReaders([
        {
          path: 'apps/web/lib/services/tasks.ts',
          text: '// never call new Date() here\nexport const x = 1;',
        },
      ]),
    ).toEqual([]);
  });
});
