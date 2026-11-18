'use client';

/**
 * Make an invite link, and show it exactly once.
 *
 * Once is not a UX flourish: only the SHA-256 hash of the token is stored
 * (step 1), so after this render nothing — not this app, not a database dump —
 * can produce the link again. Revoking and making a new one is the recovery
 * path, which is the property that makes a leaked link survivable.
 */

import type { GenderForm } from '@kenn/ui';
import { genderValues } from '@/i18n/gender.ts';
import {
  createInviteAction,
  type InviteFormState,
} from '@/app/[locale]/(app)/actions.ts';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const EMPTY: InviteFormState = {};

export function InviteForm({
  locale,
  genderForm,
}: {
  locale: string;
  genderForm: GenderForm;
}) {
  const t = useTranslations('household.invite');
  const [state, action, pending] = useActionState(createInviteAction, EMPTY);

  const link = state.token
    ? `${typeof window === 'undefined' ? '' : window.location.origin}/${locale}/join/${state.token}`
    : null;

  return (
    <div className="flex flex-col gap-2">
      <form action={action} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('email')}</span>
          <input
            name="email"
            type="email"
            required
            dir="ltr"
            className="border-border bg-surface-raised min-h-(--size-tap) rounded-md border px-2"
          />
        </label>

        {state.errorKey ? (
          <p role="alert" className="text-evidence-weak text-sm font-medium">
            {t('invalidEmail')}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-on-accent min-h-(--size-tap) rounded-md px-3 font-medium disabled:opacity-60"
        >
          {t('create', genderValues(genderForm))}
        </button>
      </form>

      {link ? (
        <div className="border-border flex flex-col gap-1 rounded-md border p-2">
          <h3 className="font-medium">{t('linkTitle')}</h3>
          <p className="text-text-muted text-sm">{t('linkHelp')}</p>
          <input
            readOnly
            value={link}
            dir="ltr"
            aria-label={t('linkTitle')}
            // Selected on focus, because the one thing to do with it is copy
            // it — and `navigator.clipboard` is not available over plain HTTP
            // on another device on the network, which is how this gets used.
            onFocus={(event) => event.currentTarget.select()}
            className="border-border bg-surface-raised min-h-(--size-tap) rounded-md border px-2 text-sm"
          />
        </div>
      ) : null}
    </div>
  );
}
