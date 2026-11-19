'use server';

/**
 * The writes the two screens make.
 *
 * Every one of them: validates with the shared zod schema, goes through the
 * service layer with the signed-in user's JWT, and leaves an `audit_log` row
 * behind (the service does that part). None of them trusts the household id
 * from the form — it is read back from the session, because a hidden input is
 * whatever the browser says it is.
 */

import {
  createCalendarFeedSchema,
  revokeCalendarFeedSchema,
} from '@/lib/schemas/calendar.ts';
import { inviteSchema } from '@/lib/schemas/invite.ts';
import { taskDecisionSchema } from '@/lib/schemas/task.ts';
import { requireUserContext } from '@/lib/services/context.ts';
import { createInvite, revokeInvite } from '@/lib/services/invites.ts';
import { createCalendarFeed, revokeCalendarFeed } from '@/lib/services/calendar.ts';
import { currentHousehold } from '@/lib/services/household.ts';
import { decideTask } from '@/lib/services/tasks.ts';
import { revalidatePath } from 'next/cache';

async function household() {
  const ctx = await requireUserContext();
  const found = await currentHousehold(ctx);
  if (!found) throw new Error('no household');
  return { ctx, householdId: found.id };
}

export async function decideTaskAction(formData: FormData): Promise<void> {
  const parsed = taskDecisionSchema.safeParse({
    kbItemId: formData.get('kbItemId'),
    decision: formData.get('decision'),
    ...(formData.get('note') ? { note: formData.get('note') } : {}),
  });
  if (!parsed.success) throw new Error('invalid task decision');

  const { ctx, householdId } = await household();
  await decideTask(
    ctx,
    householdId,
    parsed.data.kbItemId,
    parsed.data.decision,
    parsed.data.note,
  );

  // Both screens show the same tasks, so both are stale now.
  revalidatePath('/[locale]/(app)/today', 'page');
  revalidatePath('/[locale]/(app)/checklist', 'page');
}

export interface InviteFormState {
  /** The raw token, shown once. Never stored and never logged. */
  token?: string;
  errorKey?: string;
}

export async function createInviteAction(
  _previous: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const parsed = inviteSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { errorKey: 'invalidEmail' };

  const { ctx, householdId } = await household();
  const invite = await createInvite(ctx, householdId, parsed.data.email);

  revalidatePath('/[locale]/(app)/household', 'page');
  return { token: invite.token };
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const inviteId = String(formData.get('inviteId') ?? '');
  if (!/^[0-9a-f-]{36}$/.test(inviteId)) throw new Error('invalid invite id');

  const { ctx, householdId } = await household();
  await revokeInvite(ctx, householdId, inviteId);
  revalidatePath('/[locale]/(app)/household', 'page');
}

export interface CalendarFormState {
  /** The raw feed token, shown once. Never stored and never logged. */
  token?: string;
}

/** The feed is written in the language of the page it was made from. */
export async function createCalendarFeedAction(
  _previous: CalendarFormState,
  formData: FormData,
): Promise<CalendarFormState> {
  const parsed = createCalendarFeedSchema.safeParse({ locale: formData.get('locale') });
  if (!parsed.success) throw new Error('invalid locale');

  const { ctx, householdId } = await household();
  const token = await createCalendarFeed(ctx, householdId, parsed.data.locale);

  revalidatePath('/[locale]/(app)/household', 'page');
  return { token };
}

export async function revokeCalendarFeedAction(formData: FormData): Promise<void> {
  const parsed = revokeCalendarFeedSchema.safeParse({ feedId: formData.get('feedId') });
  if (!parsed.success) throw new Error('invalid feed id');

  // The function checks membership itself; reading the household here keeps
  // the "who is signed in" check in the same place as every other action.
  const { ctx } = await household();
  await revokeCalendarFeed(ctx, parsed.data.feedId);
  revalidatePath('/[locale]/(app)/household', 'page');
}
