import { isLocale } from '@kenn/ui';
import { CredentialsForm } from '@/app/[locale]/sign-in/credentials-form.tsx';
import { userContext } from '@/lib/services/context.ts';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/** Reads cookies to send a signed-in reader onward, so never prerendered. */
export const dynamic = 'force-dynamic';

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const { next, mode } = await searchParams;

  // Already signed in: nothing to do here.
  const ctx = await userContext();
  if (ctx) redirect(next ?? `/${locale}`);

  const t = await getTranslations('auth');

  return (
    <main className="mx-auto flex min-h-dvh max-w-prose flex-col justify-center gap-4 p-3">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">
          {mode === 'signUp' ? t('signUpTitle') : t('signInTitle')}
        </h1>
        <p className="text-text-muted">{t('subtitle')}</p>
      </header>

      <CredentialsForm
        locale={locale}
        startInSignUp={mode === 'signUp'}
        {...(next ? { next } : {})}
      />
    </main>
  );
}
