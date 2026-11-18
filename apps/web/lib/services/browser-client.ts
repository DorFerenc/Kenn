/**
 * The browser's Supabase client, which exists for exactly one reason: the
 * realtime subscription in `realtime.ts`.
 *
 * It lives inside `lib/services` because a `postgres_changes` subscription *is*
 * database access, and hard rule 1 says one directory owns that. The key it
 * carries is the publishable one, and the subscription is authorised by the RLS
 * policy on `task_state` — not by the channel name the client asks for, which a
 * browser could name anything it liked.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@kenn/db';
import { supabaseEnv } from './env.ts';

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** One client per tab: a second one opens a second websocket. */
export function browserDb() {
  if (!client) {
    const { url, publishableKey } = supabaseEnv();
    client = createBrowserClient<Database>(url, publishableKey);
  }
  return client;
}
