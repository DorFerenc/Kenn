/**
 * pnpm kb:validate — validate every KB YAML file against the schema.
 *
 * CI runs this on every PR. It is deliberately strict about the things that can
 * hurt someone: a published item with a missing locale, a published item with no
 * source, and a `thing` marked unsafe or discouraged without a named authority.
 *
 * Also checks two things the schema cannot see because they are cross-file:
 * duplicate ids, and a `review_by` date that has already passed.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { kbItemSchema, type KbItem } from '../schema.ts';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const contentRoot = join(packageRoot, 'content');

function yamlFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...yamlFiles(full));
    else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) found.push(full);
  }
  return found.sort();
}

const errors: string[] = [];
const warnings: string[] = [];
const seen = new Map<string, string>();
const items: KbItem[] = [];
const today = new Date().toISOString().slice(0, 10);

for (const file of yamlFiles(contentRoot)) {
  const where = relative(packageRoot, file);
  let doc: unknown;
  try {
    doc = load(readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${where}: ${error instanceof Error ? error.message : String(error)}`);
    continue;
  }

  const raw = (doc as { items?: unknown[] })?.items;
  if (!Array.isArray(raw)) {
    errors.push(`${where}: expected a top-level "items:" list`);
    continue;
  }

  raw.forEach((entry, i) => {
    const result = kbItemSchema.safeParse(entry);
    if (!result.success) {
      const id = (entry as { id?: string })?.id ?? `items[${i}]`;
      for (const issue of result.error.issues) {
        const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
        errors.push(`${where} · ${id} · ${path}: ${issue.message}`);
      }
      return;
    }

    const item = result.data;
    const previous = seen.get(item.id);
    if (previous) {
      errors.push(`${where} · ${item.id}: duplicate id, already defined in ${previous}`);
      return;
    }
    seen.set(item.id, where);
    items.push(item);

    if (item.review_by < today) {
      warnings.push(
        `${item.id}: review_by ${item.review_by} has passed — recheck it against its source`,
      );
    }
  });
}

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
