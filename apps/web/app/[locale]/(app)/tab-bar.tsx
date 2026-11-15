'use client';

/**
 * Today · Checklist · Household.
 *
 * Four tabs are planned for pregnancy (Today · Checklist · Things · Coach) and
 * two of those do not exist yet — Things is roadmap step 8a and Coach step 11.
 * Household takes the third slot meanwhile, because inviting the other parent
 * is the one thing a new household has to be able to find.
 *
 * A Client Component, and it has to be: the earlier version was a Server
 * Component whose comment claimed `aria-current` "comes from next-intl's
 * `<Link>`, which already knows the active pathname". It does not — `Link`
 * only accepts the prop — so all three tabs rendered identically, with no
 * current state for a screen reader or for anyone's eyes. The step-2 landing
 * page had this right and the pattern was lost when it was deleted.
 *
 * `usePathname()` from `i18n/navigation.ts` returns the path without the locale
 * prefix, so the comparison works the same in Hebrew and English.
 */

import { Link } from '@/i18n/navigation.ts';
import { usePathname } from '@/i18n/navigation.ts';
import { useTranslations } from 'next-intl';

const TABS = [
  { href: '/today', key: 'today' },
  { href: '/checklist', key: 'checklist' },
  { href: '/household', key: 'household' },
] as const;

export function TabBar({ locale }: { locale: 'he' | 'en' }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav aria-label={t('label')} className="flex flex-wrap gap-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          locale={locale}
          aria-current={pathname === tab.href ? 'page' : undefined}
          className="border-border bg-surface-raised inline-flex min-h-(--size-tap) items-center rounded-md border px-2 font-medium aria-[current=page]:border-transparent aria-[current=page]:bg-accent aria-[current=page]:text-on-accent"
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}
