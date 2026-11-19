'use client';

import { useTranslations } from 'next-intl';

/**
 * Reload the address the visitor asked for. The worker served this page in
 * place of that one, so a reload is a fresh try at the real page, not at this.
 *
 * Neutral plural, deliberately: the offline page knows nobody, so it cannot
 * know how a member asked to be addressed.
 */
export function RetryButton() {
  const t = useTranslations('offline');
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="bg-accent text-on-accent min-h-(--size-tap) rounded-md px-3 font-medium"
    >
      {t('retry', { genderForm: 'other' })}
    </button>
  );
}
