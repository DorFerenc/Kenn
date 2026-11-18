'use client';

/**
 * The other parent's screen, updating without a reload.
 *
 * This is the only client-side database access in the app, and it is in
 * `lib/services` for the reason hard rule 1 gives: a `postgres_changes`
 * subscription is database access. What authorises it is the RLS policy on
 * `task_state`, not the filter below — a browser can ask for any filter it
 * likes, and Postgres still decides which rows it is allowed to be told about.
 * The filter is there to avoid waking a tab for a change it cannot see.
 *
 * What arrives is a notification, not data: the callback re-renders the server
 * component, which re-reads through the service layer with the viewer's own
 * JWT. So the payload is never trusted and never displayed.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { browserDb } from './browser-client.ts';

export function subscribeToTasks(householdId: string, onChange: () => void): () => void {
  const db = browserDb();
  let channel: RealtimeChannel | undefined;
  let cancelled = false;

  void (async () => {
    // Hand the socket the session's access token before subscribing.
    //
    // Without this the channel connects as the anonymous role, RLS on
    // `task_state` correctly tells it nothing, and the subscription succeeds
    // while delivering no events — the quietest possible failure, and one that
    // looks exactly like an app where the other parent simply has not done
    // anything yet. The browser client reads the session from cookies
    // asynchronously, so the token is not there at the moment a component
    // mounts.
    const { data } = await db.auth.getSession();
    const token = data.session?.access_token;
    if (token) await db.realtime.setAuth(token);
    if (cancelled) return;

    channel = db
      .channel(`task_state:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_state',
          filter: `household_id=eq.${householdId}`,
        },
        () => onChange(),
      )
      .subscribe();
  })();

  return () => {
    cancelled = true;
    if (channel) void db.removeChannel(channel);
  };
}
