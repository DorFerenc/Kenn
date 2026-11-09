/**
 * Hebrew addresses the reader by gender, so a message that tells someone to do
 * something has three forms: `סמני`, `סמן`, `סמנו`.
 *
 * next-intl 4 removed `defaultTranslationValues`, so the value has to reach
 * every gendered message as an argument. Passing it by hand at each call site
 * is how a screen ends up rendering `tasks.markDone` instead of a verb, so it
 * is passed by one function instead:
 *
 *   t('tasks.markDone', genderValues(form))
 *
 * `genderBranch()` in @kenn/ui is what knows the database says `neutral` and
 * ICU spells that branch `other`.
 */

import { genderBranch, type GenderForm } from '@kenn/ui';

/**
 * Until the signed-in member's choice is readable — that needs the service
 * layer, at roadmap step 5 — everyone gets the neutral plural, which is the
 * form that is correct for anyone.
 */
const DEFAULT_GENDER_FORM: GenderForm = 'neutral';

/** The ICU arguments every gendered message needs. */
export function genderValues(form: GenderForm = DEFAULT_GENDER_FORM) {
  return { genderForm: genderBranch(form) };
}
