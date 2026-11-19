/**
 * The private calendar feed: `GET /api/ics/<token>` (roadmap step 6a).
 *
 * Fetched by Google's or Apple's servers on their own schedule, with no
 * session, so the token in the path is the whole credential (ADR-0009). Three
 * things follow:
 *
 *   - Unknown, revoked, expired and malformed tokens all get the same bare 404,
 *     so the endpoint says nothing about which tokens exist.
 *   - The body is never cached by anyone in between. It is one household's
 *     pregnancy, dated.
 *   - The date is Israel's today, from the one module allowed to read a clock.
 */

import { calendarFeedFor } from '@/lib/services/calendar.ts';
import { nowTimestamp, todayInIsrael } from '@/lib/today.ts';
import { getTranslations } from 'next-intl/server';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

const PRIVATE = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
};

function describe(error: unknown): { name: string; paths?: string[] } {
  if (error instanceof ZodError) {
    return { name: error.name, paths: error.issues.map((issue) => issue.path.join('.')) };
  }
  return { name: error instanceof Error ? error.name : typeof error };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const { origin } = new URL(request.url);

  const names = {
    he: (await getTranslations({ locale: 'he', namespace: 'calendar' }))('feedName'),
    en: (await getTranslations({ locale: 'en', namespace: 'calendar' }))('feedName'),
  };

  let body: string | null;
  try {
    body = await calendarFeedFor(
      token,
      todayInIsrael(),
      nowTimestamp(),
      origin,
      (l) => names[l],
    );
  } catch (error) {
    // Logged without values and without the token — the path holds the
    // secret — but logged: a renamed column fails the zod parse on every
    // fetch, and a permanent 503 that nobody sees is the silent failure the
    // parse exists to prevent. The name and the issue paths are enough to find
    // which column moved.
    console.error('ics feed failed', describe(error));
    // A database failure: a bare 503 with the same headers, never a framework
    // error page — the path holds the token, and the body must say nothing.
    // A calendar retries a 503 later rather than dropping the subscription.
    return new Response(null, {
      status: 503,
      headers: { ...PRIVATE, 'Retry-After': '3600' },
    });
  }
  if (body === null) return new Response(null, { status: 404, headers: PRIVATE });

  return new Response(body, {
    headers: {
      ...PRIVATE,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="kenn.ics"',
    },
  });
}
