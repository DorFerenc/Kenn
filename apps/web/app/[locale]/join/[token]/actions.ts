'use server';

/**
 * Redeeming an invite link.
 *
 * Every check that matters — unknown token, expired, revoked, already used —
 * happens inside `accept_invite()` in SQL, because the invitee is not a member
 * yet and so cannot even see the invite row. This action cannot widen that
 * window; the most it can do is fail to report the result, so it reports all
 * four failures as one message.
 */

import { inviteTokenSchema } from '@/lib/schemas/invite.ts';
import { requireUserContext } from '@/lib/services/context.ts';
import { acceptInvite } from '@/lib/services/invites.ts';
import { isLocale } from '@kenn/ui';
import { redirect } from 'next/navigation';

export async function acceptInviteAction(formData: FormData): Promise<void> {
  const localeCandidate = String(formData.get('locale') ?? '');
  const locale = isLocale(localeCandidate) ? localeCandidate : 'he';

  const parsed = inviteTokenSchema.safeParse(formData.get('token'));
  if (!parsed.success) redirect(`/${locale}/join/invalid`);

  const ctx = await requireUserContext();
  const result = await acceptInvite(ctx, parsed.data);

  if ('joined' in result) redirect(`/${locale}/today`);

  // `alreadyInAHousehold` is a fact about the reader, so it gets its own page
  // rather than being folded into "this link is not valid" — which would be
  // true of the link and useless to them.
  redirect(
    `/${locale}/join/${result.refused === 'alreadyInAHousehold' ? 'taken' : 'invalid'}`,
  );
}
