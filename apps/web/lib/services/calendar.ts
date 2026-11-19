/**
 * The private calendar feed (roadmap step 6a, ADR-0009).
 *
 * Two kinds of caller, and the file is split along that line:
 *
 *   - **A signed-in member** creates, lists and revokes their household's
 *     feeds, with their own JWT, like every other service call. Creating and
 *     revoking are SECURITY DEFINER functions that audit in the same
 *     transaction; this file never inserts into `calendar_feed` or `audit_log`
 *     itself, because it cannot — nobody holds that privilege.
 *   - **A calendar server** fetches the feed with no session. It gets the
 *     publishable key and the `anon` role, never the service-role key (hard
 *     rule 1), and the one thing `anon` may call is
 *     `calendar_feed_inputs(token)`. The token is the whole credential, the
 *     way an invite token is.
 *
 * The windows themselves come from `composeTasks()`, the function the
 * Checklist uses, so a calendar and the screen cannot disagree (ADR-0008).
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@kenn/db';
import type { IsoDate, Profile } from '@kenn/engine';
import type { Locale } from '@kenn/ui';
import { z } from 'zod';
import { toIcs, type CalendarEvent } from '../ics.ts';
import { assertHuman, type ServiceContext } from './context.ts';
import { supabaseEnv } from './env.ts';
import type { Pregnancy } from './pregnancy.ts';
import type { ProfileWrite } from './profile.ts';
import {
  composeTasks,
  type HouseholdInputs,
  type StoredDecision,
  type TaskDecision,
  type TaskView,
} from './tasks.ts';

export interface CalendarFeed {
  id: string;
  createdBy: string;
  locale: Locale;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

/** Mints a feed and returns its raw token, once. Rotates the caller's last one. */
export async function createCalendarFeed(
  ctx: ServiceContext,
  householdId: string,
  locale: Locale,
): Promise<string> {
  // A feed publishes household data to a third party's servers: a person's
  // decision, never an AI client's (hard rule 5).
  assertHuman(ctx, 'creating a calendar feed');

  const { data, error } = await ctx.db.rpc('create_calendar_feed', {
    p_household: householdId,
    p_locale: locale,
  });
  if (error) throw new Error(`calendar feed create failed: ${error.message}`);
  if (typeof data !== 'string') throw new Error('calendar feed create returned no token');
  return data;
}

export async function revokeCalendarFeed(
  ctx: ServiceContext,
  feedId: string,
): Promise<void> {
  assertHuman(ctx, 'revoking a calendar feed');
  const { error } = await ctx.db.rpc('revoke_calendar_feed', { p_feed: feedId });
  if (error) throw new Error(`calendar feed revoke failed: ${error.message}`);
}

export async function listCalendarFeeds(
  ctx: ServiceContext,
  householdId: string,
): Promise<CalendarFeed[]> {
  const { data, error } = await ctx.db
    .from('calendar_feed')
    .select('id, created_by, locale, created_at, expires_at, revoked_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`calendar feed list failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    createdBy: row.created_by,
    locale: row.locale as Locale,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  }));
}

// ------------------------------------------------------------ the feed itself

/**
 * What `calendar_feed_inputs()` returns, parsed rather than cast: a column
 * renamed in a migration should fail here, loudly, not become an empty
 * calendar that a parent trusts.
 */
const feedInputsSchema = z.object({
  household_id: z.string().uuid(),
  locale: z.enum(['he', 'en']),
  pregnancy: z
    .object({
      dating_method: z.enum(['lmp', 'ultrasound', 'ivf_transfer']),
      lmp: z.string().nullable(),
      edd: z.string().nullable(),
      transfer_date: z.string().nullable(),
      fetuses: z.number().int(),
    })
    .nullable(),
  profile: z
    .object({
      firstborn: z.boolean().nullable(),
      customs: z.string().nullable(),
      health_fund: z.string().nullable(),
      has_supplementary: z.boolean().nullable(),
      rh_negative: z.boolean().nullable(),
      sex: z.string().nullable(),
      feeding_intent: z.string().nullable(),
    })
    .nullable(),
  decisions: z.array(
    z.object({
      kb_item_id: z.string(),
      kb_version: z.number().int(),
      state: z.enum(['done', 'skipped', 'open']),
    }),
  ),
});

