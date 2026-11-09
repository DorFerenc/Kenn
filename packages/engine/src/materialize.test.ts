import { describe, expect, it } from 'vitest';
import { anchorsFromChild, anchorsFromPregnancy } from './anchors.ts';
import { appliesTo, dueNow, materialize, statusFor } from './materialize.ts';
import { defaultRules, shabbatShiftRule } from './rules.ts';
import type { EngineContext, ScheduleInput } from './types.ts';

const LMP = '2026-06-08'; // EDD 2027-03-15

const ctx = (over: Partial<EngineContext> = {}): EngineContext => ({
  anchors: anchorsFromPregnancy({ lmp: LMP }),
  profile: {},
  rules: [],
  ...over,
});

const item = (over: Partial<ScheduleInput> = {}): ScheduleInput => ({
  id: 'preg.example',
  version: 1,
  phase: 'pregnancy',
  category: 'test',
  window: { anchor: 'LMP', start_days: 252, end_days: 265 },
  ...over,
});

describe('windows land on the dates clinicians quote', () => {
  it('places the GBS swab at 36+0 to 37+6', () => {
    const [task] = materialize([item({ id: 'preg.gbs-swab' })], ctx(), '2027-01-01');
    expect(task).toMatchObject({ dueStart: '2027-02-15', dueEnd: '2027-02-28' });
  });

  it('places NT at 11+0 to 13+6, the window that cannot be missed', () => {
    const [task] = materialize(
      [
        item({
          id: 'preg.nt-scan',
          window: { anchor: 'LMP', start_days: 77, end_days: 97 },
        }),
      ],
      ctx(),
      '2026-08-01',
    );
    expect(task).toMatchObject({ dueStart: '2026-08-24', dueEnd: '2026-09-13' });
  });

  it('carries the red-flag date through', () => {
    const [task] = materialize([item({ red_flag_days: 266 })], ctx(), '2027-01-01');
    expect(task?.redFlagDate).toBe('2027-03-01');
  });

  it('measures an EDD-anchored window from the EDD', () => {
    const [task] = materialize(
      [item({ window: { anchor: 'EDD', start_days: -30, end_days: 60 } })],
      ctx(),
      '2027-01-01',
    );
    expect(task).toMatchObject({ dueStart: '2027-02-13', dueEnd: '2027-05-14' });
  });

  it('skips an item whose anchor is not known yet', () => {
    // No birth date, so a BIRTH-anchored item cannot be placed. It must be
    // omitted, not placed at epoch zero.
    const tasks = materialize(
      [item({ window: { anchor: 'BIRTH', start_days: 0, end_days: 7 } })],
      ctx(),
      '2027-01-01',
    );
    expect(tasks).toEqual([]);
  });
});

describe('status follows the window and today', () => {
  const w = { dueStart: '2027-02-15', dueEnd: '2027-02-28' };

  it('is upcoming before the window opens', () => {
    expect(statusFor(w, '2027-02-14')).toBe('upcoming');
  });

  it('is open on the first day — the boundary, not the middle', () => {
    expect(statusFor(w, '2027-02-15')).toBe('open');
  });

  it('is closing for the last three days', () => {
    expect(statusFor(w, '2027-02-25')).toBe('open');
    expect(statusFor(w, '2027-02-26')).toBe('closing');
    expect(statusFor(w, '2027-02-28')).toBe('closing');
  });

  it('is overdue the day after it closes', () => {
    expect(statusFor(w, '2027-03-01')).toBe('overdue');
  });

  it('is open on a one-day window on its day', () => {
    expect(
      statusFor({ dueStart: '2027-03-22', dueEnd: '2027-03-22' }, '2027-03-22'),
    ).toBe('closing');
  });

  it('feeds the Today screen with what is actionable', () => {
    const tasks = materialize(
      [
        item({ id: 'preg.a', window: { anchor: 'LMP', start_days: 252, end_days: 265 } }),
        item({ id: 'preg.b', window: { anchor: 'LMP', start_days: 0, end_days: 10 } }),
        item({ id: 'preg.c', window: { anchor: 'LMP', start_days: 270, end_days: 280 } }),
      ],
      ctx(),
      '2027-02-20',
    );
    expect(tasks.map((t) => t.status)).toEqual(['overdue', 'open', 'upcoming']);
    expect(dueNow(tasks).map((t) => t.kbItemId)).toEqual(['preg.b', 'preg.a']);
  });
});

