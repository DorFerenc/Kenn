/**
 * Serves the service worker at `/serwist/sw.js`.
 *
 * `@serwist/turbopack` bundles `worker/sw.ts` with esbuild inside this Route
 * Handler at build time and prerenders the result, which is how a service
 * worker gets built on Next.js 16 without the webpack plugin Next.js 16 refuses
 * (ADR-0004, roadmap step 6's named risk).
 *
 * The offline pages are precached on install, with a revision that changes on
 * every deploy, so a new build replaces them rather than serving last month's.
 */

import { createSerwistRoute } from '@serwist/turbopack';

const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: 'worker/sw.ts',
    useNativeEsbuild: true,
    // No source map: one more public file, and nothing for a phone to use.
    esbuildOptions: { sourcemap: false },
    additionalPrecacheEntries: [
      { url: '/he/offline', revision },
      { url: '/en/offline', revision },
    ],
  });
