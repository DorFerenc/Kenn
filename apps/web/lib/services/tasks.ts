/**
 * The checklist: KB guidance, the household's anchors, and what somebody
 * decided about each item.
 *
 * The shape of this file is roadmap step 5a's main design decision (ADR-0008).
 * Nothing here computes a date and nothing here stores one:
 *
 *   - **@kenn/engine** turns day offsets plus anchors into windows, at read
 *     time, every time. A corrected EDD therefore moves every window at once
 *     and no stored row can disagree with the engine.
 *   - **@kenn/kb** supplies the guidance, built into a module by `pnpm
 *     kb:build` because the YAML cannot be read from a bundle.
 *   - **`task_state`** holds the one thing neither can derive: that a parent
 *     ticked it, skipped it, or put it back.
 *
 * A completed item keeps the KB version it was completed under, so later
 * guidance shows as "updated" rather than rewriting what somebody did (step 1).
 */

import type { KbItem } from '@kenn/kb';
import { publishedKbItems } from '@kenn/kb/items';
import {
  anchorsFromPregnancy,
  defaultRules,
  materialize,
  type IsoDate,
  type Profile,
  type ScheduleInput,
  type TaskInstance,
  type TaskStatus,
} from '@kenn/engine';
import { nowTimestamp } from '../today.ts';
import { recordAudit } from './audit.ts';
import type { ServiceContext } from './context.ts';
import { getPregnancy, pregnancyInput, type Pregnancy } from './pregnancy.ts';
import { engineProfile, getProfile, type ProfileWrite } from './profile.ts';

/** What a parent decided. `open` is an explicit reopen, not an absent row. */
export type TaskDecision = 'done' | 'skipped' | 'open';

export interface TaskView extends TaskInstance {
  /** Both locales travel: one parent reads Hebrew and the other English. */
  locales: KbItem['locales'];
  category: KbItem['category'];
  priority: KbItem['priority'];
  evidence: KbItem['evidence'];
  coverage: KbItem['coverage'];
  sources: string[];
  /** The status time alone would give. Kept so the UI can put an item back
   *  where it belongs when a parent undoes a tick, without asking the server
   *  what the window says. */
  timeStatus: TaskStatus;
  decision: TaskDecision | null;
  decidedBy: string | null;
  decidedAt: string | null;
  /** The item's guidance changed after this was completed. Never rewrites it. */
  guidanceUpdated: boolean;
}

/** Only schedule items become tasks; a `thing` is roadmap step 8a's business. */
function scheduleInputs(items: KbItem[]): ScheduleInput[] {
  return items
    .filter((item) => item.kind === 'schedule')
    .map((item) => ({
      id: item.id,
      version: item.version,
      phase: item.phase,
      category: item.category,
      status: item.status,
      window: item.window,
      ...(item.red_flag_days === undefined ? {} : { red_flag_days: item.red_flag_days }),
      applies_if: item.applies_if as Profile,
      rules: item.rules,
    }));
}

/**
 * Every task for this household, in window order.
 *
 * `today` is a parameter all the way down, exactly as in the engine: the one
 * place in the app that reads a clock is `lib/today.ts`, so a test can stand in
 * any week of the pregnancy without waiting for it.
 */
export async function listTasks(
  ctx: ServiceContext,
  householdId: string,
  today: IsoDate,
): Promise<TaskView[]> {
  const [pregnancy, profile, states] = await Promise.all([
    getPregnancy(ctx, householdId),
    getProfile(ctx, householdId),
    taskStates(ctx, householdId),
  ]);
  return composeTasks({ pregnancy, profile, states }, today);
}

/** Everything a household's tasks are derived from: two reads and a decision map. */
export interface HouseholdInputs {
  pregnancy: Pregnancy | null;
  profile: ProfileWrite | null;
  states: Map<string, StoredDecision>;
}

/**
 * The checklist, from its inputs, with no I/O.
 *
 * The screens and the calendar feed (step 6a) both end here, so a window in
 * someone's calendar and the same window on the Checklist cannot disagree —
 * which is the certainty ADR-0008 traded a stored `task_instance` table for.
 */
