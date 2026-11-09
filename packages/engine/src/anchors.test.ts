import { describe, expect, it } from 'vitest';
import {
  anchorsFromChild,
  anchorsFromPregnancy,
  correctedAgeDays,
  seasonAtBirth,
} from './anchors.ts';

describe('pregnancy anchors', () => {
  it('derives the EDD from the LMP at 280 days', () => {
    expect(anchorsFromPregnancy({ lmp: '2026-06-08' })).toEqual({
      LMP: '2026-06-08',
      EDD: '2027-03-15',
    });
  });

  it('lets an ultrasound-corrected EDD override a remembered LMP', () => {
    // The scan is what the clinic dates from, and an LMP is often an estimate.
    const anchors = anchorsFromPregnancy({
      lmp: '2026-06-08',
      edd: '2027-03-22',
      datingMethod: 'ultrasound',
    });
    expect(anchors.EDD).toBe('2027-03-22');
    expect(anchors.LMP).toBe('2026-06-15'); // worked backwards, a week later
  });

  it('dates an IVF transfer exactly, overriding both', () => {
    // A day-5 blastocyst is 19 days after the notional LMP.
    const anchors = anchorsFromPregnancy({
      datingMethod: 'ivf_transfer',
      transferDate: '2026-06-27',
      transferDayOfEmbryo: 5,
    });
    expect(anchors.LMP).toBe('2026-06-08');
    expect(anchors.EDD).toBe('2027-03-15');
  });

  it('dates a day-3 transfer two days differently from a day-5', () => {
    const d3 = anchorsFromPregnancy({
      datingMethod: 'ivf_transfer',
      transferDate: '2026-06-27',
      transferDayOfEmbryo: 3,
    });
    expect(d3.LMP).toBe('2026-06-10');
  });

  it('refuses an IVF dating with no transfer date rather than guessing', () => {
    expect(() => anchorsFromPregnancy({ datingMethod: 'ivf_transfer' })).toThrow(
      /needs a transferDate/,
    );
  });

  it('returns nothing when nothing is known yet', () => {
    expect(anchorsFromPregnancy({})).toEqual({});
  });
});

describe('child anchors and corrected age', () => {
  it('makes corrected birth the same as birth for a term baby', () => {
    expect(anchorsFromChild({ birthDate: '2027-03-15', gaAtBirthWeeks: 40 })).toEqual({
      BIRTH: '2027-03-15',
      CORRECTED_BIRTH: '2027-03-15',
    });
  });

  it('pushes corrected birth out for a preterm baby', () => {
    // Born at 32 weeks: eight weeks early, so milestones are measured from
    // eight weeks after the birthday.
    const anchors = anchorsFromChild({ birthDate: '2027-01-18', gaAtBirthWeeks: 32 });
    expect(anchors.CORRECTED_BIRTH).toBe('2027-03-15');
  });

  it('does not bring corrected birth earlier for a post-term baby', () => {
    const anchors = anchorsFromChild({ birthDate: '2027-03-22', gaAtBirthWeeks: 41 });
    expect(anchors.CORRECTED_BIRTH).toBe('2027-03-22');
  });

  it('assumes term when gestational age at birth is not recorded', () => {
    expect(anchorsFromChild({ birthDate: '2027-03-15' }).CORRECTED_BIRTH).toBe(
      '2027-03-15',
    );
  });

  it('counts corrected age, negative before the corrected date', () => {
    const anchors = anchorsFromChild({ birthDate: '2027-01-18', gaAtBirthWeeks: 32 });
    expect(correctedAgeDays(anchors, '2027-04-15')).toBe(31);
    expect(correctedAgeDays(anchors, '2027-02-15')).toBe(-28);
    expect(correctedAgeDays({}, '2027-04-15')).toBeUndefined();
  });
});

describe('season at birth', () => {
  it('derives the season from the birth date, or the EDD before then', () => {
    expect(seasonAtBirth({ EDD: '2027-03-15' })).toBe('spring');
    expect(seasonAtBirth({ EDD: '2027-01-15' })).toBe('winter');
    expect(seasonAtBirth({ EDD: '2027-07-15' })).toBe('summer');
    expect(seasonAtBirth({ EDD: '2027-10-15' })).toBe('autumn');
    // An actual birth beats the estimate.
    expect(seasonAtBirth({ EDD: '2027-03-15', BIRTH: '2027-02-20' })).toBe('winter');
    expect(seasonAtBirth({})).toBeUndefined();
  });
});
