import { defaultLocale, dirForLocale, resolveLocale } from '@kenn/ui';
import { genderValues } from '@/i18n/gender.ts';
import { useLocale, useTranslations } from 'next-intl';

/**
 * The shared body of both 404 pages. The root one renders outside any locale
 * segment and cannot use the hooks, so it passes its strings in.
 *
 * It carries its own `lang` and `dir`. Everywhere else in the app those come
 * from `<html>`, but a `notFound()` boundary renders inside Next's own error
 * document when the root layout is a dynamic segment — and that document has
 * neither, so Hebrew would lay out left-to-right. `dir` is valid on any
 * element, so the fragment states it rather than relying on an ancestor it
 * cannot see.
 *
 * The link is a plain anchor rather than next-intl's `<Link>`, which is the
 * one place in the app that is right: `<Link>` is a Client Component that
 * reads the locale from context, and a 404 may render without that context.
 * An error page that depends on less is an error page that works.
 */
export function NotFoundBody({
  title,
  body,
  action,
  locale = defaultLocale,
}: {
  title: string;
  body: string;
  action: string;
  locale?: string;
}) {
  const resolved = resolveLocale(locale);
  return (
    <main
      lang={resolved}
      dir={dirForLocale(resolved)}
      className="mx-auto flex min-h-dvh max-w-prose flex-col justify-center gap-2 p-3"
    >
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-text-muted">{body}</p>
      <a
        href={`/${locale}`}
        className="bg-accent text-on-accent inline-flex min-h-(--size-tap) items-center justify-center rounded-md px-3 font-medium"
      >
        {action}
      </a>
    </main>
  );
}

/** The 404 for a path inside a known locale, reached via `[...rest]`. */
export default function NotFound() {
  const t = useTranslations('errors');
  const locale = useLocale();

  return (
    <NotFoundBody
      locale={locale}
      title={t('notFoundTitle')}
      body={t('notFoundBody')}
      action={t('backHome', genderValues())}
    />
  );
}