export function composeTasks(inputs: HouseholdInputs, today: IsoDate): TaskView[] {
  const { pregnancy, profile, states } = inputs;
  if (!pregnancy) return [];

  const instances = materialize(
    scheduleInputs(publishedKbItems),
    {
      anchors: anchorsFromPregnancy(pregnancyInput(pregnancy)),
      profile: engineProfile(profile, {
        fetuses: pregnancy.fetuses,
        datingMethod: pregnancy.datingMethod,
      }),
      rules: defaultRules,
    },
    today,
  );

  const byId = new Map(publishedKbItems.map((item) => [item.id, item]));

  return instances
    .map((instance) => {
      const item = byId.get(instance.kbItemId);
      if (!item) return null;
      const state = states.get(instance.kbItemId) ?? null;

      return {
        ...instance,
        // A decision overrides the clock: a done item is done, not overdue.
        status: decisionStatus(state?.decision ?? null, instance.status),
        timeStatus: instance.status,
        locales: item.locales,
        category: item.category,
        priority: item.priority,
        evidence: item.evidence,
        coverage: item.coverage,
        sources: item.sources,
        decision: state?.decision ?? null,
        decidedBy: state?.decidedBy ?? null,
        decidedAt: state?.decidedAt ?? null,
        guidanceUpdated: state?.decision === 'done' && state.kbVersion < item.version,
      } satisfies TaskView;
    })
    .filter((task): task is TaskView => task !== null)
    .sort((a, b) => a.dueStart.localeCompare(b.dueStart));
}

function decisionStatus(
  decision: TaskDecision | null,
  timeStatus: TaskStatus,
): TaskStatus {
  if (decision === 'done') return 'done';
  if (decision === 'skipped') return 'skipped';
  return timeStatus;
}

export interface StoredDecision {
  decision: TaskDecision;
  /** Null when the decision arrives without its author — the calendar feed. */
  decidedBy: string | null;
  decidedAt: string | null;
  kbVersion: number;
}

async function taskStates(
  ctx: ServiceContext,
  householdId: string,
): Promise<Map<string, StoredDecision>> {
  // Keyed by kb_item_id alone, so an unfiltered read would let one household's
  // decision land on another household's checklist for the same item.
  const { data, error } = await ctx.db
    .from('task_state')
    .select('kb_item_id, kb_version, state, acted_by, acted_at')
    .eq('household_id', householdId);

  if (error) throw new Error(`task_state read failed: ${error.message}`);

  return new Map(
    (data ?? []).map((row) => [
      row.kb_item_id,
      {
        decision: row.state as TaskDecision,
        decidedBy: row.acted_by,
        decidedAt: row.acted_at,
        kbVersion: row.kb_version,
      },
    ]),
  );
}

/**
 * Record a decision about one item.
 *
 * Always an upsert, never a delete: a reopen writes `open` so the row keeps its
 * history and no request path in the app can remove one (hard rule 5).
 *
 * The KB version written is the version live *now*, which is what makes
 * "guidance updated" meaningful later: it marks what the parent was looking at
 * when they decided.
 */
export async function decideTask(
  ctx: ServiceContext,
  householdId: string,
  kbItemId: string,
  decision: TaskDecision,
  note?: string,
): Promise<void> {
  if (!ctx.actor.userId) throw new Error('decideTask needs a signed-in user');

  const item = publishedKbItems.find((candidate) => candidate.id === kbItemId);
  if (!item) throw new Error(`unknown KB item: ${kbItemId}`);

  const before = (await taskStates(ctx, householdId)).get(kbItemId) ?? null;

  const { error } = await ctx.db.from('task_state').upsert(
    {
      household_id: householdId,
      kb_item_id: kbItemId,
      kb_version: item.version,
      state: decision,
      acted_by: ctx.actor.userId,
      acted_at: nowTimestamp(),
      note: note ?? null,
    },
    { onConflict: 'household_id,kb_item_id' },
  );

  if (error) throw new Error(`task_state write failed: ${error.message}`);

  await recordAudit(ctx, householdId, {
    action: `task.${decision}`,
    entity: 'task_state',
    entityId: kbItemId,
    before: before ? { state: before.decision, kb_version: before.kbVersion } : null,
    after: { state: decision, kb_version: item.version },
  });
}
