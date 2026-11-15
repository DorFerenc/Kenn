import { isLocale } from '@kenn/ui';
import { RealtimeTasks } from '@/app/[locale]/(app)/realtime-tasks.tsx';
import { TaskList } from '@/app/[locale]/(app)/task-list.tsx';
import { requireUserContext } from '@/lib/services/context.ts';
import { currentHouseholdAndMember } from '@/lib/services/household.ts';
import { listTasks } from '@/lib/services/tasks.ts';
import { todayInIsrael } from '@/lib/today.ts';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/** Reads a household. See the `dynamic` note in the layout above. */
export const dynamic = 'force-dynamic';

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations();
  const ctx = await requireUserContext();

  const current = await currentHouseholdAndMember(ctx);
  if (!current) notFound();
  const { household, member } = current;

  const tasks = await listTasks(ctx, household.id, todayInIsrael());

  return (
    <main className="flex flex-col gap-4">
      <RealtimeTasks householdId={household.id} />

      <h1 className="text-3xl font-bold">{t('checklist.title')}</h1>

      <TaskList tasks={tasks} locale={locale} genderForm={member.genderForm} />
    </main>
  );
}
