/**
 * The zod schema for a KB item.
 *
 * Two kinds share one envelope, discriminated on `kind`:
 *   - `schedule` — something that happens in a window: a test, vaccine, visit,
 *     right or milestone.
 *   - `thing`    — something you might acquire: the Things recommendation
 *     catalogue (see docs/plans/recommended-lists.md).
 *
 * The refinements at the bottom are the point of this file. They encode the
 * rules that would otherwise rely on a reviewer remembering them:
 *
 *   1. A published item has both `he` and `en` text.
 *   2. A published item cites at least one source URL.
 *   3. A `thing` marked `unsafe` or `discouraged` names a safety authority AND
 *      cites a source. Safety is a veto, not a vote (ADR-0005).
 *   4. A window cannot end before it starts.
 *   5. `review_by` cannot precede `valid_from`.
 *
 * See packages/kb/CLAUDE.md and docs/kb-authoring.md.
 */

import { z } from 'zod';

export const LOCALES = ['he', 'en', 'ar', 'ru'] as const;
export const ANCHORS = ['LMP', 'EDD', 'BIRTH', 'CORRECTED_BIRTH'] as const;
export const PHASES = ['preconception', 'pregnancy', 'birth', 'baby', 'admin'] as const;
export const CATEGORIES = [
  'test',
  'vaccine',
  'visit',
  'admin',
  'right',
  'milestone',
  'safety',
  'supplement',
  'course',
  'thing',
] as const;
export const COVERAGE = [
  'basket',
  'supplementary',
  'private',
  'otc',
  'free',
  'n/a',
] as const;
export const PRIORITIES = ['critical', 'important', 'optional'] as const;
export const EVIDENCE = ['guideline', 'strong', 'moderate', 'weak', 'custom'] as const;
export const STATUSES = ['published', 'draft'] as const;

/** `unsafe` and `discouraged` are the two that require an authority. */
export const NECESSITY = [
  'essential',
  'recommended',
  'optional',
  'discouraged',
  'unsafe',
] as const;
export const TIMING = [
  'before_birth',
  'hospital_bag',
  'first_weeks',
  'by_month',
  'when_needed',
  'not_applicable',
] as const;
export const HOW_ACQUIRED = [
  'buy',
  'often_gifted',
  'borrowable',
  'starter_kit',
  'rent',
  'not_applicable',
] as const;
/** Only these may set a safety verdict. A shop or a forum may not. */
export const SAFETY_AUTHORITIES = [
  'moh',
  'aap',
  'beterem',
  'cpsc',
  'eu_safety_gate',
  'il_recall',
  'who',
] as const;

const localeText = z
  .object({
    title: z.string().min(1),
    why: z.string().optional(),
    detail: z.string().optional(),
  })
  .strict();

/** Day offsets from an anchor, never dates. Negative is allowed: folic acid
 *  starts three months before conception, which is before LMP day 0. */
const windowSchema = z
  .object({
    anchor: z.enum(ANCHORS),
    start_days: z.number().int().min(-400).max(1200),
    end_days: z.number().int().min(-400).max(1200),
  })
  .strict();

const appliesIf = z
  .object({
    fetuses: z.number().int().min(1).max(5).optional(),
    dating_method: z.enum(['lmp', 'ultrasound', 'ivf_transfer']).optional(),
    birth_type: z.enum(['vaginal', 'caesarean']).optional(),
    firstborn: z.boolean().optional(),
    customs: z.enum(['jewish', 'muslim', 'christian', 'druze', 'none']).optional(),
    sex: z.enum(['male', 'female']).optional(),
    rh_negative: z.boolean().optional(),
    health_fund: z.enum(['clalit', 'maccabi', 'meuhedet', 'leumit']).optional(),
    has_supplementary: z.boolean().optional(),
    // Things hints (docs/plans/recommended-lists.md)
    has_baby_room: z.boolean().optional(),
    has_car: z.boolean().optional(),
    has_elevator: z.boolean().optional(),
    feeding_intent: z.enum(['breast', 'formula', 'mixed', 'undecided']).optional(),
    help_available: z.boolean().optional(),
    season_at_birth: z.enum(['winter', 'spring', 'summer', 'autumn']).optional(),
  })
  .strict();