describe('applies_if decides who sees an item', () => {
  it('shows an unconditional item to everyone', () => {
    expect(appliesTo(item(), {})).toBe(true);
  });

  it('matches a condition the profile satisfies', () => {
    expect(
      appliesTo(item({ applies_if: { rh_negative: true } }), { rh_negative: true }),
    ).toBe(true);
  });

  it('hides an item whose condition the profile contradicts', () => {
    expect(
      appliesTo(item({ applies_if: { rh_negative: true } }), { rh_negative: false }),
    ).toBe(false);
  });

  it('hides an item when the profile has no answer', () => {
    // Showing an anti-D item to someone whose Rh is unknown trains them to
    // ignore the list, so an unanswered condition does not match.
    expect(appliesTo(item({ applies_if: { rh_negative: true } }), {})).toBe(false);
  });

  it('requires every condition to match, not just one', () => {
    const conditional = item({ applies_if: { customs: 'jewish', firstborn: true } });
    expect(appliesTo(conditional, { customs: 'jewish', firstborn: true })).toBe(true);
    expect(appliesTo(conditional, { customs: 'jewish', firstborn: false })).toBe(false);
  });
});

describe('drafts never become tasks', () => {
  it('omits a draft item', () => {
    // A draft has no reliable source, so it must never tell anyone to do
    // something. See packages/kb/CLAUDE.md.
    expect(materialize([item({ status: 'draft' })], ctx(), '2027-01-01')).toEqual([]);
    expect(
      materialize([item({ status: 'published' })], ctx(), '2027-01-01'),
    ).toHaveLength(1);
  });
});

describe('purity', () => {
  it('gives the same answer for the same inputs, whenever it is called', () => {
    const items = [
      item(),
      item({ id: 'preg.other', window: { anchor: 'LMP', start_days: 1, end_days: 2 } }),
    ];
    const a = materialize(items, ctx(), '2027-01-01');
    const b = materialize(items, ctx(), '2027-01-01');
    expect(a).toEqual(b);
  });

  it('does not mutate the items it is given', () => {
    const items = [item()];
    const snapshot: ScheduleInput[] = JSON.parse(JSON.stringify(items));
    materialize(items, ctx({ rules: defaultRules }), '2027-01-01');
    expect(items).toEqual(snapshot);
  });

  it('orders output soonest first and stably', () => {
    const tasks = materialize(
      [
        item({ id: 'preg.z', window: { anchor: 'LMP', start_days: 10, end_days: 20 } }),
        item({ id: 'preg.a', window: { anchor: 'LMP', start_days: 10, end_days: 20 } }),
        item({ id: 'preg.m', window: { anchor: 'LMP', start_days: 5, end_days: 20 } }),
      ],
      ctx(),
      '2026-06-10',
    );
    expect(tasks.map((t) => t.kbItemId)).toEqual(['preg.m', 'preg.a', 'preg.z']);
  });
});

describe('the Shabbat shift', () => {
  it('pulls an appointment window off Saturday, back to Thursday', () => {
    // 2027-02-27 is a Saturday.
    const [task] = materialize(
      [item({ window: { anchor: 'LMP', start_days: 252, end_days: 264 } })],
      ctx({ rules: [shabbatShiftRule] }),
      '2027-01-01',
    );
    expect(task?.dueEnd).toBe('2027-02-25'); // Thursday
    expect(task?.adjustedBy).toEqual(['shabbat-shift']);
  });

  it('pulls a Friday end back to Thursday, since clinics close at midday', () => {
    // 2027-02-26 is a Friday.
    const [task] = materialize(
      [item({ window: { anchor: 'LMP', start_days: 252, end_days: 263 } })],
      ctx({ rules: [shabbatShiftRule] }),
      '2027-01-01',
    );
    expect(task?.dueEnd).toBe('2027-02-25');
  });

  it('leaves a window that already ends midweek alone', () => {
    const [task] = materialize(
      [item()],
      ctx({ rules: [shabbatShiftRule] }),
      '2027-01-01',
    );
    expect(task?.dueEnd).toBe('2027-02-28'); // Sunday, fine
    expect(task?.adjustedBy).toBeUndefined();
  });

  it('does not shift something you do yourself', () => {
    const [task] = materialize(
      [
        item({
          category: 'supplement',
          window: { anchor: 'LMP', start_days: 252, end_days: 264 },
        }),
      ],
      ctx({ rules: [shabbatShiftRule] }),
      '2027-01-01',
    );
    expect(task?.dueEnd).toBe('2027-02-27'); // left on Saturday
  });

  it('never pushes the end before the start', () => {
    // A one-day window on a Saturday cannot be moved without inverting it.
    const [task] = materialize(
      [item({ window: { anchor: 'LMP', start_days: 264, end_days: 264 } })],
      ctx({ rules: [shabbatShiftRule] }),
      '2027-01-01',
    );
    expect(task?.dueStart).toBe('2027-02-27');
    expect(task?.dueEnd).toBe('2027-02-27');
  });
});

