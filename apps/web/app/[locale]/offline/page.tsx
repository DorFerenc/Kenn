import { isLocale } from '@kenn/ui';
import { RetryButton } from '@/app/[locale]/offline/retry-button.tsx';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/**
 * What the service worker shows when a page cannot be fetched (step 6a).
 *
 * It says nothing about the household on purpose: it is precached on install
 * and served for any page while offline, so it must hold nothing that belongs
 * to anyone. Rendered per request rather than prerendered, because a page
 * without this request's CSP nonce cannot run its one script.
 */
export default async function OfflinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await connection();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('offline');

  return (
    <main className="mx-auto flex min-h-dvh max-w-prose flex-col justify-center gap-3 p-3">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="text-text-muted">{t('body')}</p>
      <RetryButton />
    </main>
  );
}
