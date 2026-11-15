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
    expect(offendingRoutes(manifest).sort()).toEqual(['/he', '/he/today']);
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

  it('catches a route the old segment list could not have known about', () => {
    // The point of inverting the check. `things` is step 8a, `coach` is step 11,
    // and neither name exists anywhere in this repository yet — under the
    // previous hand-written denylist both would have been reported clean.
    const manifest = {
      routes: { '/he/things': {}, '/en/coach': {}, '/he/settings': {} },
    };
    expect(offendingRoutes(manifest).sort()).toEqual([
      '/en/coach',
      '/he/settings',
      '/he/things',
    ]);
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
