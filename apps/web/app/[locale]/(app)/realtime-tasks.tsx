'use client';

/**
 * The other parent ticks something; this screen notices.
 *
 * It renders nothing. On a change to `task_state` in this household it calls
 * `router.refresh()`, which re-runs the Server Component — so the new state is
 * re-read through the service layer with this viewer's own JWT, and the
 * payload the websocket delivered is never displayed or trusted.
 */

import { subscribeToTasks } from '@/lib/services/realtime.ts';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function RealtimeTasks({ householdId }: { householdId: string }) {
  const router = useRouter();

  useEffect(
    () => subscribeToTasks(householdId, () => router.refresh()),
    [householdId, router],
  );

  return null;
}
