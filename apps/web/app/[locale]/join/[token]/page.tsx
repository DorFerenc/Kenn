import { isLocale } from '@kenn/ui';
import { acceptInviteAction } from '@/app/[locale]/join/[token]/actions.ts';
import { inviteTokenSchema } from '@/lib/schemas/invite.ts';
import { userContext } from '@/lib/services/context.ts';
import { genderValues } from '@/i18n/gender.ts';
import { Link } from '@/i18n/navigation.ts';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/** Reads cookies, and must never be cached: the token is in the URL. */
export const dynamic = 'force-dynamic';

export default async function JoinPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('join');

  // `/join/invalid` and `/join/taken` are the two places the action redirects
  // to, and they arrive here as the token segment — so they are answers, not
  // tokens, and each gets its own sentence.
  const outcome = token === 'invalid' || token === 'taken' ? token : null;

  // Shape first, so a junk path never reaches accept_invite() — and so the
  // reader is told the same thing whether the link was malformed or simply
  // wrong. Which of the two it was is a fact about a household they are not in.
  const wellFormed = outcome === null && inviteTokenSchema.safeParse(token).success;

  const ctx = await userContext();
  if (!ctx) {
    // Sign in, then come back here — but only carry a token that is the right
    // shape, so nothing arbitrary from the URL is reflected into a query
    // string. The token stays in the path either way, which is why
    // Referrer-Policy is set in next.config.ts.
    redirect(
      wellFormed
        ? `/${locale}/sign-in?next=/${locale}/join/${token}`
        : `/${locale}/sign-in`,
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-prose flex-col justify-center gap-4 p-3">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-text-muted">{t('body')}</p>
      </header>

      {outcome ? (
        <p role="alert" className="text-evidence-weak font-medium">
          {t(outcome)}
        </p>
      ) : wellFormed ? (
        <form action={acceptInviteAction} className="flex flex-col gap-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="bg-accent text-on-accent min-h-(--size-tap) rounded-md px-3 font-medium"
          >
            {t('accept', genderValues())}
          </button>
        </form>
      ) : (
        <p role="alert" className="text-evidence-weak font-medium">
          {t('invalid')}
        </p>
      )}

      <Link href="/" locale={locale} className="text-text-muted underline">
        {t('signInFirst')}
      </Link>
    </main>
  );
}
