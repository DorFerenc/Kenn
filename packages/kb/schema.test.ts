import { describe, expect, it } from 'vitest';
import { kbItemSchema } from './schema.ts';

/** A minimal valid schedule item, to be broken one field at a time. */
const scheduleItem = () => ({
  id: 'preg.example',
  kind: 'schedule' as const,
  version: 1,
  country: 'IL',
  phase: 'pregnancy' as const,
  category: 'test' as const,
  locales: { he: { title: 'בדיקה' }, en: { title: 'A test' } },
  window: { anchor: 'LMP' as const, start_days: 100, end_days: 110 },
  sources: ['https://me.health.gov.il/example'],
  review_by: '2027-03-01',
});

/** A minimal valid thing item. */
const thingItem = () => ({
  id: 'things.example',
  kind: 'thing' as const,
  version: 1,
  country: 'IL',
  phase: 'pregnancy' as const,
  category: 'thing' as const,
  locales: { he: { title: 'פריט' }, en: { title: 'An item' } },
  necessity: 'recommended' as const,
  sources: ['https://me.health.gov.il/example'],
  review_by: '2027-03-01',
});

const errorsFor = (input: unknown) => {
  const r = kbItemSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('a published item must be bilingual and cited', () => {
  it('accepts a complete item', () => {
    expect(kbItemSchema.safeParse(scheduleItem()).success).toBe(true);
  });

  it('rejects a published item with no Hebrew', () => {
    const item = { ...scheduleItem(), locales: { en: { title: 'A test' } } };
    expect(errorsFor(item)).toContain('locales.he: a published item needs Hebrew text');
  });

  it('rejects a published item with no English', () => {
    const item = { ...scheduleItem(), locales: { he: { title: 'בדיקה' } } };
    expect(errorsFor(item)).toContain('locales.en: a published item needs English text');
  });

  it('rejects a published item with no source', () => {
    const item = { ...scheduleItem(), sources: [] };
    expect(errorsFor(item).join(' ')).toMatch(/at least one source URL/);
  });

  it('allows a draft to be incomplete, because draft is the honest answer', () => {
    const item = {
      ...scheduleItem(),
      status: 'draft' as const,
      locales: { he: { title: 'טיוטה' } },
      sources: [],
    };
    expect(kbItemSchema.safeParse(item).success).toBe(true);
  });
});

describe('safety is a veto, not a vote (ADR-0005)', () => {
  it('rejects an unsafe thing with no safety authority', () => {
    const item = { ...thingItem(), necessity: 'unsafe' as const };
    expect(errorsFor(item)).toContain(
      'safety_authority: necessity "unsafe" requires a named safety_authority (ADR-0005)',
    );
  });

  it('rejects a discouraged thing with no safety authority', () => {
    const item = { ...thingItem(), necessity: 'discouraged' as const };
    expect(errorsFor(item).join(' ')).toMatch(/requires a named safety_authority/);
  });

  it('rejects an unsafe thing with an authority but no source', () => {
    const item = {
      ...thingItem(),
      necessity: 'unsafe' as const,
      safety_authority: 'moh' as const,
      sources: [],
    };
    expect(errorsFor(item).join(' ')).toMatch(/requires a source URL for the verdict/);
  });

  it('accepts an unsafe thing that names an authority and cites it', () => {
    // The cot bumper. Four real family lists recommend it; the MoH does not.
    const item = {
      ...thingItem(),
      id: 'things.crib-bumper',
      necessity: 'unsafe' as const,
      safety_authority: 'moh' as const,
      sources: [
        'https://me.health.gov.il/parenting/raising-children/after-childbirth/initial-care-for-newborn-after-birth/preparing-the-babys-room/',
      ],
      lists: [
        { list: 'il.seed-list-a', tier: 'mandatory' as const },
        { list: 'il.seed-list-b', tier: 'unnecessary' as const },
      ],
    };
    expect(kbItemSchema.safeParse(item).success).toBe(true);
  });

  it('rejects an authority that is not an authority', () => {
    const item = {
      ...thingItem(),
      necessity: 'unsafe' as const,
      safety_authority: 'a-facebook-group',
    };
    expect(kbItemSchema.safeParse(item).success).toBe(false);
  });

  it('does not require an authority for an ordinary recommendation', () => {
    expect(kbItemSchema.safeParse(thingItem()).success).toBe(true);
  });
});

describe('windows', () => {
  it('rejects a window that ends before it starts', () => {
    const item = {
      ...scheduleItem(),
      window: { anchor: 'LMP' as const, start_days: 110, end_days: 100 },
    };
    expect(errorsFor(item)).toContain('window: end_days is before start_days');
  });

  it('rejects a red flag that falls inside the window', () => {
    const item = { ...scheduleItem(), red_flag_days: 105 };
    expect(errorsFor(item).join(' ')).toMatch(/red_flag_days should be at or after/);
  });

  it('allows negative offsets, because folic acid starts before conception', () => {
    const item = {
      ...scheduleItem(),
      window: { anchor: 'LMP' as const, start_days: -90, end_days: 280 },
    };
    expect(kbItemSchema.safeParse(item).success).toBe(true);
  });
});

describe('the envelope', () => {
  it('rejects an id that is not <phase>.<slug>', () => {
    expect(kbItemSchema.safeParse({ ...scheduleItem(), id: 'NotAnId' }).success).toBe(
      false,
    );
  });

  it('rejects a review_by that precedes valid_from', () => {
    const item = { ...scheduleItem(), valid_from: '2027-06-01', review_by: '2027-03-01' };
    expect(errorsFor(item)).toContain('review_by: review_by must be after valid_from');
  });

  it('rejects an unknown field, so a typo cannot be silently ignored', () => {
    expect(kbItemSchema.safeParse({ ...scheduleItem(), windwo: {} }).success).toBe(false);
  });

  it('rejects a source that is not a URL', () => {
    expect(
      kbItemSchema.safeParse({ ...scheduleItem(), sources: ['see the MoH page'] })
        .success,
    ).toBe(false);
  });

  it('rejects a thing field on a schedule item', () => {
    expect(
      kbItemSchema.safeParse({ ...scheduleItem(), necessity: 'essential' }).success,
    ).toBe(false);
  });

  it('rejects a schedule field on a thing item', () => {
    expect(
      kbItemSchema.safeParse({
        ...thingItem(),
        window: { anchor: 'LMP', start_days: 1, end_days: 2 },
      }).success,
    ).toBe(false);
  });
});
