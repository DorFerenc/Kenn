/**
 * Reading the knowledge base off disk.
 *
 * Shared by two commands that must never disagree: `pnpm kb:validate`, which
 * says what is wrong with the content, and `pnpm kb:build`, which freezes the
 * valid result into `generated/items.json` for the app to import. One reader
 * means the gate and the artefact cannot drift apart.
 *
 * Nothing in the app calls this: a request-time `readdirSync` of a package
 * directory is not something a bundler can trace. The app imports
 * `@kenn/kb/items`, which is this output, built and committed.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { kbItemSchema, type KbItem } from './schema.ts';

export const packageRoot = fileURLToPath(new URL('.', import.meta.url));
const contentRoot = join(packageRoot, 'content');

/** Every YAML file under `dir`, sorted, so the output is deterministic. */
function yamlFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...yamlFiles(full));
    else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) found.push(full);
  }
  return found.sort();
}

export interface KbOnDisk {
  /** Items that parsed, in a stable order: by file, then by position in it. */
  items: KbItem[];
  /** Content files read, relative to the package root and sorted. */
  files: string[];
  /** One line per problem, already written for a human. Empty means valid. */
  errors: string[];
}

export function loadKbFromDisk(): KbOnDisk {
  const items: KbItem[] = [];
  const files: string[] = [];
  const errors: string[] = [];
  const seen = new Map<string, string>();

  for (const file of yamlFiles(contentRoot)) {
    const where = relative(packageRoot, file);
    files.push(where);

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
        errors.push(
          `${where} · ${item.id}: duplicate id, already defined in ${previous}`,
        );
        return;
      }
      seen.set(item.id, where);
      items.push(item);
    });
  }

  return { items, files, errors };
}
