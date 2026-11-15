'use client';

/**
 * The checklist, and the one interactive thing in the app.
 *
 * Three decisions worth knowing before changing it:
 *
 * 1. **The tick is optimistic.** `useOptimistic` moves the item the moment it
 *    is tapped, and the server action follows. At 3 a.m. on a phone, a list
 *    that waits for a round trip reads as a list that did not hear you.
 * 2. **Undo, never a confirmation dialog.** packages/ui/CLAUDE.md: act, then
 *    offer to put it back. `timeStatus` is carried on every task so undo can
 *    return an item to the group the window puts it in, with no second request.
 * 3. **Nothing here computes a date.** The window text and its colour come
 *    from `status`, which the engine decided, and the date is rendered by
 *    `formatIsoDate` from @kenn/ui.
 */

import {
  formatIsoDate,
  formatTimestampDate,
  type GenderForm,
  type Locale,
} from '@kenn/ui';
import type { TaskStatus } from '@kenn/engine';
import { genderValues } from '@/i18n/gender.ts';
import type { TaskView } from '@/lib/services/tasks.ts';
import { decideTaskAction } from './actions.ts';
import { useTranslations } from 'next-intl';
import { useOptimistic, startTransition } from 'react';

/** Late first: the list is read top-down and the top is what gets acted on. */
const GROUPS: TaskStatus[] = [
  'overdue',
  'closing',
  'open',
  'upcoming',
  'done',
  'skipped',
  'superseded',
];

const WINDOW_BAR: Record<string, string> = {
  upcoming: 'bg-window-before',
  open: 'bg-window-inside',
  closing: 'bg-window-inside',
  overdue: 'bg-window-after',
  done: 'bg-window-inside',
  skipped: 'bg-window-before',
  superseded: 'bg-window-before',
};

const EVIDENCE_COLOUR: Record<string, string> = {
  guideline: 'text-evidence-strong',
  strong: 'text-evidence-strong',
  moderate: 'text-evidence-moderate',
  weak: 'text-evidence-weak',
  custom: 'text-evidence-custom',
};

interface Decision {
  kbItemId: string;
  decision: 'done' | 'skipped' | 'open';
}

