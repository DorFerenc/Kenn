/**
 * The open-redirect guard, with the attacks planted.
 *
 * A regex that merely accepts the happy path is not a guard, so what is written
 * down here is what it has to refuse.
 */

import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next.ts';

describe('safeNext', () => {
  it('keeps a path inside the app', () => {
    expect(safeNext('/he/today', 'he')).toBe('/he/today');
    expect(safeNext('/he/join/' + 'a'.repeat(64), 'he')).toBe(
      '/he/join/' + 'a'.repeat(64),
    );
  });

  it('refuses an absolute URL', () => {
    expect(safeNext('https://kenn-app.example/he/sign-in', 'he')).toBe('/he');
    expect(safeNext('http://evil.example', 'en')).toBe('/en');
  });

  it('refuses a protocol-relative URL, which a browser treats as absolute', () => {
    expect(safeNext('//evil.example', 'he')).toBe('/he');
    expect(safeNext('/\\evil.example', 'he')).toBe('/he');
  });

  it('refuses anything that is not a path at all', () => {
    for (const hostile of [
      'javascript:alert(1)',
      'he/today',
      '',
      '   ',
      '/../../etc/passwd',
      'data:text/html,<script>',
    ]) {
      expect(safeNext(hostile, 'he')).toBe('/he');
    }
  });

  it('falls back to the locale root for a missing value', () => {
    expect(safeNext(undefined, 'he')).toBe('/he');
    expect(safeNext(null, 'en')).toBe('/en');
  });
});
