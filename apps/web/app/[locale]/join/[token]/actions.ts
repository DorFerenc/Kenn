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
  const joined = await acceptInvite(ctx, parsed.data);

  // A token that did not redeem sends the reader back to a page that says so,
  // rather than to a household they are not in.
  redirect(joined ? `/${locale}/today` : `/${locale}/join/invalid`);
}
