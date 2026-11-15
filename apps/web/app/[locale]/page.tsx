import { isLocale } from '@kenn/ui';
import { currentHousehold } from '@/lib/services/household.ts';
import { userContext } from '@/lib/services/context.ts';
import { notFound, redirect } from 'next/navigation';

/**
 * The front door, and nothing else.
 *
 * Roadmap step 2's harness lived here; step 5a replaced it. Signed out, the
 * answer is sign-in; signed in with a household, Today; signed in without one,
 * the wizard.
 *
 * Dynamic because it reads cookies through the service layer. A page under this
 * locale segment inherits a prerenderable shell (`generateStaticParams` is on
 * the layout), and a redirect decided at build time would send one family to
 * another family's answer. `scripts/check-prerender.mjs` asserts that no
 * authenticated route reaches the prerender manifest.
 */
export const dynamic = 'force-dynamic';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const ctx = await userContext();
  if (!ctx) redirect(`/${locale}/sign-in`);

  const household = await currentHousehold(ctx);
  redirect(household ? `/${locale}/today` : `/${locale}/onboarding`);
}
