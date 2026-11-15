'use server';

/**
 * The wizard's one write.
 *
 * Four steps, one transaction-shaped sequence: create the household (which
 * makes the caller its owner, in SQL), store the member's own language and
 * gender form, store the anchors, store the profile. Validated here with the
 * same schema the form used, because the browser's copy of the rules is a
 * convenience.
 */

import { onboardingSchema } from '@/lib/schemas/onboarding.ts';
import { requireUserContext } from '@/lib/services/context.ts';
import {
  createHousehold,
  currentHousehold,
  updateMemberPreferences,
} from '@/lib/services/household.ts';
import { upsertPregnancy } from '@/lib/services/pregnancy.ts';
import { upsertProfile } from '@/lib/services/profile.ts';
import { todayInIsrael } from '@/lib/today.ts';
import type { IsoDate } from '@kenn/engine';
import { redirect } from 'next/navigation';

export interface OnboardingState {
  errorKey?: string;
}

/** A checkbox is absent when unticked, which is not the same as `false`. */
function optionalBoolean(formData: FormData, name: string): boolean | undefined {
  const raw = formData.get(name);
  if (raw === null) return undefined;
  return raw === 'on' || raw === 'true';
}

function optionalString(formData: FormData, name: string): string | undefined {
  const raw = formData.get(name);
  if (raw === null) return undefined;
  const value = String(raw).trim();
  return value === '' ? undefined : value;
}

export async function completeOnboardingAction(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const today = todayInIsrael();

  const parsed = onboardingSchema(today).safeParse({
    householdName: formData.get('householdName'),
    locale: formData.get('locale'),
    genderForm: formData.get('genderForm'),
    datingMethod: formData.get('datingMethod'),
    lmp: optionalString(formData, 'lmp'),
    edd: optionalString(formData, 'edd'),
    transferDate: optionalString(formData, 'transferDate'),
    fetuses: formData.get('fetuses'),
    firstborn: optionalBoolean(formData, 'firstborn'),
    customs: optionalString(formData, 'customs'),
    healthFund: optionalString(formData, 'healthFund'),
    hasSupplementary: optionalBoolean(formData, 'hasSupplementary'),
  });

  if (!parsed.success) return { errorKey: 'invalid' };
  const input = parsed.data;

  const ctx = await requireUserContext();

  // Onboarding twice would otherwise make a second household and leave the
  // first one unreachable: one household per person in v1.
  const existing = await currentHousehold(ctx);
  const householdId = existing
    ? existing.id
    : await createHousehold(ctx, input.householdName, input.locale);

  await updateMemberPreferences(ctx, householdId, {
    locale: input.locale,
    genderForm: input.genderForm,
  });

  await upsertPregnancy(ctx, householdId, {
    datingMethod: input.datingMethod,
    ...(input.lmp ? { lmp: input.lmp as IsoDate } : {}),
    ...(input.edd ? { edd: input.edd as IsoDate } : {}),
    ...(input.transferDate ? { transferDate: input.transferDate as IsoDate } : {}),
    fetuses: input.fetuses,
  });

  await upsertProfile(ctx, householdId, {
    ...(input.firstborn === undefined ? {} : { firstborn: input.firstborn }),
    ...(input.customs === undefined ? {} : { customs: input.customs }),
    ...(input.healthFund === undefined ? {} : { health_fund: input.healthFund }),
    ...(input.hasSupplementary === undefined
      ? {}
      : { has_supplementary: input.hasSupplementary }),
  });

  redirect(`/${input.locale}/today`);
}
