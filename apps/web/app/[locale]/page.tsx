import { dirForLocale, formatIsoDate, genderForms, isLocale, locales } from '@kenn/ui';
import { genderValues } from '@/i18n/gender.ts';
import { Link } from '@/i18n/navigation.ts';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/**
 * The step-2 harness.
 *
 * This page exists to make the skeleton visible: direction flips with the
 * locale, the Hebrew imperative changes with the gender form, and every colour
 * and space comes from a token. It is **not** a screen — roadmap step 5 replaces
 * it with onboarding and Today, and nothing here is meant to survive that.
 *
 * The date below is a literal because the engine has nothing to compute from
 * yet: anchors come from a household, which needs the service layer. Step 5
 * passes real `materialize()` output through the same formatter.
 */
const SAMPLE_DATE = '2027-03-14';

const WINDOW_STATES = ['before', 'inside', 'after'] as const;

const EVIDENCE_LEVELS = ['strong', 'moderate', 'weak', 'custom'] as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  // `getTranslations`, not `useTranslations`: this component is async, because
  // Next.js 16 made `params` a promise, and a hook cannot be called in one.
  const t = await getTranslations();

  return (
    <main className="mx-auto flex max-w-prose flex-col gap-4 p-3">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{t('app.name')}</h1>
        <p className="text-text-muted">{t('app.tagline')}</p>
      </header>

      <section aria-labelledby="locale-heading" className="flex flex-col gap-1">
        <h2 id="locale-heading" className="text-lg font-semibold">
          {t('locale.label')}
        </h2>
        <nav className="flex flex-wrap gap-1">
          {locales.map((candidate) => (
            <Link
              key={candidate}
              href="/"
              locale={candidate}
              // Each language is labelled in its own name, and carries its own
              // lang and dir: a reader who cannot read the current language is
              // exactly the reader who needs this control, and a screen reader
              // should pronounce each name with the right voice.
              lang={candidate}
              dir={dirForLocale(candidate)}
              aria-current={candidate === locale ? 'page' : undefined}
              className="border-border bg-surface-raised inline-flex min-h-(--size-tap) items-center rounded-md border px-2 aria-[current=page]:border-transparent aria-[current=page]:bg-accent aria-[current=page]:text-on-accent"
            >
              {t(`locale.${candidate}`)}
            </Link>
          ))}
        </nav>
      </section>

      <section aria-labelledby="gender-heading" className="flex flex-col gap-1">
        <h2 id="gender-heading" className="text-lg font-semibold">
          {t('onboarding.genderForm.question')}
        </h2>
        <p className="text-text-muted text-sm">{t('onboarding.genderForm.help')}</p>
        <ul className="flex flex-col gap-1">
          {genderForms.map((form) => (
            <li
              key={form}
              className="border-border bg-surface-raised flex min-h-(--size-tap) items-center justify-between gap-2 rounded-md border px-2"
            >
              <span className="text-text-muted text-sm">
                {t(`onboarding.genderForm.${form}`)}
              </span>
              {/* The same key, three forms. This is the whole point of the
                  gender-form mechanism, so it is on the page rather than only
                  in a test. */}
              <span className="font-medium">
                {t('tasks.markDone', genderValues(form))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="window-heading" className="flex flex-col gap-1">
        <h2 id="window-heading" className="text-lg font-semibold">
          {t('harness.windows')}
        </h2>
        <ul className="flex flex-col gap-1">
          {WINDOW_STATES.map((state) => (
            <li key={state} className="flex flex-col gap-1">
              <span className="text-sm">
                {t(`window.${state}`, {
                  date: formatIsoDate(SAMPLE_DATE, locale),
                })}
              </span>
              {/* Grey before the window opens, green inside it, red after it
                  closed — see packages/ui/CLAUDE.md, "Shape". */}
              <span
                aria-hidden="true"
                className={`h-1 rounded-full ${
                  {
                    before: 'bg-window-before',
                    inside: 'bg-window-inside',
                    after: 'bg-window-after',
                  }[state]
                }`}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="evidence-heading" className="flex flex-col gap-1">
        <h2 id="evidence-heading" className="text-lg font-semibold">
          {t('harness.evidence')}
        </h2>
        <ul className="flex flex-wrap gap-1">
          {EVIDENCE_LEVELS.map((level) => (
            <li
              key={level}
              className={`rounded-full px-2 py-0.5 text-sm font-medium ${
                {
                  strong: 'text-evidence-strong',
                  moderate: 'text-evidence-moderate',
                  weak: 'text-evidence-weak',
                  custom: 'text-evidence-custom',
                }[level]
              }`}
            >
              {t(`evidence.${level}`)}
            </li>
          ))}
        </ul>
      </section>

      <footer className="text-text-muted flex flex-col gap-1 text-sm">
        <p>{t('harness.note')}</p>
        {/* `numeric` keeps a run of digits left-to-right inside Hebrew text. */}
        <p className="numeric">{formatIsoDate(SAMPLE_DATE, locale)}</p>
      </footer>
    </main>
  );
}
