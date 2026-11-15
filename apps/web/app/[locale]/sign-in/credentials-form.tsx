'use client';

/**
 * Email and a password, with sign-up on the same form.
 *
 * A Client Component because it holds one piece of state — which of the two
 * things you are doing — and `useActionState` for the error. Everything else is
 * a plain form post to a server action, so it works before the JavaScript
 * arrives.
 *
 * The gender form is the neutral plural here: nobody is signed in yet, so there
 * is no stored preference to read, and the plural is correct for anyone.
 */

import { MIN_PASSWORD_LENGTH } from '@/lib/schemas/auth.ts';
import { genderValues } from '@/i18n/gender.ts';
import { signInAction, signUpAction, type AuthFormState } from './actions.ts';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

const EMPTY: AuthFormState = {};

export function CredentialsForm({
  locale,
  next,
  startInSignUp = false,
}: {
  locale: string;
  next?: string;
  startInSignUp?: boolean;
}) {
  const t = useTranslations('auth');
  const [signingUp, setSigningUp] = useState(startInSignUp);
  const [state, action, pending] = useActionState(
    signingUp ? signUpAction : signInAction,
    EMPTY,
  );

  return (
    <>
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="locale" value={locale} />
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('email')}</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            dir="ltr"
            className="border-border bg-surface-raised min-h-(--size-tap) rounded-md border px-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('password')}</span>
          <input
            name="password"
            type="password"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            required
            minLength={MIN_PASSWORD_LENGTH}
            dir="ltr"
            className="border-border bg-surface-raised min-h-(--size-tap) rounded-md border px-2"
          />
          <span className="text-text-muted text-sm">{t('passwordHelp')}</span>
        </label>

        {state.errorKey ? (
          <p role="alert" className="text-evidence-weak text-sm font-medium">
            {t(`errors.${state.errorKey}` as 'errors.unknown')}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-on-accent min-h-(--size-tap) rounded-md px-3 font-medium disabled:opacity-60"
        >
          {signingUp
            ? t('signUpSubmit', genderValues())
            : t('signInSubmit', genderValues())}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setSigningUp((was) => !was)}
        className="text-text-muted min-h-(--size-tap) text-start underline"
      >
        {signingUp ? t('toSignIn') : t('toSignUp')}
      </button>
    </>
  );
}
