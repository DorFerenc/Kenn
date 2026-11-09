import { isLocale } from '@kenn/ui';
import { Shell } from '@/app/shell.tsx';
import { routing } from '@/i18n/routing.ts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

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

  // The [locale] segment catches unknown paths, so an unsupported value here
  // is a 404 rather than a silent fallback. `app/not-found.tsx` is what
  // renders then — the boundary is looked for *above* the segment that threw,
  // so a not-found inside this folder would never be reached.
  if (!isLocale(locale)) notFound();

  setRequestLocale(locale);

  return (
    <Shell locale={locale}>
      {/*
        The provider is not optional once anything client-side touches i18n,
        and next-intl's own <Link> is a Client Component that reads the locale
        from this context. Leaving it out builds cleanly and then fails at
        render with "No intl context found", which is how this comment came to
        be written.
      */}
      <NextIntlClientProvider>{children}</NextIntlClientProvider>
    </Shell>
  );
}
