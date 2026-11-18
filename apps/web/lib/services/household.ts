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
import { assertHuman, type ServiceContext } from './context.ts';

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
 * The signed-in user's own membership: which household, and how to address them.
 *
 * This is the one query that resolves "the household", and everything else
 * takes the id from it. The reason is a bug the review of step 5a found by
 * driving the app: nothing stops a person being a member of two households —
 * `member`'s key is `(household_id, user_id)` and, until this step,
 * `accept_invite()` would happily add a second — and every read here assumed
 * exactly one. A parent who onboarded their own household and then accepted a
 * partner's invite saw the partner's pregnancy on Today, their own record
 * unreachable, and three members in a two-person household.
 *
 * RLS is not what was wrong: such a person is a legitimate member of both. The
 * app was treating a set as a singleton. `accept_invite()` now refuses a second
 * household (migration `20261115…_one_household_per_person`), and the reads are
 * scoped by the id this function returns, which is the half that stays correct
 * when step 15 adds a second household on purpose.
 *
 * Ordered by the **membership's** `created_at`, not the household's: the
 * question is which household this person joined first, and a partner's
 * household can easily be older than their own.
 */
async function currentMember(ctx: ServiceContext): Promise<Member | null> {
  if (!ctx.actor.userId) return null;

  const { data, error } = await ctx.db
    .from('member')
    .select('household_id, user_id, role, locale, gender_form')
    .eq('user_id', ctx.actor.userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`member read failed: ${error.message}`);
  if (!data) return null;
  return toMember(data);
}

/** The household the signed-in user belongs to, or null before onboarding. */
export async function currentHousehold(ctx: ServiceContext): Promise<Household | null> {
  const member = await currentMember(ctx);
  if (!member) return null;

  const { data, error } = await ctx.db
    .from('household')
    .select('id, name, country, default_locale')
    .eq('id', member.householdId)
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

/** Everyone in one household, so Today can say who ticked what. */
export async function householdMembers(
  ctx: ServiceContext,
  householdId: string,
): Promise<Member[]> {
  const { data, error } = await ctx.db
    .from('member')
    .select('household_id, user_id, role, locale, gender_form')
    .eq('household_id', householdId)
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
  assertHuman(ctx, 'creating a household');

  const { data, error } = await ctx.db.rpc('create_household', {
    p_name: name,
    p_locale: locale,
  });

  if (error) throw new Error(`create_household failed: ${error.message}`);
  const householdId = data;

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

  // The affected row is read back: a write RLS turns into a no-op returns no
  // error, and an audit row for a change that did not happen is worse than no
  // audit row.
  const { data, error } = await ctx.db
    .from('member')
    .update({ locale: preferences.locale, gender_form: preferences.genderForm })
    .eq('household_id', householdId)
    .eq('user_id', ctx.actor.userId)
    .select('user_id');

  if (error) throw new Error(`member update failed: ${error.message}`);
  if (!data || data.length === 0) throw new Error('member update affected no rows');

  await recordAudit(ctx, householdId, {
    action: 'member.preferences',
    entity: 'member',
    entityId: ctx.actor.userId,
    after: { locale: preferences.locale, gender_form: preferences.genderForm },
  });
}

export interface HouseholdAndMember {
  household: Household;
  member: Member;
}

/**
 * Both halves of "who is asking, and about which household", resolved once.
 *
 * Every authenticated screen needs the household id to scope its reads and the
 * member to address the reader in the right Hebrew, and resolving them
 * separately meant two queries for the membership and an opportunity for the
 * two answers to disagree. One function, one answer.
 */
export async function currentHouseholdAndMember(
  ctx: ServiceContext,
): Promise<HouseholdAndMember | null> {
  const member = await currentMember(ctx);
  if (!member) return null;

  const { data, error } = await ctx.db
    .from('household')
    .select('id, name, country, default_locale')
    .eq('id', member.householdId)
    .maybeSingle();

  if (error) throw new Error(`household read failed: ${error.message}`);
  if (!data) return null;

  return {
    member,
    household: {
      id: data.id,
      name: data.name,
      country: data.country,
      defaultLocale: resolveLocale(data.default_locale),
    },
  };
}
