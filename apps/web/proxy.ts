/**
 * Locale negotiation. Next.js 16 renamed `middleware.ts` to `proxy.ts`; the
 * handler is next-intl's, unchanged.
 */

import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing.ts';

export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next's own assets, and any path with a file
  // extension. The exclusions are segment-anchored: a bare `api` would also
  // exclude a future `/apiary`, which would silently lose locale handling.
  // `/mcp`, `/oauth` and `/ics` live under `app/api/`, so they are covered and
  // next-intl will not try to redirect the MCP endpoint to /he/api/mcp.
  matcher: ['/((?!api/|api$|_next/|_vercel/|.*\\..*).*)'],
};
