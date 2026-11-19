'use client';

/**
 * Registers the service worker built at `/serwist/sw.js` (step 6a).
 *
 * Production only: under `next dev` a worker would serve yesterday's chunks
 * and make every change look broken. `cacheOnNavigation` is off because it
 * asks the worker to cache each page the visitor opens, and those pages are
 * the household's — the worker caches nothing a family owns.
 */

import { SerwistProvider } from '@serwist/turbopack/react';
import type { ReactNode } from 'react';

export function ServiceWorker({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV !== 'production'}
      cacheOnNavigation={false}
    >
      {children}
    </SerwistProvider>
  );
}