export function TaskList({
  tasks,
  locale,
  genderForm,
  showGroups = GROUPS,
}: {
  tasks: TaskView[];
  locale: Locale;
  genderForm: GenderForm;
  showGroups?: TaskStatus[];
}) {
  const t = useTranslations();
  const [optimistic, decide] = useOptimistic(tasks, applyDecision);

  const byGroup = new Map<TaskStatus, TaskView[]>();
  for (const task of optimistic) {
    if (!showGroups.includes(task.status)) continue;
    byGroup.set(task.status, [...(byGroup.get(task.status) ?? []), task]);
  }

  if (optimistic.length === 0) {
    return <p className="text-text-muted">{t('checklist.empty')}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {showGroups.map((group) => {
        const items = byGroup.get(group) ?? [];
        if (items.length === 0) return null;

        return (
          <section
            key={group}
            aria-labelledby={`group-${group}`}
            className="flex flex-col gap-2"
          >
            <h2 id={`group-${group}`} className="text-lg font-semibold">
              {t(`checklist.group.${group}` as 'checklist.group.open')}
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((task) => (
                <li
                  key={task.kbItemId}
                  className="border-border bg-surface-raised flex flex-col gap-1 rounded-md border p-2"
                >
                  <TaskCard
                    task={task}
                    locale={locale}
                    genderForm={genderForm}
                    onDecide={decide}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function applyDecision(tasks: TaskView[], { kbItemId, decision }: Decision): TaskView[] {
  return tasks.map((task) =>
    task.kbItemId === kbItemId
      ? {
          ...task,
          decision,
          // Undo puts the item back where the window says it belongs, which is
          // why timeStatus travels with every task.
          status: decision === 'open' ? task.timeStatus : decision,
        }
      : task,
  );
}

function TaskCard({
  task,
  locale,
  genderForm,
  onDecide,
}: {
  task: TaskView;
  locale: Locale;
  genderForm: GenderForm;
  onDecide: (decision: Decision) => void;
}) {
  const t = useTranslations();
  const text = task.locales[locale] ?? task.locales.en ?? task.locales.he;
  const decided = task.decision === 'done' || task.decision === 'skipped';

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <h3 className="font-medium">{text?.title ?? task.kbItemId}</h3>
        <span className={`text-sm font-medium ${EVIDENCE_COLOUR[task.evidence] ?? ''}`}>
          {t(`evidence.${task.evidence}` as 'evidence.strong')}
        </span>
      </div>

      {text?.why ? <p className="text-text-muted text-sm">{text.why}</p> : null}

      <p className="numeric text-sm">{windowText(task, locale, t)}</p>
      <span
        aria-hidden="true"
        className={`h-1 rounded-full ${WINDOW_BAR[task.status] ?? 'bg-window-before'}`}
      />

      <div className="text-text-muted flex flex-wrap gap-2 text-sm">
        <span>{t(`tasks.priority.${task.priority}` as 'tasks.priority.important')}</span>
        {task.coverage === 'n/a' ? null : (
          <span>{t(`tasks.coverage.${task.coverage}` as 'tasks.coverage.basket')}</span>
        )}
        {task.guidanceUpdated ? (
          <span className="text-evidence-moderate">{t('tasks.guidanceUpdated')}</span>
        ) : null}
        {task.sources[0] ? (
          <a
            href={task.sources[0]}
            // A source is a government page, and the referrer would otherwise
            // carry the URL of the page a parent was reading.
            rel="noreferrer"
            target="_blank"
            className="underline"
          >
            {t('tasks.source')}
          </a>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1">
        {decided ? (
          <DecisionButton
            task={task}
            decision="open"
            label={
              task.decision === 'done'
                ? t('tasks.undo', genderValues(genderForm))
                : t('tasks.reopen', genderValues(genderForm))
            }
            onDecide={onDecide}
          />
        ) : (
          <>
            <DecisionButton
              task={task}
              decision="done"
              label={t('tasks.markDone', genderValues(genderForm))}
              primary
              onDecide={onDecide}
            />
            <DecisionButton
              task={task}
              decision="skipped"
              label={t('tasks.skip', genderValues(genderForm))}
              onDecide={onDecide}
            />
          </>
        )}
      </div>
    </>
  );
}

function DecisionButton({
  task,
  decision,
  label,
  primary = false,
  onDecide,
}: {
  task: TaskView;
  decision: Decision['decision'];
  label: string;
  primary?: boolean;
  onDecide: (decision: Decision) => void;
}) {
  return (
    <form
      action={(formData: FormData) => {
        startTransition(() => {
          onDecide({ kbItemId: task.kbItemId, decision });
        });
        void decideTaskAction(formData);
      }}
    >
      <input type="hidden" name="kbItemId" value={task.kbItemId} />
      <input type="hidden" name="decision" value={decision} />
      <button
        type="submit"
        className={
          primary
            ? 'bg-accent text-on-accent min-h-(--size-tap) rounded-md px-3 font-medium'
            : 'border-border min-h-(--size-tap) rounded-md border px-3'
        }
      >
        {label}
      </button>
    </form>
  );
}

function windowText(
  task: TaskView,
  locale: Locale,
  t: ReturnType<typeof useTranslations>,
): string {
  if (task.decision === 'done' || task.decision === 'skipped') {
    return t('tasks.doneOn', {
      date: task.decidedAt ? formatTimestampDate(task.decidedAt, locale) : '',
    });
  }
  if (task.status === 'upcoming') {
    return t('window.before', { date: formatIsoDate(task.dueStart, locale) });
  }
  if (task.status === 'overdue') {
    return t('window.after', { date: formatIsoDate(task.dueEnd, locale) });
  }
  return t('window.inside', { date: formatIsoDate(task.dueEnd, locale) });
}
