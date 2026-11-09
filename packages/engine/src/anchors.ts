/**
 * Deriving the anchors every window is measured from.
 *
 * A pregnancy is dated from LMP and corrected by the first ultrasound. Where the
 * two disagree, the ultrasound wins — that is what the clinic uses — and the
 * engine works backwards to an effective LMP so every KB window stays expressed
 * in offsets from one place.
 */

import { addDays, assertIsoDate, diffDays, type IsoDate } from './dates.ts';
import type { Anchors } from './types.ts';

/** Term is 280 days from LMP: 40 weeks. */
export const TERM_DAYS = 280;

export interface PregnancyInput {
  /** First day of the last menstrual period. */
  lmp?: IsoDate;
  /** Estimated due date, ultrasound-corrected if there has been a scan. */
  edd?: IsoDate;
  datingMethod?: 'lmp' | 'ultrasound' | 'ivf_transfer';
  /** Day 0 of an IVF transfer, when that is the dating method. */
  transferDate?: IsoDate;
  /** Day 3 or day 5 embryo. A day-5 transfer is 19 days after the notional LMP. */
  transferDayOfEmbryo?: 3 | 5;
}

/**
 * Anchors for a pregnancy that has not ended yet.
 *
 * Precedence is deliberate: an ultrasound-corrected EDD overrides a remembered
 * LMP, because the scan is what the clinic dates from and an LMP is often an
 * estimate. An IVF transfer is exact, so it wins over both.
 */
export function anchorsFromPregnancy(input: PregnancyInput): Anchors {
  if (input.datingMethod === 'ivf_transfer') {
    if (!input.transferDate) {
      throw new Error('dating_method ivf_transfer needs a transferDate');
    }
    assertIsoDate(input.transferDate, 'transferDate');
    // A day-5 blastocyst is transferred 19 days after the notional LMP
    // (14 days to ovulation + 5), a day-3 embryo 17 days after.
    const offset = (input.transferDayOfEmbryo ?? 5) === 5 ? 19 : 17;
    const lmp = addDays(input.transferDate, -offset);
    return { LMP: lmp, EDD: addDays(lmp, TERM_DAYS) };
  }

  if (input.edd) {
    assertIsoDate(input.edd, 'edd');
    return { LMP: addDays(input.edd, -TERM_DAYS), EDD: input.edd };
  }

  if (input.lmp) {
    assertIsoDate(input.lmp, 'lmp');
    return { LMP: input.lmp, EDD: addDays(input.lmp, TERM_DAYS) };
  }

  return {};
}

export interface ChildInput {
  birthDate: IsoDate;
  /** Completed weeks of gestation at birth. 40 is term. */
  gaAtBirthWeeks?: number;
}

/**
 * Anchors once the baby is here.
 *
 * CORRECTED_BIRTH is the date the baby would have been born at term. For a baby
 * born at 32 weeks it is 8 weeks after the actual birth, and developmental
 * milestones are measured from it, not from the birthday. For a term baby the
 * two are the same date.
 */
export function anchorsFromChild(input: ChildInput): Anchors {
  const birth = assertIsoDate(input.birthDate, 'birthDate');
  const ga = input.gaAtBirthWeeks ?? 40;
  const weeksEarly = Math.max(0, 40 - ga);
  return {
    BIRTH: birth,
    CORRECTED_BIRTH: addDays(birth, weeksEarly * 7),
  };
}

/** Corrected age in whole days. Negative before the corrected birth date. */
export function correctedAgeDays(anchors: Anchors, on: IsoDate): number | undefined {
  if (!anchors.CORRECTED_BIRTH) return undefined;
  return diffDays(anchors.CORRECTED_BIRTH, on);
}

/** Season at the EDD, used by the Things hints and by textile recommendations. */
export function seasonAtBirth(
  anchors: Anchors,
): 'winter' | 'spring' | 'summer' | 'autumn' | undefined {
  const date = anchors.BIRTH ?? anchors.EDD;
  if (!date) return undefined;
  const month = Number(date.slice(5, 7));
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}
