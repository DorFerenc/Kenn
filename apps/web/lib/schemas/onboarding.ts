/**
 * The onboarding wizard's answers.
 *
 * The schema is a function of `today`, because the checks worth making are
 * about plausibility rather than shape: an LMP in the future, or eleven months
 * ago, is a typo, and the engine would answer it with a confidently wrong
 * schedule rather than an error. Passing `today` in keeps the one clock in
 * `lib/today.ts` and leaves this file as pure as the engine it feeds.
 */

import { addDays, type IsoDate } from '@kenn/engine';
import { z } from 'zod';

/** 44 weeks. Past this, a pregnancy is not one the app can date. */
const MAX_GESTATION_DAYS = 308;
/** A due date more than 10 months out is a year typed wrong. */
const MAX_EDD_AHEAD_DAYS = 300;

const isoDate = z.string().date();

export function onboardingSchema(today: IsoDate) {
  const earliestLmp = addDays(today, -MAX_GESTATION_DAYS);
  const latestEdd = addDays(today, MAX_EDD_AHEAD_DAYS);

  return z
    .object({
      householdName: z.string().trim().min(1).max(80),
      locale: z.enum(['he', 'en']),
      genderForm: z.enum(['feminine', 'masculine', 'neutral']),

      datingMethod: z.enum(['lmp', 'ultrasound', 'ivf_transfer']),
      lmp: isoDate.optional(),
      edd: isoDate.optional(),
      transferDate: isoDate.optional(),
      fetuses: z.coerce.number().int().min(1).max(4),

      firstborn: z.boolean().optional(),
      /**
       * Tri-state, and the only `applies_if` condition today's KB actually
       * uses: `preg.anti-d` is a critical, guideline-level item that applies to
       * Rh-negative women, and nothing asked — so it could never reach anyone.
       * Found by the review of step 5a reading the KB against the wizard.
       *
       * "Not known" has to stay distinct from "no", because `appliesTo()`
       * treats an unanswered condition as not matching, which is the right
       * behaviour only if the absence is real.
       */
      rhNegative: z.enum(['yes', 'no']).optional(),
      customs: z.enum(['jewish', 'muslim', 'christian', 'druze', 'none']).optional(),
      healthFund: z.enum(['clalit', 'maccabi', 'meuhedet', 'leumit']).optional(),
      hasSupplementary: z.boolean().optional(),
    })
    .superRefine((value, ctx) => {
      // Each dating method needs the date it is named after. The same rule is a
      // check constraint on `pregnancy`, because an anchorless pregnancy shows
      // up as an empty checklist rather than as an error.
      const required = {
        lmp: 'lmp',
        ultrasound: 'edd',
        ivf_transfer: 'transferDate',
      }[value.datingMethod] as 'lmp' | 'edd' | 'transferDate';

      const given = value[required];
      if (!given) {
        ctx.addIssue({
          code: 'custom',
          path: [required],
          message: 'required for this dating method',
        });
        return;
      }

      if (required === 'edd') {
        if (given < today) {
          ctx.addIssue({
            code: 'custom',
            path: ['edd'],
            message: 'a due date cannot be in the past',
          });
        } else if (given > latestEdd) {
          ctx.addIssue({
            code: 'custom',
            path: ['edd'],
            message: 'that due date is too far away',
          });
        }
        return;
      }

      if (given > today) {
        ctx.addIssue({
          code: 'custom',
          path: [required],
          message: 'cannot be in the future',
        });
      } else if (given < earliestLmp) {
        ctx.addIssue({
          code: 'custom',
          path: [required],
          message: 'too long ago to be this pregnancy',
        });
      }
    });
}
