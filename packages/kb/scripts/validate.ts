/**
 * pnpm kb:validate — zod-validates every KB YAML file.
 *
 * CI runs this on every PR. It is deliberately strict about the two things
 * that can hurt someone: a published item with a missing locale, and a
 * published item with no source URL.
 *
 * At roadmap step 0 there are no items yet, so this walks an empty tree and
 * exits 0. Step 3 wires it to the real schema in ../schema.ts.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const contentRoot = join(packageRoot, 'content');

function yamlFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...yamlFiles(full));
    } else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
      found.push(full);
    }
  }
  return found;
}

const files = yamlFiles(contentRoot);
const errors: string[] = [];

for (const file of files) {
  const where = relative(packageRoot, file);
  try {
    load(readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${where}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (errors.length > 0) {
  console.error(`kb:validate — ${errors.length} file(s) failed to parse:\n`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

if (files.length === 0) {
  console.log('kb:validate — no KB items yet; the first ones arrive at roadmap step 3.');
} else {
  console.log(`kb:validate — ${files.length} file(s) parsed.`);
  console.log('Schema validation is wired up at roadmap step 3 (see ../schema.ts).');
}
