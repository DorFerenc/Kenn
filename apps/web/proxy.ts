/**
 * Locale negotiation, the Content-Security-Policy, and the one place in a
 * request that can refresh a session.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. The locale handler is
 * next-intl's, unchanged. Step 5a added the Supabase session refresh, which
 * has to happen here because a Server Component can read cookies but not write
 * them — so an expired access token can only be exchanged on the way in.
 *
 * Step 6a added the CSP. Its nonce has to reach Next's renderer, which reads it
 * from the **request's** `Content-Security-Policy` header and stamps it on
 * every script it emits. next-intl forwards the headers of the request it is
 * given, so the policy goes onto a copy of the request before next-intl sees
 * it, and onto the response for the browser.
 *
 * The Supabase client itself is built inside `lib/services`, per hard rule 1:
 * the boundary is the directory, not the kind of file, and a proxy holding a
 * database client is exactly the hole that rule exists to close.
 */

import createMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';
import { contentSecurityPolicy, newNonce } from './lib/csp.ts';
import { refreshSession } from './lib/services/auth.ts';
import { supabaseEnv } from './lib/services/env.ts';
import { routing } from './i18n/routing.ts';

const handleLocale = createMiddleware(routing);

export default async function proxy(incoming: NextRequest) {
  const csp = contentSecurityPolicy({
    nonce: newNonce(),
    supabaseUrl: supabaseEnv().url,
    development: process.env.NODE_ENV !== 'production',
    https: incoming.nextUrl.protocol === 'https:',
  });

  const headers = new Headers(incoming.headers);
  headers.set('Content-Security-Policy', csp);
  const request = new NextRequest(incoming, { headers });

  const response = handleLocale(request);
  response.headers.set('Content-Security-Policy', csp);

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
