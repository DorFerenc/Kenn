/**
 * The household and its members.
 *
 * Two bootstrap holes are closed in the database rather than here, and this
 * file calls those functions instead of inserting rows: `create_household()`
 * exists because `with check (is_member(id))` makes the first insert
 * impossible, and `accept_invite()` exists because an invitee is not yet a
 * member and cannot see the invite row. Both are SECURITY DEFINER with a pinned
 * search_path, and both check their preconditions in SQL, so a bug in this file
 * cannot widen them (step 1).
 */

import { resolveGenderForm, resolveLocale, type GenderForm, type Locale } from '@kenn/ui';
import { recordAudit } from './audit.ts';
import type { ServiceContext } from './context.ts';

export interface Member {
  householdId: string;
  userId: string;
  role: 'owner' | 'family' | 'caregiver';
  /** Narrowed to a locale the UI translates: the column admits `ar` and `ru`. */
  locale: Locale;
  genderForm: GenderForm;
}

export interface Household {
  id: string;
  name: string;
  country: string;
  defaultLocale: Locale;
}

/**
 * The household the signed-in user belongs to, or null before onboarding.
 *
 * One household per person in v1. RLS already limits the rows to theirs, so
 * this is not a `where` clause the app has to remember — which is the point of
 * putting the boundary in the database.
 */
export async function currentHousehold(ctx: ServiceContext): Promise<Household | null> {
  const { data, error } = await ctx.db
    .from('household')
    .select('id, name, country, default_locale')
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`household read failed: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    country: data.country,
    defaultLocale: resolveLocale(data.default_locale),
  };
}

/** The signed-in user's own membership row: their language and gender form. */
export async function currentMember(ctx: ServiceContext): Promise<Member | null> {
  if (!ctx.actor.userId) return null;

  const { data, error } = await ctx.db
    .from('member')
    .select('household_id, user_id, role, locale, gender_form')
    .eq('user_id', ctx.actor.userId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`member read failed: ${error.message}`);
  if (!data) return null;
  return toMember(data);
}

/** Everyone in the household, so Today can say who ticked what. */
export async function householdMembers(ctx: ServiceContext): Promise<Member[]> {
  const { data, error } = await ctx.db
    .from('member')
    .select('household_id, user_id, role, locale, gender_form')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`member list failed: ${error.message}`);
  return (data ?? []).map(toMember);
}

function toMember(row: {
  household_id: string;
  user_id: string;
  role: string;
  locale: string;
  gender_form: string;
}): Member {
  return {
    householdId: row.household_id,
    userId: row.user_id,
    role: row.role as Member['role'],
    locale: resolveLocale(row.locale),
    genderForm: resolveGenderForm(row.gender_form),
  };
}

/**
 * Create the household and make the caller its owner, in one transaction in the
 * database. Returns the new household id.
 */
export async function createHousehold(
  ctx: ServiceContext,
  name: string,
  locale: Locale,
): Promise<string> {
  const { data, error } = await ctx.db.rpc('create_household', {
    p_name: name,
    p_locale: locale,
  });

  if (error) throw new Error(`create_household failed: ${error.message}`);
  const householdId = data as unknown as string;

  await recordAudit(ctx, householdId, {
    action: 'household.create',
    entity: 'household',
    entityId: householdId,
    after: { name, locale },
  });

  return householdId;
}

/**
 * The member's own language and how Hebrew should address them.
 *
 * Per member, not per household: one parent can read Hebrew and the other
 * English, which is the case the UI must get right and the easiest one to
 * forget to test (step 1).
 */
export async function updateMemberPreferences(
  ctx: ServiceContext,
  householdId: string,
  preferences: { locale: Locale; genderForm: GenderForm },
): Promise<void> {
  if (!ctx.actor.userId)
    throw new Error('updateMemberPreferences needs a signed-in user');

  const { error } = await ctx.db
    .from('member')
    .update({ locale: preferences.locale, gender_form: preferences.genderForm })
    .eq('household_id', householdId)
    .eq('user_id', ctx.actor.userId);

  if (error) throw new Error(`member update failed: ${error.message}`);

  await recordAudit(ctx, householdId, {
    action: 'member.preferences',
    entity: 'member',
    entityId: ctx.actor.userId,
    after: { locale: preferences.locale, gender_form: preferences.genderForm },
  });
}
