import { dueNow, gestationalAge } from '@kenn/engine';
import { isLocale } from '@kenn/ui';
import { RealtimeTasks } from '@/app/[locale]/(app)/realtime-tasks.tsx';
import { TaskList } from '@/app/[locale]/(app)/task-list.tsx';
import { Link } from '@/i18n/navigation.ts';
import { requireUserContext } from '@/lib/services/context.ts';
import { currentHouseholdAndMember } from '@/lib/services/household.ts';
import { anchorsOf } from '@/lib/services/anchors.ts';
import { listTasks } from '@/lib/services/tasks.ts';
import { todayInIsrael } from '@/lib/today.ts';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/** Reads a household. See the `dynamic` note in the layout above. */
export const dynamic = 'force-dynamic';

/** Three, because a list of everything due is the Checklist's job. */
const NEXT_UP = 3;

export default async function TodayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations();
  const ctx = await requireUserContext();
  const today = todayInIsrael();

  // Resolved first, because everything below is scoped by the household id:
  // a person can be a member of more than one household, so "the household" is
  // an answer to a query rather than an assumption a read can make.
  const current = await currentHouseholdAndMember(ctx);

  // The layout has already sent anyone without this to onboarding; this is the
  // type narrowing, not a second guard.
  if (!current) notFound();
  const { household, member } = current;

  const [tasks, anchors] = await Promise.all([
    listTasks(ctx, household.id, today),
    anchorsOf(ctx, household.id),
  ]);

  const due = dueNow(tasks).filter((task) => task.decision === null);
  const late = due.filter((task) => task.status === 'overdue');
  const ga = anchors.LMP ? gestationalAge(anchors.LMP, today) : null;

  return (
    <main className="flex flex-col gap-4">
      <RealtimeTasks householdId={household.id} />

      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{t('today.title')}</h1>
        {ga ? (
          <>
            <p className="numeric text-xl font-semibold">
              {t('today.gestation', { weeks: ga.weeks, days: ga.days })}
            </p>
            <p className="text-text-muted text-sm">{t('today.gestationHelp')}</p>
          </>
        ) : (
          <p className="text-text-muted">{t('today.noPregnancy')}</p>
        )}
        {late.length > 0 ? (
          <p className="text-window-after font-medium">
            {t('today.lateCount', { count: late.length })}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="next-up" className="flex flex-col gap-2">
        <h2 id="next-up" className="text-lg font-semibold">
          {t('today.nextUp')}
        </h2>
        {due.length === 0 ? (
          <p className="text-text-muted">{t('today.nothingDue')}</p>
        ) : (
          <TaskList
            tasks={due.slice(0, NEXT_UP)}
            locale={locale}
            genderForm={member.genderForm}
            showGroups={['overdue', 'closing', 'open']}
          />
        )}
      </section>

      <Link href="/checklist" locale={locale} className="underline">
        {t('today.seeAll')}
      </Link>
    </main>
  );
}
