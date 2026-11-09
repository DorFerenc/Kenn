/**
 * The locales Kenn's interface speaks, and the direction each one reads in.
 *
 * This lives in @kenn/ui rather than in the app because direction is a UI
 * concern and because the app, the share pages and any later surface must all
 * agree on it. It is plain data and three pure functions: no Next.js, no
 * next-intl, nothing to mock.
 */

/** A locale the interface is translated into. Hebrew first; see docs/plan.md. */
export const locales = ['he', 'en'] as const;

export type Locale = (typeof locales)[number];

/** Hebrew is the default: see docs/plan.md, section "Languages". */
export const defaultLocale: Locale = 'he';

/**
 * How Hebrew addresses the reader. Mirrors `member.gender_form` in the schema,
 * where the values are checked by the database.
 *
 * ICU `select` spells its fallback branch `other`, so `neutral` maps onto
 * `other` in a message. `genderBranch()` is that mapping, in one place.
 */
export const genderForms = ['feminine', 'masculine', 'neutral'] as const;

export type GenderForm = (typeof genderForms)[number];

export type Direction = 'rtl' | 'ltr';

const DIRECTIONS: Record<Locale, Direction> = {
  he: 'rtl',
  en: 'ltr',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

export function dirForLocale(locale: Locale): Direction {
  return DIRECTIONS[locale];
}

/**
 * Narrow anything to a supported locale.
 *
 * The database is deliberately wider than the interface: `member.locale` admits
 * `ar` and `ru` because Arabic and Russian are planned (Gate C), and a row can
 * carry one before a single string is translated. A member who set Arabic must
 * still get a usable screen, so an unsupported value resolves to the default
 * instead of throwing or rendering empty.
 */
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale;
}

export function isGenderForm(value: unknown): value is GenderForm {
  return typeof value === 'string' && (genderForms as readonly string[]).includes(value);
}

/** The ICU `select` branch a gender form is written as. */
export function genderBranch(form: GenderForm): 'feminine' | 'masculine' | 'other' {
  return form === 'neutral' ? 'other' : form;
}

/** Narrow anything to a gender form, defaulting to the neutral plural. */
export function resolveGenderForm(value: unknown): GenderForm {
  return isGenderForm(value) ? value : 'neutral';
}
