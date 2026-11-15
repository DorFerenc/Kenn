/**
 * The checklist's composition.
 *
 * `listTasks` is where the three halves of Kenn meet: guidance from git,
 * windows from the engine, decisions from Postgres. Every bug in it produces a
 * screen that looks right — an item in the wrong group, a completed test shown
 * as overdue, an item shown to a family the guidance does not apply to — so
 * none of it can be left to review.
 *
 * The KB here is the real one. These are the project's own published items, so
 * a content change that breaks the pipeline fails here rather than on a phone.
 */

import { addDays, type IsoDate } from '@kenn/engine';
import { publishedKbItems } from '@kenn/kb/items';
import { describe, expect, it } from 'vitest';
import type { ServiceContext } from './context.ts';
import { fakeDb, HOUSEHOLD_A, USER_A, type TableResult } from './fake-db.ts';
import { decideTask, listTasks } from './tasks.ts';

const TODAY = '2027-01-15' as IsoDate;
/** 20 weeks in: past the NT scan, before the glucose challenge. */
const LMP = addDays(TODAY, -140);

interface World {
  pregnancy?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  taskStates?: Record<string, unknown>[];
}

function context(world: World): { ctx: ServiceContext; db: ReturnType<typeof fakeDb> } {
  const tables: Record<string, TableResult> = {
    pregnancy: {
      data:
        world.pregnancy === undefined
          ? {
              household_id: HOUSEHOLD_A,
              dating_method: 'lmp',
              lmp: LMP,
              edd: null,
              transfer_date: null,
              fetuses: 1,
            }
          : world.pregnancy,
      error: null,
    },
    household_profile: { data: world.profile ?? null, error: null },
    task_state: { data: world.taskStates ?? [], error: null },
    audit_log: { data: null, error: null },
  };

  const db = fakeDb(tables);
  return {
    ctx: {
      db: db as unknown as ServiceContext['db'],
      actor: { kind: 'user', userId: USER_A },
    },
    db,
  };
}

describe('listTasks', () => {
  it('materialises the real KB against the household anchors', async () => {
    const { ctx } = context({});
    const tasks = await listTasks(ctx, TODAY);

    expect(tasks.length).toBeGreaterThan(5);
    // Every task carries both locales, because one parent reads Hebrew and the
    // other English off the same list.
    for (const task of tasks) {
      expect(task.locales.he?.title).toBeTruthy();
      expect(task.locales.en?.title).toBeTruthy();
    }
  });

  it('returns nothing at all before onboarding', async () => {
    const { ctx } = context({ pregnancy: null });
    expect(await listTasks(ctx, TODAY)).toEqual([]);
  });

  it('never materialises a draft item', async () => {
    // preg.rsv-maternal-vaccine carries a US window while Israeli policy
    // differs, so it ships as a draft (step 1). A draft that became a task
    // would be the app telling someone to have a vaccine on a timing nobody
    // has checked for Israel.
    const drafts = publishedKbItems.filter((item) => item.status !== 'published');
    expect(drafts).toEqual([]);

    const { ctx } = context({});
    const ids = (await listTasks(ctx, TODAY)).map((task) => task.kbItemId);
    expect(ids).not.toContain('preg.rsv-maternal-vaccine');
  });

  it('hides an item whose condition the profile cannot answer', async () => {
    // preg.anti-d applies to Rh-negative women. With no answer stored it must
    // not appear: showing a test to people who do not need it trains them to
    // ignore the list (step 4's decision).
    const unknownRh = await listTasks(context({ profile: null }).ctx, TODAY);
    expect(unknownRh.map((t) => t.kbItemId)).not.toContain('preg.anti-d');

    const rhNegative = await listTasks(
      context({ profile: { rh_negative: true } }).ctx,
      TODAY,
    );
    expect(rhNegative.map((t) => t.kbItemId)).toContain('preg.anti-d');
  });

  it('lets a decision override the clock', async () => {
    // The NT scan's window closed around day 97; at day 140 it is overdue. A
    // parent who had the scan must not be told they are late for it.
    const open = await listTasks(context({}).ctx, TODAY);
    const before = open.find((task) => task.kbItemId === 'preg.nt-scan');
    expect(before?.status).toBe('overdue');

    const after = await listTasks(
      context({
        taskStates: [
          {
            kb_item_id: 'preg.nt-scan',
            kb_version: 1,
            state: 'done',
            acted_by: USER_A,
            acted_at: '2027-01-01T10:00:00Z',
          },
        ],
      }).ctx,
      TODAY,
    );
    const done = after.find((task) => task.kbItemId === 'preg.nt-scan');
    expect(done?.status).toBe('done');
    expect(done?.decision).toBe('done');
    // And the window's own verdict survives, so undo can put it back without
    // asking the server what the window says.
    expect(done?.timeStatus).toBe('overdue');
  });

  it('marks a completed item whose guidance has since changed', async () => {
    const item = publishedKbItems.find((candidate) => candidate.id === 'preg.nt-scan');
    const stale = await listTasks(
      context({
        taskStates: [
          {
            kb_item_id: 'preg.nt-scan',
            kb_version: (item?.version ?? 1) - 1,
            state: 'done',
            acted_by: USER_A,
            acted_at: '2027-01-01T10:00:00Z',
          },
        ],
      }).ctx,
      TODAY,
    );
    expect(stale.find((task) => task.kbItemId === 'preg.nt-scan')?.guidanceUpdated).toBe(
      true,
    );

    const current = await listTasks(
      context({
        taskStates: [
          {
            kb_item_id: 'preg.nt-scan',
            kb_version: item?.version ?? 1,
            state: 'done',
            acted_by: USER_A,
            acted_at: '2027-01-01T10:00:00Z',
          },
        ],
      }).ctx,
      TODAY,
    );
    expect(
      current.find((task) => task.kbItemId === 'preg.nt-scan')?.guidanceUpdated,
    ).toBe(false);
  });

  it('is ordered by when the window opens', async () => {
    const starts = (await listTasks(context({}).ctx, TODAY)).map((task) => task.dueStart);
    expect([...starts].sort()).toEqual(starts);
  });
});

