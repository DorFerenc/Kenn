/// <reference lib="webworker" />
/**
 * Kenn's service worker (roadmap step 6a).
 *
 * Built by `@serwist/turbopack` through the route at `app/serwist/[path]`, with
 * esbuild, at `next build` — so there is no webpack config anywhere, which
 * Next.js 16 would refuse (ADR-0004).
 *
 * **What it caches is the whole design, and it is deliberately little:**
 *
 *   - the build's own static assets (scripts, styles, the self-hosted font),
 *     which carry no household data and are content-hashed;
 *   - the two offline pages, which are public and say nothing about anyone.
 *
 * **What it never caches is any page or response with a household in it.**
 * Every navigation goes to the network and nowhere else; when the network is
 * gone, the visitor sees the offline page in their language rather than a
 * stale Today. Health data at rest on a phone is a decision step 7 makes, item
 * by item, for the emergency card — not a side effect of a caching default.
 * That is also why `@serwist/turbopack/worker`'s `defaultCache` is not used:
 * it caches HTML and RSC payloads, which here means the checklist.
 */

import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

/** `/en/...` reads English; everything else falls back to the default locale. */
function offlinePageFor(url: string): string {
  // A whole segment: `/entry` is not English.
  return /^\/en(\/|$)/.test(new URL(url).pathname) ? '/en/offline' : '/he/offline';
}

const serwist = new Serwist({
  // Injected at build; empty under `next dev`, where nothing is precached.
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      // Every page, always from the network. The handler exists so that the
      // fallback below has a route to fall back from.
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: '/he/offline',
        matcher: ({ request }) =>
          request.destination === 'document' &&
          offlinePageFor(request.url) === '/he/offline',
      },
      {
        url: '/en/offline',
        matcher: ({ request }) =>
          request.destination === 'document' &&
          offlinePageFor(request.url) === '/en/offline',
      },
    ],
  },
});

serwist.addEventListeners();