const base = {
  id: z
    .string()
    .regex(/^[a-z]+\.[a-z0-9-]+$/, 'id must look like "<phase>.<slug>", lowercase'),
  version: z.number().int().positive(),
  country: z.string().regex(/^[A-Z]{2}$/),
  phase: z.enum(PHASES),
  category: z.enum(CATEGORIES),
  status: z.enum(STATUSES).default('published'),
  locales: z.object({
    he: localeText.optional(),
    en: localeText.optional(),
    ar: localeText.optional(),
    ru: localeText.optional(),
  }),
  applies_if: appliesIf.default({}),
  coverage: z.enum(COVERAGE).default('n/a'),
  priority: z.enum(PRIORITIES).default('important'),
  evidence: z.enum(EVIDENCE).default('guideline'),
  sources: z.array(z.string().url()).default([]),
  valid_from: z.string().date().optional(),
  review_by: z.string().date(),
  notes: z.string().optional(),
};

export const scheduleItemSchema = z
  .object({
    ...base,
    kind: z.literal('schedule'),
    window: windowSchema,
    /** Offset past which being late matters medically, not merely untidily. */
    red_flag_days: z.number().int().optional(),
    rules: z.array(z.string()).default([]),
  })
  .strict();

export const thingItemSchema = z
  .object({
    ...base,
    kind: z.literal('thing'),
    necessity: z.enum(NECESSITY),
    necessity_reason: z
      .object({ he: z.string().min(1), en: z.string().min(1) })
      .partial()
      .optional(),
    safety_authority: z.enum(SAFETY_AUTHORITIES).optional(),
    timing: z.enum(TIMING).default('when_needed'),
    how_acquired: z.enum(HOW_ACQUIRED).default('buy'),
    price_ils: z
      .object({
        typical_min: z.number().int().nonnegative().nullable().optional(),
        typical_max: z.number().int().nonnegative().nullable().optional(),
      })
      .strict()
      .optional(),
    /** Provenance: which curated list included this, and at what tier.
     *  NEVER a citation. Only `sources` is a citation. */
    lists: z
      .array(
        z
          .object({
            list: z.string().min(1),
            tier: z.enum(['mandatory', 'recommended', 'optional', 'unnecessary']),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export const kbItemSchema = z
  .discriminatedUnion('kind', [scheduleItemSchema, thingItemSchema])
  .superRefine((item, ctx) => {
    // 1 + 2. A published item is bilingual and cited.
    if (item.status === 'published') {
      if (!item.locales.he?.title) {
        ctx.addIssue({
          code: 'custom',
          path: ['locales', 'he'],
          message: 'a published item needs Hebrew text',
        });
      }
      if (!item.locales.en?.title) {
        ctx.addIssue({
          code: 'custom',
          path: ['locales', 'en'],
          message: 'a published item needs English text',
        });
      }
      if (item.sources.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['sources'],
          message:
            'a published item needs at least one source URL. No source means status: draft.',
        });
      }
    }

    // 4. Windows run forwards.
    if (item.kind === 'schedule') {
      if (item.window.end_days < item.window.start_days) {
        ctx.addIssue({
          code: 'custom',
          path: ['window'],
          message: 'end_days is before start_days',
        });
      }
      if (item.red_flag_days !== undefined && item.red_flag_days < item.window.end_days) {
        ctx.addIssue({
          code: 'custom',
          path: ['red_flag_days'],
          message: 'red_flag_days should be at or after the end of the window',
        });
      }
    }

    // 3. Safety is a veto, not a vote. See ADR-0005.
    if (
      item.kind === 'thing' &&
      (item.necessity === 'unsafe' || item.necessity === 'discouraged')
    ) {
      if (!item.safety_authority) {
        ctx.addIssue({
          code: 'custom',
          path: ['safety_authority'],
          message: `necessity "${item.necessity}" requires a named safety_authority (ADR-0005)`,
        });
      }
      if (item.sources.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['sources'],
          message: `necessity "${item.necessity}" requires a source URL for the verdict`,
        });
      }
    }

    // 5. A review date cannot precede the day the item became valid.
    if (item.valid_from && item.review_by <= item.valid_from) {
      ctx.addIssue({
        code: 'custom',
        path: ['review_by'],
        message: 'review_by must be after valid_from',
      });
    }
  });

export type ScheduleItem = z.infer<typeof scheduleItemSchema>;
export type ThingItem = z.infer<typeof thingItemSchema>;
export type KbItem = ScheduleItem | ThingItem;
export type Anchor = (typeof ANCHORS)[number];
export type Locale = (typeof LOCALES)[number];
