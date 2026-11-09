import { dirForLocale, type Locale } from '@kenn/ui';
import { Heebo } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

/**
 * The document shell: `<html>` with the locale's language and direction, the
 * font, and the stylesheet.
 *
 * It exists because two files need it — the locale layout, and the root
 * `not-found.tsx` that catches paths outside the `[locale]` segment. The
 * direction of the document is exactly the kind of fact that must not be
 * stated twice.
 *
 * Heebo: Roboto's Hebrew companion, full Hebrew coverage, nine weights.
 * next/font self-hosts it at build time, so no request leaves the user's
 * browser for a font — which matters for a health app, not just for speed.
 */
const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
});

export function Shell({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={locale} dir={dirForLocale(locale)} className={heebo.variable}>
      <body>{children}</body>
    </html>
  );
}
