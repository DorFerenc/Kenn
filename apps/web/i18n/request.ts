/**
 * Per-request i18n configuration.
 *
 * `requestLocale` is the `[locale]` segment, and it can be absent or junk — the
 * segment catches unknown paths such as `/unknown.txt`. `resolveLocale()` from
 * @kenn/ui narrows anything to a supported locale, which is the same function
 * that handles a member whose stored locale is Arabic.
 *
 * Note: next-intl 4.14 marks `requestLocale` deprecated in favour of
 * `next/root-params`. That API generates its types into `.next/types` during a
 * build, so a fresh clone would fail `pnpm typecheck` before it ever built.
 * Staying on the deprecated-but-typed API is the smaller cost; the migration is
 * recorded as open in docs/decisions.md.
 */

import { resolveLocale } from '@kenn/ui';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = resolveLocale(await requestLocale);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Asia/Jerusalem, fixed rather than taken from the browser: both parents
    // plan against Israeli clinic hours, and a phone still set to another zone
    // must not move a window by a day.
    timeZone: 'Asia/Jerusalem',
  };
});