describe('decideTask', () => {
  it('writes the decision and an audit row, in that order', async () => {
    const { ctx, db } = context({});
    await decideTask(ctx, HOUSEHOLD_A, 'preg.glucose-challenge', 'done');

    expect(db.calls.map((call) => `${call.table}.${call.operation}`)).toEqual([
      'task_state.upsert',
      'audit_log.insert',
    ]);

    const written = db.calls[0]?.payload as Record<string, unknown>;
    expect(written.state).toBe('done');
    expect(written.household_id).toBe(HOUSEHOLD_A);
    expect(written.acted_by).toBe(USER_A);
    // The version live now, which is what makes "guidance updated" mean
    // something later.
    const item = publishedKbItems.find((i) => i.id === 'preg.glucose-challenge');
    expect(written.kb_version).toBe(item?.version);
  });

  it('records a reopen as a state, never as a delete', async () => {
    const { ctx, db } = context({
      taskStates: [
        {
          kb_item_id: 'preg.glucose-challenge',
          kb_version: 1,
          state: 'done',
          acted_by: USER_A,
          acted_at: '2027-01-01T10:00:00Z',
        },
      ],
    });
    await decideTask(ctx, HOUSEHOLD_A, 'preg.glucose-challenge', 'open');

    // Hard rule 5: no request path deletes a household row.
    expect(db.calls.some((call) => call.operation === 'upsert')).toBe(true);
    expect(db.calls.map((c) => c.operation)).not.toContain('delete');

    const audit = db.calls.find((call) => call.table === 'audit_log')?.payload as Record<
      string,
      unknown
    >;
    expect(audit.action).toBe('task.open');
    expect(audit.before).toEqual({ state: 'done', kb_version: 1 });
    expect(audit.actor_kind).toBe('user');
  });

  it('refuses an item the KB does not publish', async () => {
    const { ctx, db } = context({});
    await expect(
      decideTask(ctx, HOUSEHOLD_A, 'preg.rsv-maternal-vaccine', 'done'),
    ).rejects.toThrow(/unknown KB item/);
    expect(db.calls).toEqual([]);
  });
});
