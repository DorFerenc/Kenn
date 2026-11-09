/**
 * Locale negotiation. Next.js 16 renamed `middleware.ts` to `proxy.ts`; the
 * handler is next-intl's, unchanged.
 */

import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing.ts';

export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next's own assets, and any path with a file
  // extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
