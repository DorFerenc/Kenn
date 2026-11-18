/**
 * The wizard's validation.
 *
 * The interesting cases are not malformed input — zod handles that — but input
 * that is well-formed and wrong. A due date typed with last year's year, or an
 * LMP eleven months ago, produces a complete and confidently wrong schedule
 * rather than an error, and the parent has no way to tell.
 */

import type { IsoDate } from '@kenn/engine';
import { describe, expect, it } from 'vitest';
import { onboardingSchema } from './onboarding.ts';

const TODAY = '2027-01-15' as IsoDate;
const schema = onboardingSchema(TODAY);

const base = {
  householdName: 'Our household',
  locale: 'he' as const,
  genderForm: 'feminine' as const,
  fetuses: 1,
};

function parse(extra: Record<string, unknown>) {
  return schema.safeParse({ ...base, ...extra });
}

describe('dating', () => {
  it('accepts an LMP twenty weeks ago', () => {
    expect(parse({ datingMethod: 'lmp', lmp: '2026-08-28' }).success).toBe(true);
  });

  it('refuses a dating method with no date', () => {
    const result = parse({ datingMethod: 'lmp' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['lmp']);
  });

  it('refuses an EDD where an LMP belongs', () => {
    // The field that matters is the one the method is named after, so an EDD
    // supplied for LMP dating leaves the anchor missing — which the engine
    // answers with an empty checklist, not an error.
    expect(parse({ datingMethod: 'lmp', edd: '2027-06-01' }).success).toBe(false);
  });

  it('refuses an LMP in the future', () => {
    expect(parse({ datingMethod: 'lmp', lmp: '2027-02-01' }).success).toBe(false);
  });

  it('refuses an LMP too long ago to be this pregnancy', () => {
    // 44 weeks. Past this it is last year's year, typed by accident.
    expect(parse({ datingMethod: 'lmp', lmp: '2026-01-01' }).success).toBe(false);
  });

  it('accepts an LMP exactly at the limit, and refuses the day before it', () => {
    // 308 days before 2027-01-15 is 2026-03-13, and the limit is inclusive:
    // a boundary tested in the middle of a range is a boundary untested.
    expect(parse({ datingMethod: 'lmp', lmp: '2026-03-13' }).success).toBe(true);
    expect(parse({ datingMethod: 'lmp', lmp: '2026-03-12' }).success).toBe(false);
  });

  it('accepts today as an EDD and refuses yesterday', () => {
    expect(parse({ datingMethod: 'ultrasound', edd: TODAY }).success).toBe(true);
    expect(parse({ datingMethod: 'ultrasound', edd: '2027-01-14' }).success).toBe(false);
  });

  it('refuses a due date ten months out', () => {
    expect(parse({ datingMethod: 'ultrasound', edd: '2028-01-15' }).success).toBe(false);
  });

  it('accepts an IVF transfer date', () => {
    expect(
      parse({ datingMethod: 'ivf_transfer', transferDate: '2026-09-10' }).success,
    ).toBe(true);
  });

  it('refuses a transfer date in the future', () => {
    expect(
      parse({ datingMethod: 'ivf_transfer', transferDate: '2027-03-01' }).success,
    ).toBe(false);
  });
});

describe('the rest of the form', () => {
  it('coerces the fetus count a radio submits as a string', () => {
    const result = parse({ datingMethod: 'lmp', lmp: '2026-08-28', fetuses: '2' });
    expect(result.success).toBe(true);
    expect(result.data?.fetuses).toBe(2);
  });

  it('refuses no babies, and refuses five', () => {
    expect(parse({ datingMethod: 'lmp', lmp: '2026-08-28', fetuses: 0 }).success).toBe(
      false,
    );
    expect(parse({ datingMethod: 'lmp', lmp: '2026-08-28', fetuses: 5 }).success).toBe(
      false,
    );
  });

  it('refuses a household with no name', () => {
    expect(
      parse({ datingMethod: 'lmp', lmp: '2026-08-28', householdName: '   ' }).success,
    ).toBe(false);
  });

  it('leaves every profile answer optional', () => {
    // An unanswered condition must stay unanswered all the way to the engine,
    // where it means "does not match". A default here would quietly start
    // showing items to families the guidance does not apply to.
    const result = parse({ datingMethod: 'lmp', lmp: '2026-08-28' });
    expect(result.success).toBe(true);
    expect(result.data?.firstborn).toBeUndefined();
    expect(result.data?.customs).toBeUndefined();
    expect(result.data?.healthFund).toBeUndefined();
  });

  it('refuses a locale the UI does not translate', () => {
    // `member.locale` admits ar and ru; the wizard may not set one, because a
    // member who chose Arabic would get an untranslated screen.
    expect(parse({ datingMethod: 'lmp', lmp: '2026-08-28', locale: 'ar' }).success).toBe(
      false,
    );
  });
});
