/**
 * The household's anchors, as the engine wants them.
 *
 * A one-line file on purpose: Today needs the gestational age, the Checklist
 * needs the windows, and both would otherwise each write the same two steps —
 * read the pregnancy, hand it to `anchorsFromPregnancy()` — which is how two
 * screens end up disagreeing about what week it is.
 */

import { anchorsFromPregnancy, type Anchors } from '@kenn/engine';
import type { ServiceContext } from './context.ts';
import { getPregnancy, pregnancyInput } from './pregnancy.ts';

export async function anchorsOf(ctx: ServiceContext): Promise<Anchors> {
  const pregnancy = await getPregnancy(ctx);
  return pregnancy ? anchorsFromPregnancy(pregnancyInput(pregnancy)) : {};
}
