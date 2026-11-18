import { isLocale } from '@kenn/ui';
import { Wizard } from '@/app/[locale]/onboarding/wizard.tsx';
import { userContext } from '@/lib/services/context.ts';
import { currentHousehold } from '@/lib/services/household.ts';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/** Reads cookies. See the `dynamic` note in the app layout. */
export const dynamic = 'force-dynamic';

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const ctx = await userContext();
  if (!ctx) redirect(`/${locale}/sign-in?next=/${locale}/onboarding`);

  // A second household would orphan the first, so onboarding is a one-way
  // door: once there is a household, this page is Today.
  const household = await currentHousehold(ctx);
  if (household) redirect(`/${locale}/today`);

  const t = await getTranslations('onboarding');

  return (
    <main className="mx-auto flex min-h-dvh max-w-prose flex-col gap-4 p-3">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-text-muted">{t('subtitle')}</p>
      </header>

      <Wizard locale={locale} />
    </main>
  );
}
