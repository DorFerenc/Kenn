/**
 * Placeholder module for apps/web.
 *
 * The app itself is built from roadmap step 1 (auth, household, RLS) onward;
 * step 2 adds the i18n skeleton and the design-system tokens. The two locales
 * below are the one thing docs/plan.md fixes for launch, so they live here
 * rather than being invented twice later.
 *
 * Delete this file once app/[locale] has real routes.
 */

export const locales = ['he', 'en'] as const;

export type Locale = (typeof locales)[number];

/** Hebrew is the default: see docs/plan.md, section "Languages". */
export const defaultLocale: Locale = 'he';
