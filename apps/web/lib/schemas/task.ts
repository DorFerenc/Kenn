/** Deciding about one checklist item. */

import { z } from 'zod';

export const taskDecisionSchema = z.object({
  kbItemId: z.string().regex(/^[a-z]+\.[a-z0-9-]+$/),
  decision: z.enum(['done', 'skipped', 'open']),
  note: z.string().trim().max(500).optional(),
});
