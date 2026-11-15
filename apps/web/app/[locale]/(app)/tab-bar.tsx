import { Link } from '@/i18n/navigation.ts';
import { getTranslations } from 'next-intl/server';

/**
 * Today · Checklist · Household.
 *
 * Four tabs are planned for pregnancy (Today · Checklist · Things · Coach) and
 * two of those do not exist yet — Things is roadmap step 8a and Coach step 11.
 * Household takes the third slot meanwhile, because inviting the other parent
 * is the one thing a new household has to be able to find.
 *
 * A Server Component: `aria-current` comes from next-intl's `<Link>`, which
 * already knows the active pathname, so nothing here needs state.
 */
export async function TabBar({ locale }: { locale: string }) {
  const t = await getTranslations('nav');

  const tabs = [
    { href: '/today' as const, label: t('today') },
    { href: '/checklist' as const, label: t('checklist') },
    { href: '/household' as const, label: t('household') },
  ];

  return (
    <nav aria-label={t('today')} className="flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          locale={locale as 'he' | 'en'}
          className="border-border bg-surface-raised inline-flex min-h-(--size-tap) items-center rounded-md border px-2 font-medium"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
