import { isLocale } from '@kenn/ui';
import { TabBar } from '@/app/[locale]/(app)/tab-bar.tsx';
import { signOutAction } from '@/app/[locale]/sign-in/actions.ts';
import { userContext } from '@/lib/services/context.ts';
import { currentHouseholdAndMember } from '@/lib/services/household.ts';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

/**
 * The signed-in shell: the guard, the tab bar, and nothing a household owns.
 *
 * `force-dynamic` is the rule apps/web/CLAUDE.md states and this is the segment
 * it was written for. The locale layout above exports `generateStaticParams`,
 * which is right for a public shell; a household route that inherited it would
 * let Next bake one family's health data into a build artefact served to
 * everyone. `scripts/check-prerender.mjs` fails the gate if any route under
 * here reaches the prerender manifest, because a comment is not a guarantee.
 */
export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const ctx = await userContext();
  if (!ctx) redirect(`/${locale}/sign-in`);

  // Signed in but not onboarded: there are no anchors, so every screen below
  // would be empty and give no reason why.
  if (!(await currentHouseholdAndMember(ctx))) redirect(`/${locale}/onboarding`);

  const t = await getTranslations('common');

  return (
    <div className="mx-auto flex min-h-dvh max-w-prose flex-col">
      <div className="flex-1 p-3">{children}</div>

      <footer className="border-border flex items-center justify-between gap-2 border-t p-3">
        <TabBar locale={locale} />
        <form action={signOutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="text-text-muted min-h-(--size-tap) px-2 text-sm underline"
          >
            {t('signOut')}
          </button>
        </form>
      </footer>
    </div>
  );
}
