/**
 * The request-scoped Supabase client: the signed-in user's JWT, nothing more.
 *
 * Hard rule 1 in CLAUDE.md in one file. Every read and write in the app goes
 * through a client built here, carrying the cookies of the person who made the
 * request — so RLS is what decides what they can see, and it guards an MCP
 * client or the coach exactly as it guards a parent. There is no second client
 * with wider powers anywhere in `apps/web`, and that is the property to protect
 * when editing this file.
 *
 * `createServerClient` needs to write cookies when it refreshes a session. A
 * Server Component cannot set a cookie, and Next.js throws if it tries, so the
 * write is swallowed there: `proxy.ts` refreshes the session on the way in,
 * which is the one place in a request that can.
 */

import { createServerClient } from '@supabase/ssr';
import type { Database } from '@kenn/db';
import { cookies } from 'next/headers';
import { supabaseEnv } from './env.ts';

export type Db = ReturnType<typeof createServerClient<Database>>;

export async function serverDb(): Promise<Db> {
  const { url, publishableKey } = supabaseEnv();
  const store = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            store.set(name, value, options);
          }
        } catch {
          // A Server Component rendering: cookies are already sent. The refresh
          // that matters happened in proxy.ts on the way in.
        }
      },
    },
  });
}
