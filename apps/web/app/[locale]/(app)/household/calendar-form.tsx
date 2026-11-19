'use client';

/**
 * Make a private calendar link, and show it exactly once.
 *
 * Once, for the same reason as the invite link: only the token's hash is
 * stored, so after this render nothing can produce the link again. Making a
 * new one is the recovery path, and it revokes the old one in the same
 * transaction.
 */

import type { GenderForm, Locale } from '@kenn/ui';
import { genderValues } from '@/i18n/gender.ts';
import {
  createCalendarFeedAction,
  type CalendarFormState,
} from '@/app/[locale]/(app)/actions.ts';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const EMPTY: CalendarFormState = {};

export function CalendarForm({
  locale,
  genderForm,
  hasLiveFeed,
}: {
  locale: Locale;
  genderForm: GenderForm;
  hasLiveFeed: boolean;
}) {
  const t = useTranslations('calendar');
  const [state, action, pending] = useActionState(createCalendarFeedAction, EMPTY);

  const link = state.token
    ? `${typeof window === 'undefined' ? '' : window.location.origin}/api/ics/${state.token}`
    : null;

  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-on-accent min-h-(--size-tap) w-full rounded-md px-3 font-medium disabled:opacity-60"
        >
          {t(hasLiveFeed ? 'rotate' : 'create', genderValues(genderForm))}
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
            onFocus={(event) => event.currentTarget.select()}
            className="border-border bg-surface-raised min-h-(--size-tap) rounded-md border px-2 text-sm"
          />
          <p className="text-text-muted text-sm">{t('howTo')}</p>
        </div>
      ) : null}
    </div>
  );
}
