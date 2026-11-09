import { Link } from '@/i18n/navigation.ts';
import { genderValues } from '@/i18n/gender.ts';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('errors');

  return (
    <main className="mx-auto flex min-h-dvh max-w-prose flex-col justify-center gap-2 p-3">
      <h1 className="text-2xl font-bold">{t('notFoundTitle')}</h1>
      <p className="text-text-muted">{t('notFoundBody')}</p>
      <Link
        href="/"
        className="bg-accent text-on-accent inline-flex min-h-(--size-tap) items-center justify-center rounded-md px-3 font-medium"
      >
        {t('backHome', genderValues())}
      </Link>
    </main>
  );
}
