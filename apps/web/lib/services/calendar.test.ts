import { describe, expect, it } from 'vitest';
import { calendarFeedFor, feedEvents, householdInputsFromFeed } from './calendar.ts';
import { composeTasks } from './tasks.ts';

const TODAY = '2026-11-18';

/** What calendar_feed_inputs() returns for a household at about week 20. */
const feed = (overrides: Record<string, unknown> = {}) => ({
  uid_salt: '11111111-0000-0000-0000-000000000001',
  locale: 'en' as const,
  pregnancy: {
    dating_method: 'lmp' as const,
    anchor: '2026-07-01',
    fetuses: 1,
  },
  profile: {
    firstborn: true,
    customs: null,
    health_fund: null,
    has_supplementary: null,
    rh_negative: null,
    sex: null,
    feeding_intent: null,
  },
  decided: [] as string[],
  ...overrides,
});

describe('householdInputsFromFeed', () => {
  it('keeps an unanswered question absent, never false', () => {
    const { profile } = householdInputsFromFeed(feed());
    expect(profile).toEqual({ firstborn: true });
    expect(profile && 'rh_negative' in profile).toBe(false);
  });

  // ADR-0008's claim, checked: the feed and the Checklist cannot disagree. For
  // each dating method, the household as getPregnancy() reads it and the same
  // household as calendar_feed_inputs() returns it must give identical
  // windows. A swapped edd / transfer_date branch fails here.
  it.each([
    ['lmp', { lmp: '2026-07-01', edd: null, transferDate: null }],
    ['ultrasound', { lmp: null, edd: '2027-04-07', transferDate: null }],
    ['ivf_transfer', { lmp: null, edd: null, transferDate: '2026-07-15' }],
  ] as const)('gives the Checklist’s windows exactly, dated by %s', (method, dates) => {
    const screen = composeTasks(
      {
        pregnancy: { householdId: 'h', datingMethod: method, fetuses: 1, ...dates },
        profile: { firstborn: true },
        states: new Map(),
      },
      TODAY,
    );
    const anchor = dates.lmp ?? dates.edd ?? dates.transferDate;
    const fromFeed = composeTasks(
      householdInputsFromFeed(
        feed({ pregnancy: { dating_method: method, anchor, fetuses: 1 } }),
      ),
      TODAY,
    );

    const windows = (tasks: typeof screen) =>
      tasks.map((t) => `${t.kbItemId} ${t.dueStart} ${t.dueEnd}`);
    expect(screen.length).toBeGreaterThan(5);
    expect(windows(fromFeed)).toEqual(windows(screen));
    // Rh is unknown, so the anti-D item must not appear in either.
    expect(fromFeed.some((t) => t.kbItemId === 'preg.anti-d')).toBe(false);
  });

  it('never reports a decided item as having newer guidance', () => {
    const tasks = composeTasks(
      householdInputsFromFeed(feed({ decided: ['preg.folic-acid'] })),
      TODAY,
    );
    expect(tasks.every((t) => !t.guidanceUpdated)).toBe(true);
  });

  it('returns no tasks when there is no pregnancy yet', () => {
    expect(
      composeTasks(householdInputsFromFeed(feed({ pregnancy: null })), TODAY),
    ).toEqual([]);
  });
});

describe('feedEvents', () => {
  const tasks = composeTasks(householdInputsFromFeed(feed()), TODAY);
  const someId = tasks[0]!.kbItemId;

  it('writes one event per undecided window, in the requested language', () => {
    const events = feedEvents(tasks, 'en', 'abc', 'https://kenn.test/en/checklist');
    expect(events).toHaveLength(tasks.length);
    expect(events[0]!.title).toBe(tasks[0]!.locales.en?.title);
    const he = feedEvents(tasks, 'he', 'abc', 'https://kenn.test/he/checklist');
    expect(he[0]!.title).toBe(tasks[0]!.locales.he?.title);
  });

  it('drops a done or skipped item, so a handled test is not re-announced', () => {
    const decided = composeTasks(
      householdInputsFromFeed(feed({ decided: [someId] })),
      TODAY,
    );
    const ids = feedEvents(decided, 'en', 'abc', 'u').map((e) => e.uid);
    expect(ids).not.toContain(`${someId}-abc@kenn`);
  });

  it('keeps a late item but without alarms', () => {
    const late = tasks.find((t) => t.timeStatus === 'overdue');
    expect(late).toBeDefined();
    const event = feedEvents(tasks, 'en', 'abc', 'u').find(
      (e) => e.uid === `${late!.kbItemId}-abc@kenn`,
    );
    expect(event?.remind).toBe(false);
  });

  it('gives a stable UID per item and household', () => {
    const a = feedEvents(tasks, 'en', 'abc', 'u').map((e) => e.uid);
    const b = feedEvents(tasks, 'en', 'abc', 'u').map((e) => e.uid);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });
});

describe('calendarFeedFor', () => {
  it('refuses a malformed token before touching the database', async () => {
    // No Supabase env is set in unit tests, so reaching the client would throw.
    for (const token of ['', 'abc', 'Z'.repeat(64), `${'a'.repeat(64)}/..`]) {
      await expect(
        calendarFeedFor(
          token,
          TODAY,
          '2026-11-18T07:00:00.000Z',
          'https://kenn.test',
          () => 'Kenn',
        ),
      ).resolves.toBeNull();
    }
  });
});
