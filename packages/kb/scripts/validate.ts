/**
 * pnpm kb:validate — validate every KB YAML file against the schema.
 *
 * CI runs this on every PR. It is deliberately strict about the things that can
 * hurt someone: a published item with a missing locale, a published item with no
 * source, and a `thing` marked unsafe or discouraged without a named authority.
 *
 * Parsing lives in `../load.ts`, shared with `pnpm kb:build`, so the gate and
 * the artefact the app imports can never disagree about what the content says.
 * What is left here is the reporting, plus the one check that is about time
 * rather than shape: a `review_by` date that has already passed.
 */

import { loadKbFromDisk } from '../load.ts';

const { items, errors } = loadKbFromDisk();
const today = new Date().toISOString().slice(0, 10);
const warnings = items
  .filter((item) => item.review_by < today)
  .map(
    (item) =>
      `${item.id}: review_by ${item.review_by} has passed — recheck it against its source`,
  );

if (errors.length > 0) {
  console.error(`kb:validate — ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

const published = items.filter((i) => i.status === 'published');
const drafts = items.filter((i) => i.status === 'draft');
const byPhase = new Map<string, number>();
for (const i of items) byPhase.set(i.phase, (byPhase.get(i.phase) ?? 0) + 1);

console.log(
  `kb:validate — ${items.length} item(s) valid: ${published.length} published, ${drafts.length} draft.`,
);
for (const [phase, n] of [...byPhase].sort()) console.log(`  ${phase}: ${n}`);
for (const d of drafts) console.log(`  draft (not shown to users): ${d.id}`);

if (warnings.length > 0) {
  console.log(`\n${warnings.length} item(s) are due for review:`);
  for (const w of warnings) console.log(`  ${w}`);
}
