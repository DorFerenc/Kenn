/**
 * The gate's own test, with the violation planted.
 *
 * Step 2's review found four gates that would have passed if deleted, because
 * each one ended in `expect(offenders).toEqual([])` over a repository that
 * contained no offender. Verifying by hand does not survive the session it
 * happened in, so the offending manifest is written down here.
 */

import { describe, expect, it } from 'vitest';
import { offendingRoutes, prerenderedRoutes } from './check-prerender.mjs';

describe('check:prerender', () => {
  it('passes on the manifest a correct build produces', () => {
    const manifest = {
      routes: { '/_global-error': {}, '/_not-found': {} },
      dynamicRoutes: {},
      notFoundRoutes: [],
    };
    expect(offendingRoutes(manifest)).toEqual([]);
  });

  it('catches a prerendered Today page', () => {
    const manifest = { routes: { '/he': {}, '/he/today': {} } };
    expect(offendingRoutes(manifest)).toEqual(['/he/today']);
  });

  it('catches a household route in every list the manifest keeps', () => {
    const manifest = {
      routes: { '/en/checklist': {} },
      dynamicRoutes: { '/he/join/[token]': {} },
      notFoundRoutes: ['/he/household'],
    };
    expect(offendingRoutes(manifest).sort()).toEqual([
      '/en/checklist',
      '/he/household',
      '/he/join/[token]',
    ]);
  });

  it('does not fire on a public route that merely contains the word', () => {
    // `/he/todayish` is not `/he/today`: the check is per segment, not a
    // substring match, or a future public page could never be named.
    const manifest = { routes: { '/he': {}, '/he/todayish': {} } };
    expect(offendingRoutes(manifest)).toEqual([]);
  });

  it('reads all three lists', () => {
    expect(
      prerenderedRoutes({
        routes: { '/a': {} },
        dynamicRoutes: { '/b': {} },
        notFoundRoutes: ['/c'],
      }),
    ).toEqual(['/a', '/b', '/c']);
  });
});
