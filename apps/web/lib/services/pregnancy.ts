/**
 * The pregnancy: the anchors every date in the app is measured from.
 *
 * This file stores and reads them. It computes nothing — turning an LMP or a
 * corrected EDD into anchors is `anchorsFromPregnancy()` in @kenn/engine, and
 * the dating precedence (IVF transfer beats a corrected EDD beats a remembered
 * LMP) lives there with its tests.
 */

import type { IsoDate, PregnancyInput } from '@kenn/engine';
import { nowTimestamp } from '../today.ts';
import { recordAudit } from './audit.ts';
import type { ServiceContext } from './context.ts';

type DatingMethod = 'lmp' | 'ultrasound' | 'ivf_transfer';

export interface Pregnancy {
  householdId: string;
  datingMethod: DatingMethod;
  lmp: IsoDate | null;
  edd: IsoDate | null;
  transferDate: IsoDate | null;
  fetuses: number;
}

export async function getPregnancy(
  ctx: ServiceContext,
  householdId: string,
): Promise<Pregnancy | null> {
  // Filtered, not trusted to RLS returning one row: a person can be a member of
  // more than one household, and an unfiltered read then returns whichever
  // pregnancy Postgres yields first. See currentMember() for the bug this was.
  const { data, error } = await ctx.db
    .from('pregnancy')
    .select('household_id, dating_method, lmp, edd, transfer_date, fetuses')
    .eq('household_id', householdId)
    .maybeSingle();

  if (error) throw new Error(`pregnancy read failed: ${error.message}`);
  if (!data) return null;

  return {
    householdId: data.household_id,
    datingMethod: data.dating_method as DatingMethod,
    lmp: data.lmp as IsoDate | null,
    edd: data.edd as IsoDate | null,
    transferDate: data.transfer_date as IsoDate | null,
    fetuses: data.fetuses,
  };
}

export interface PregnancyWrite {
  datingMethod: DatingMethod;
  lmp?: IsoDate;
  edd?: IsoDate;
  transferDate?: IsoDate;
  fetuses: number;
}

export async function upsertPregnancy(
  ctx: ServiceContext,
  householdId: string,
  input: PregnancyWrite,
): Promise<void> {
  const before = await getPregnancy(ctx, householdId);

  const { error } = await ctx.db.from('pregnancy').upsert(
    {
      household_id: householdId,
      dating_method: input.datingMethod,
      lmp: input.lmp ?? null,
      edd: input.edd ?? null,
      transfer_date: input.transferDate ?? null,
      fetuses: input.fetuses,
      updated_at: nowTimestamp(),
    },
    { onConflict: 'household_id' },
  );

  if (error) throw new Error(`pregnancy write failed: ${error.message}`);

  await recordAudit(ctx, householdId, {
    action: before ? 'pregnancy.update' : 'pregnancy.create',
    entity: 'pregnancy',
    entityId: householdId,
    before: before
      ? { dating_method: before.datingMethod, lmp: before.lmp, edd: before.edd }
      : null,
    after: {
      dating_method: input.datingMethod,
      lmp: input.lmp ?? null,
      edd: input.edd ?? null,
    },
  });
}

/**
 * The engine's input, built so that each dating method carries only the date it
 * is named after.
 *
 * `anchorsFromPregnancy()` prefers a stored EDD over a stored LMP whenever both
 * are present, which is right for ultrasound dating and wrong for a family who
 * has not had the scan yet but whose row still holds an EDD from the wizard's
 * arithmetic. Passing one date per method keeps the precedence the engine
 * documents instead of the precedence the row happens to imply.
 */
export function pregnancyInput(pregnancy: Pregnancy): PregnancyInput {
  switch (pregnancy.datingMethod) {
    case 'ivf_transfer':
      return pregnancy.transferDate
        ? { datingMethod: 'ivf_transfer', transferDate: pregnancy.transferDate }
        : {};
    case 'ultrasound':
      return pregnancy.edd ? { datingMethod: 'ultrasound', edd: pregnancy.edd } : {};
    case 'lmp':
      return pregnancy.lmp ? { datingMethod: 'lmp', lmp: pregnancy.lmp } : {};
  }
}