type FeedInputs = z.infer<typeof feedInputsSchema>;

/**
 * The same three inputs `listTasks()` reads, rebuilt from the function's JSON.
 * A null column becomes an absent property, never a `false` that reads as an
 * answer — the rule `getProfile()` keeps for the same reason.
 */
export function householdInputsFromFeed(feed: FeedInputs): HouseholdInputs {
  const pregnancy: Pregnancy | null = feed.pregnancy
    ? {
        householdId: feed.household_id,
        datingMethod: feed.pregnancy.dating_method,
        lmp: feed.pregnancy.lmp as IsoDate | null,
        edd: feed.pregnancy.edd as IsoDate | null,
        transferDate: feed.pregnancy.transfer_date as IsoDate | null,
        fetuses: feed.pregnancy.fetuses,
      }
    : null;

  let profile: ProfileWrite | null = null;
  if (feed.profile) {
    profile = {};
    const p = feed.profile;
    if (p.firstborn !== null) profile.firstborn = p.firstborn;
    if (p.customs !== null)
      profile.customs = p.customs as NonNullable<Profile['customs']>;
    if (p.health_fund !== null)
      profile.health_fund = p.health_fund as NonNullable<Profile['health_fund']>;
    if (p.has_supplementary !== null) profile.has_supplementary = p.has_supplementary;
    if (p.rh_negative !== null) profile.rh_negative = p.rh_negative;
    if (p.sex !== null) profile.sex = p.sex as NonNullable<Profile['sex']>;
    if (p.feeding_intent !== null)
      profile.feeding_intent = p.feeding_intent as NonNullable<Profile['feeding_intent']>;
  }

  const states = new Map<string, StoredDecision>(
    feed.decisions.map((d) => [
      d.kb_item_id,
      {
        decision: d.state as TaskDecision,
        decidedBy: null,
        decidedAt: null,
        kbVersion: d.kb_version,
      },
    ]),
  );

  return { pregnancy, profile, states };
}

/**
 * One event per window nobody has decided. A done or skipped item leaves the
 * calendar, because a reminder for something already handled teaches a parent
 * to ignore the reminders. A late item stays, without alarms: it is still
 * undone, and an alarm about the past is noise.
 */
export function feedEvents(
  tasks: TaskView[],
  locale: Locale,
  uidSuffix: string,
  checklistUrl: string,
): CalendarEvent[] {
  return tasks
    .filter((task) => task.decision !== 'done' && task.decision !== 'skipped')
    .map((task) => {
      const text = task.locales[locale] ?? task.locales.he;
      const description = [text?.why, task.sources[0]].filter(Boolean).join('\n\n');
      return {
        uid: `${task.kbItemId}-${uidSuffix}@kenn`,
        start: task.dueStart,
        end: task.dueEnd,
        title: text?.title ?? task.kbItemId,
        ...(description ? { description } : {}),
        url: checklistUrl,
        remind: task.timeStatus !== 'overdue',
      };
    });
}

/** Hex SHA-256, truncated: a UID suffix that does not publish the household id. */
async function shortHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** The anonymous client: publishable key, no session, nothing persisted. */
function anonDb() {
  const { url, publishableKey } = supabaseEnv();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * The calendar file for a token, or null when the token is unknown, revoked or
 * expired — the database does not say which, and neither does this.
 */
export async function calendarFeedFor(
  token: string,
  today: IsoDate,
  origin: string,
  calendarName: (locale: Locale) => string,
): Promise<string | null> {
  // 64 hex characters is the only shape create_calendar_feed() mints. Anything
  // else is refused before it costs a database round trip.
  if (!/^[0-9a-f]{64}$/.test(token)) return null;

  const { data, error } = await anonDb().rpc('calendar_feed_inputs', { p_token: token });
  if (error) throw new Error(`calendar feed read failed: ${error.message}`);
  if (data === null) return null;

  const feed = feedInputsSchema.parse(data);
  const tasks = composeTasks(householdInputsFromFeed(feed), today);
  const events = feedEvents(
    tasks,
    feed.locale,
    await shortHash(feed.household_id),
    `${origin}/${feed.locale}/checklist`,
  );

  return toIcs({ name: calendarName(feed.locale), stamp: today, events });
}