describe('Jewish lifecycle rules', () => {
  const born = (over = {}) =>
    ctx({
      anchors: anchorsFromChild({ birthDate: '2027-03-15', gaAtBirthWeeks: 40 }),
      profile: {
        customs: 'jewish',
        sex: 'male',
        firstborn: true,
        birth_type: 'vaginal',
        ...over,
      },
      rules: defaultRules,
    });

  const britItem = item({
    id: 'baby.brit-milah',
    category: 'visit',
    window: { anchor: 'BIRTH', start_days: 0, end_days: 30 },
  });
  const pidyonItem = item({
    id: 'baby.pidyon-haben',
    category: 'visit',
    window: { anchor: 'BIRTH', start_days: 0, end_days: 60 },
  });

  it('puts the brit on day 8 of life, which is seven days after the birth', () => {
    const [task] = materialize([britItem], born(), '2027-03-16');
    expect(task).toMatchObject({ dueStart: '2027-03-22', dueEnd: '2027-03-22' });
    expect(task?.adjustedBy).toContain('brit-milah');
  });

  it('keeps the brit on Shabbat, because a brit is held on Shabbat', () => {
    // Born Saturday 2027-03-20 -> day 8 is Saturday 2027-03-27. The Shabbat
    // shift must not move it.
    const c = ctx({
      anchors: anchorsFromChild({ birthDate: '2027-03-20' }),
      profile: { customs: 'jewish', sex: 'male', firstborn: true, birth_type: 'vaginal' },
      rules: defaultRules,
    });
    const [task] = materialize([britItem], c, '2027-03-21');
    expect(task?.dueEnd).toBe('2027-03-27');
  });

  it('puts pidyon haben on day 31 for a firstborn son born vaginally', () => {
    const [task] = materialize([pidyonItem], born(), '2027-03-16');
    expect(task).toMatchObject({ dueStart: '2027-04-14', dueEnd: '2027-04-14' });
  });

  // Assert the named rule did not fire, not that nothing adjusted the window:
  // an unplaced window keeps its KB offsets, whose end may still land on a
  // weekend and be moved by the Shabbat shift. That is correct behaviour.
  it('does not place pidyon haben after a caesarean', () => {
    const [task] = materialize(
      [pidyonItem],
      born({ birth_type: 'caesarean' }),
      '2027-03-16',
    );
    expect(task?.adjustedBy ?? []).not.toContain('pidyon-haben');
    expect(task?.dueStart).toBe('2027-03-15');
  });

  it('does not place pidyon haben for a later child', () => {
    const [task] = materialize([pidyonItem], born({ firstborn: false }), '2027-03-16');
    expect(task?.adjustedBy ?? []).not.toContain('pidyon-haben');
  });

  it('does not place either rule for a girl', () => {
    const [brit] = materialize([britItem], born({ sex: 'female' }), '2027-03-16');
    expect(brit?.adjustedBy ?? []).not.toContain('brit-milah');
    const [pidyon] = materialize([pidyonItem], born({ sex: 'female' }), '2027-03-16');
    expect(pidyon?.adjustedBy ?? []).not.toContain('pidyon-haben');
  });
});

describe('the RSV birth-month rule', () => {
  const rsv = item({
    id: 'baby.rsv-beyfortus',
    category: 'vaccine',
    window: { anchor: 'BIRTH', start_days: 0, end_days: 3 },
  });

  it('moves an April-to-August baby to Tipat Halav, ahead of the season', () => {
    const c = ctx({
      anchors: anchorsFromChild({ birthDate: '2027-05-10' }),
      rules: defaultRules,
    });
    const [task] = materialize([rsv], c, '2027-05-11');
    expect(task?.adjustedBy).toContain('rsv-birth-month');
    expect(task?.dueStart).toBe('2027-05-24');
  });

  it('leaves a winter baby to be immunised in hospital', () => {
    const c = ctx({
      anchors: anchorsFromChild({ birthDate: '2027-01-10' }),
      rules: defaultRules,
    });
    const [task] = materialize([rsv], c, '2027-01-11');
    expect(task?.adjustedBy).toBeUndefined();
    expect(task?.dueStart).toBe('2027-01-10');
  });

  it('covers both ends of the April-to-August boundary', () => {
    for (const [birth, shifted] of [
      ['2027-03-31', false],
      ['2027-04-01', true],
      ['2027-08-31', true],
      ['2027-09-01', false],
    ] as const) {
      const c = ctx({
        anchors: anchorsFromChild({ birthDate: birth }),
        rules: defaultRules,
      });
      const [task] = materialize([rsv], c, birth);
      expect(Boolean(task?.adjustedBy?.includes('rsv-birth-month'))).toBe(shifted);
    }
  });
});
