import { formatTimestampDate, isLocale } from '@kenn/ui';
import { InviteForm } from '@/app/[locale]/(app)/household/invite-form.tsx';
import { CalendarForm } from '@/app/[locale]/(app)/household/calendar-form.tsx';
import {
  revokeCalendarFeedAction,
  revokeInviteAction,
} from '@/app/[locale]/(app)/actions.ts';
import { listCalendarFeeds } from '@/lib/services/calendar.ts';
import { requireUserContext } from '@/lib/services/context.ts';
import { currentHouseholdAndMember, householdMembers } from '@/lib/services/household.ts';
import { listInvites } from '@/lib/services/invites.ts';
import { genderValues } from '@/i18n/gender.ts';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

/** Reads a household. See the `dynamic` note in the layout above. */
export const dynamic = 'force-dynamic';

export default async function HouseholdPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('household');
  const ctx = await requireUserContext();

  const current = await currentHouseholdAndMember(ctx);
  if (!current) notFound();
  const { household, member: me } = current;

  const [members, invites, feeds] = await Promise.all([
    householdMembers(ctx, household.id),
    listInvites(ctx, household.id),
    listCalendarFeeds(ctx, household.id),
  ]);
  const tc = await getTranslations('calendar');

  // The caller's own live feed: each parent subscribes their own calendar.
  const myFeed = feeds.find((feed) => feed.createdBy === me.userId && !feed.revokedAt);

  const open = invites.filter((invite) => !invite.acceptedAt && !invite.revokedAt);

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-text-muted">{household.name}</p>
      </header>

      <section aria-labelledby="members" className="flex flex-col gap-2">
        <h2 id="members" className="text-lg font-semibold">
          {t('members')}
        </h2>
        <ul className="flex flex-col gap-1">
          {members.map((member) => (
            <li
              key={member.userId}
              className="border-border bg-surface-raised flex min-h-(--size-tap) items-center justify-between gap-2 rounded-md border px-2"
            >
              <span>{t(`role.${member.role}` as 'role.owner')}</span>
              {member.userId === me.userId ? (
                <span className="text-text-muted text-sm">
                  {t('you', genderValues(me.genderForm))}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="invite" className="flex flex-col gap-2">
        <h2 id="invite" className="text-lg font-semibold">
          {t('invite.title')}
        </h2>
        <p className="text-text-muted text-sm">{t('invite.help')}</p>

        <InviteForm locale={locale} genderForm={me.genderForm} />

        {open.length === 0 ? (
          <p className="text-text-muted text-sm">{t('invite.none')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {open.map((invite) => (
              <li
                key={invite.id}
                className="border-border flex min-h-(--size-tap) flex-wrap items-center justify-between gap-2 rounded-md border px-2"
              >
                <span dir="ltr" className="numeric text-sm">
                  {t('invite.pending', { email: invite.email })}
                </span>
                <form action={revokeInviteAction}>
                  <input type="hidden" name="inviteId" value={invite.id} />
                  <button
                    type="submit"
                    className="min-h-(--size-tap) px-2 text-sm underline"
                  >
                    {t('invite.revoke', genderValues(me.genderForm))}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="calendar" className="flex flex-col gap-2">
        <h2 id="calendar" className="text-lg font-semibold">
          {tc('title')}
        </h2>
        <p className="text-text-muted text-sm">{tc('help')}</p>
        <p className="border-border bg-surface-sunken rounded-md border p-2 text-sm">
          {tc('privacy')}
        </p>

        {myFeed ? (
          <div className="border-border flex min-h-(--size-tap) flex-wrap items-center justify-between gap-2 rounded-md border px-2">
            <span className="text-sm">
              {tc('active', {
                created: formatTimestampDate(myFeed.createdAt, locale),
                expires: formatTimestampDate(myFeed.expiresAt, locale),
              })}
            </span>
            <form action={revokeCalendarFeedAction}>
              <input type="hidden" name="feedId" value={myFeed.id} />
              <button type="submit" className="min-h-(--size-tap) px-2 text-sm underline">
                {tc('revoke', genderValues(me.genderForm))}
              </button>
            </form>
          </div>
        ) : (
          <p className="text-text-muted text-sm">{tc('none')}</p>
        )}

        <CalendarForm
          locale={locale}
          genderForm={me.genderForm}
          hasLiveFeed={myFeed !== undefined}
        />
      </section>
    </main>
  );
}
