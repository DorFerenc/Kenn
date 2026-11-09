/**
 * The zod schema for a KB item.
 *
 * Filled in at roadmap step 3, which is also when the first pregnancy items
 * land in content/. The shape is already fixed by docs/plan.md, section
 * "Data model" — id, version, country, phase, category, locales (he + en),
 * window, applies_if, coverage, priority, evidence, sources, valid_from,
 * review_by, rules.
 *
 * Two rules that the schema must enforce, not merely document:
 *   - a published item has both `he` and `en` text;
 *   - a published item has at least one source URL. No source means draft.
 */

import { z } from 'zod';

/** Placeholder: step 3 replaces this with the full item schema. */
export const kbItemSchema = z.unknown();

export type KbItem = z.infer<typeof kbItemSchema>;
