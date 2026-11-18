/**
 * The household's answers to everything `applies_if` can test.
 *
 * Every field is optional and stays that way. `appliesTo()` in @kenn/engine
 * treats a condition the profile cannot answer as not matching, because showing
 * an anti-D item to someone whose Rh is unknown trains them to ignore the list
 * (step 4). So "not asked" must survive the whole way from the column to the
 * engine, and a default anywhere in this file would quietly destroy it.
 */

import type { Profile } from '@kenn/engine';
import { nowTimestamp } from '../today.ts';
import { recordAudit } from './audit.ts';
import type { ServiceContext } from './context.ts';

export type ProfileWrite = Pick<
  Profile,
  | 'firstborn'
  | 'customs'
  | 'health_fund'
  | 'has_supplementary'
  | 'rh_negative'
  | 'sex'
  | 'feeding_intent'
>;

export async function getProfile(
  ctx: ServiceContext,
  householdId: string,
): Promise<ProfileWrite | null> {
  // Filtered by household rather than trusting RLS to leave one row: a person
  // can be a member of more than one household, and an unfiltered read then
  // answers with whichever profile Postgres yields first.
  const { data, error } = await ctx.db
    .from('household_profile')
    .select(
      'firstborn, customs, health_fund, has_supplementary, rh_negative, sex, feeding_intent',
    )
    .eq('household_id', householdId)
    .maybeSingle();

  if (error) throw new Error(`profile read failed: ${error.message}`);
  if (!data) return null;

  // Built key by key rather than spread, so a null column becomes an absent
  // property and never the string "null" or a false that reads as an answer.
  const profile: ProfileWrite = {};
  if (data.firstborn !== null) profile.firstborn = data.firstborn;
  if (data.customs !== null)
    profile.customs = data.customs as NonNullable<Profile['customs']>;
  if (data.health_fund !== null)
    profile.health_fund = data.health_fund as NonNullable<Profile['health_fund']>;
  if (data.has_supplementary !== null) profile.has_supplementary = data.has_supplementary;
  if (data.rh_negative !== null) profile.rh_negative = data.rh_negative;
  if (data.sex !== null) profile.sex = data.sex as NonNullable<Profile['sex']>;
  if (data.feeding_intent !== null) {
    profile.feeding_intent = data.feeding_intent as NonNullable<
      Profile['feeding_intent']
    >;
  }
  return profile;
}

export async function upsertProfile(
  ctx: ServiceContext,
  householdId: string,
  input: ProfileWrite,
): Promise<void> {
  const before = await getProfile(ctx, householdId);

  const { error } = await ctx.db.from('household_profile').upsert(
    {
      household_id: householdId,
      firstborn: input.firstborn ?? null,
      customs: input.customs ?? null,
      health_fund: input.health_fund ?? null,
      has_supplementary: input.has_supplementary ?? null,
      rh_negative: input.rh_negative ?? null,
      sex: input.sex ?? null,
      feeding_intent: input.feeding_intent ?? null,
      updated_at: nowTimestamp(),
    },
    { onConflict: 'household_id' },
  );

  if (error) throw new Error(`profile write failed: ${error.message}`);

  await recordAudit(ctx, householdId, {
    action: before ? 'profile.update' : 'profile.create',
    entity: 'household_profile',
    entityId: householdId,
    before: before ? { ...before } : null,
    after: { ...input },
  });
}

/**
 * The profile the engine sees: the household's answers plus the two facts that
 * are derived rather than asked — how many fetuses, and how the pregnancy is
 * dated.
 */
export function engineProfile(
  profile: ProfileWrite | null,
  pregnancy: { fetuses: number; datingMethod: Profile['dating_method'] } | null,
): Profile {
  const composed: Profile = { ...(profile ?? {}) };
  if (pregnancy) {
    composed.fetuses = pregnancy.fetuses;
    if (pregnancy.datingMethod) composed.dating_method = pregnancy.datingMethod;
  }
  return composed;
}
