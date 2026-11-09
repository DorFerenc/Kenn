/**
 * @kenn/ui — design tokens, RTL helpers and the locale vocabulary.
 *
 * The tokens themselves are CSS, not TypeScript: `src/tokens.css` is the single
 * source of truth and the app imports it. Nothing here re-states a colour or a
 * spacing value, so nothing here can disagree with it.
 *
 * shadcn/ui components arrive at roadmap step 5, with the first screen that
 * needs one.
 */

export { AA, contrastRatio, isHex, luminance, type Hex } from './contrast.ts';

export {
  defaultLocale,
  dirForLocale,
  genderBranch,
  genderForms,
  isGenderForm,
  isLocale,
  locales,
  resolveGenderForm,
  resolveLocale,
  type Direction,
  type GenderForm,
  type Locale,
} from './locales.ts';

export { formatIsoDate } from './format.ts';
