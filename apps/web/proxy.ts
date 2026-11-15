/**
 * Locale negotiation, and the one place in a request that can refresh a
 * session.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. The locale handler is
 * next-intl's, unchanged; what step 5a added is the Supabase session refresh,
 * which has to happen here because a Server Component can read cookies but not
 * write them — so an expired access token can only be exchanged on the way in.
 *
 * The Supabase client itself is built inside `lib/services`, per hard rule 1:
 * the boundary is the directory, not the kind of file, and a proxy holding a
 * database client is exactly the hole that rule exists to close.
 */

import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { refreshSession } from './lib/services/auth.ts';
import { routing } from './i18n/routing.ts';

const handleLocale = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = handleLocale(request);

  await refreshSession({
    getAll: () => request.cookies.getAll(),
    set: (name, value, options) => {
      request.cookies.set(name, value);
      response.cookies.set(name, value, options);
    },
  });

  return response;
}

export const config = {
  // Everything except API routes, Next's own assets, and any path with a file
  // extension. The exclusions are segment-anchored: a bare `api` would also
  // exclude a future `/apiary`, which would silently lose locale handling.
  // `/mcp`, `/oauth` and `/ics` live under `app/api/`, so they are covered and
  // next-intl will not try to redirect the MCP endpoint to /he/api/mcp.
  matcher: ['/((?!api/|api$|_next/|_vercel/|.*\\..*).*)'],
};
