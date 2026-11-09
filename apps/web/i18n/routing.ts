/**
 * Locale routing: `/he` and `/en`, Hebrew by default.
 *
 * The locale list comes from @kenn/ui rather than being restated here, so the
 * app, the direction helper and anything added later cannot disagree about
 * which languages exist.
 */

import { defaultLocale, locales } from '@kenn/ui';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Always prefix, including the default. `/he/today` and `/en/today` both read
  // as real URLs, which matters for a link a parent sends to the other parent.
  localePrefix: 'always',
});
