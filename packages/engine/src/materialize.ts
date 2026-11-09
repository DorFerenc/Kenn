/**
 * materialize(items, ctx, today) -> task instances.
 *
 * The one pure function the whole app dates from. No database, no clock: `today`
 * is a parameter, so the same inputs always give the same output and the tests
 * can stand in 2027 without waiting.
 */

import { addDays, assertIsoDate, diffDays, type IsoDate } from './dates.ts';
import type {
  EngineContext,
  Profile,
  ScheduleInput,
  TaskInstance,
  TaskStatus,
} from './types.ts';

/** A window is "closing" for its last three days. Drives the second reminder. */
export const CLOSING_WINDOW_DAYS = 3;

/**
 * Does this item apply to this family?
 *
 * Every condition present in `applies_if` must match. A condition the profile
 * has no answer for does NOT match — an item restricted to Rh-negative women
 * must not appear for someone whose Rh is unknown, because showing a test to
 * people who do not need it trains them to ignore the list.
 */
export function appliesTo(item: ScheduleInput, profile: Profile): boolean {
  const conditions = item.applies_if ?? {};
  for (const [key, expected] of Object.entries(conditions)) {
    if (expected === undefined) continue;
    const actual = profile[key as keyof Profile];
    if (actual === undefined) return false;
    if (actual !== expected) return false;
  }
  return true;
}

export function statusFor(
  window: { dueStart: IsoDate; dueEnd: IsoDate },
  today: IsoDate,
): TaskStatus {
  if (diffDays(today, window.dueStart) > 0) return 'upcoming';
  if (diffDays(today, window.dueEnd) < 0) return 'overdue';
  if (diffDays(today, window.dueEnd) < CLOSING_WINDOW_DAYS) return 'closing';
  return 'open';
}

/**
 * Build the task instances for one household.
 *
 * Draft items are skipped: a draft has no reliable source, so it must never
 * become a task telling someone to do something.
 */
export function materialize(
  items: ScheduleInput[],
  ctx: EngineContext,
  today: IsoDate,
): TaskInstance[] {
  assertIsoDate(today, 'today');
  const out: TaskInstance[] = [];

  for (const item of items) {
    if ((item.status ?? 'published') !== 'published') continue;
    if (!appliesTo(item, ctx.profile)) continue;

    const anchorDate = ctx.anchors[item.window.anchor];
    if (!anchorDate) continue; // the anchor is not known yet

    let window = {
      dueStart: addDays(anchorDate, item.window.start_days),
      dueEnd: addDays(anchorDate, item.window.end_days),
    };

    const adjustedBy: string[] = [];
    for (const rule of ctx.rules ?? []) {
      if (!rule.applies(item, ctx)) continue;
      const next = rule.adjust(window, item, ctx);
      if (next.dueStart !== window.dueStart || next.dueEnd !== window.dueEnd) {
        adjustedBy.push(rule.name);
        window = next;
      }
    }

    out.push({
      kbItemId: item.id,
      kbVersion: item.version,
      dueStart: window.dueStart,
      dueEnd: window.dueEnd,
      ...(item.red_flag_days !== undefined
        ? { redFlagDate: addDays(anchorDate, item.red_flag_days) }
        : {}),
      status: statusFor(window, today),
      ...(adjustedBy.length > 0 ? { adjustedBy } : {}),
    });
  }

  // Soonest first, then by id so the order is stable for snapshot comparisons.
  return out.sort(
    (a, b) => diffDays(b.dueStart, a.dueStart) || a.kbItemId.localeCompare(b.kbItemId),
  );
}

/** What the Today screen needs: due now or overdue, soonest first. */
export function dueNow(instances: TaskInstance[]): TaskInstance[] {
  return instances.filter((i) => ['open', 'closing', 'overdue'].includes(i.status));
}
