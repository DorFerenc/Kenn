/**
 * Hebrew addresses the reader by gender, so a message that tells someone to do
 * something has three forms: `סמני`, `סמן`, `סמנו`.
 *
 * next-intl 4 removed `defaultTranslationValues`, so the value has to reach
 * every gendered message as an argument. Passing it by hand at each call site
 * is how a screen ends up rendering `tasks.markDone` instead of a verb, so it
 * is passed by one function instead:
 *
 *   t('tasks.markDone', genderValues(member.genderForm))
 *
 * `genderBranch()` in @kenn/ui is what knows the database says `neutral` and
 * ICU spells that branch `other`.
 */

import { genderBranch, type GenderForm } from '@kenn/ui';

/**
 * The neutral plural is the fallback, and it is correct for anyone — which is
 * what makes it the right default on a page with no signed-in member, such as
 * sign-in or a 404. Every authenticated screen passes the member's own choice,
 * read through the service layer.
 */
const DEFAULT_GENDER_FORM: GenderForm = 'neutral';

/** The ICU arguments every gendered message needs. */
export function genderValues(form: GenderForm = DEFAULT_GENDER_FORM) {
  return { genderForm: genderBranch(form) };
}
