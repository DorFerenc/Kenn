import { dirForLocale, isLocale } from '@kenn/ui';
import { routing } from '@/i18n/routing.ts';
import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import '../globals.css';

/**
 * Heebo: Roboto's Hebrew companion, full Hebrew coverage, nine weights.
 * next/font self-hosts it at build time, so no request leaves the user's
 * browser for a font — which matters for a health app, not just for speed.
 */
const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
});

/** Both locales are known at build time, so both prerender. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });
  return { title: t('name'), description: t('tagline') };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  // Request APIs are async in Next.js 16; `params` must be awaited.
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // The [locale] segment catches unknown paths, so an unsupported value here is
  // a 404 rather than a silent fallback: `/fr/today` is not a Kenn page.
  if (!isLocale(locale)) notFound();

  setRequestLocale(locale);

  return (
    <html lang={locale} dir={dirForLocale(locale)} className={heebo.variable}>
      <body>
        {/*
          The provider is not optional once anything client-side touches i18n,
          and next-intl's own <Link> is a Client Component that reads the locale
          from this context. Leaving it out builds cleanly and then fails at
          render with "No intl context found", which is how this comment came to
          be written.
        */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
