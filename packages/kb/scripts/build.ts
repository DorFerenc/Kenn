/**
 * pnpm kb:build — freeze the knowledge base into `generated/items.json`.
 *
 * The app cannot read the YAML at request time: a `readdirSync` of a package
 * directory is invisible to a bundler, so the files would simply not be there
 * once the app is built. The content is therefore compiled into one JSON module
 * that `@kenn/kb/items` imports, the same way `packages/db/types.ts` is
 * generated from the schema and committed.
 *
 * Two properties this file must keep:
 *
 *   1. **It never writes an invalid KB.** A parse or schema error exits non-zero
 *      and leaves the previous artefact alone, so a broken edit cannot reach
 *      the app through a half-written file.
 *   2. **It is byte-identical on every run.** No timestamps, no absolute paths,
 *      no map iteration order — `pnpm check:twice` compares a hash of every
 *      tracked file, and a generator that embeds the clock fails it.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadKbFromDisk, packageRoot } from '../load.ts';

const target = join(packageRoot, 'generated', 'items.json');
const { items, files, errors } = loadKbFromDisk();

if (errors.length > 0) {
  console.error(`kb:build — refusing to write ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  ${e}`);
  console.error(
    '\nRun pnpm kb:validate for the full report. generated/items.json is unchanged.',
  );
  process.exit(1);
}

const payload = `${JSON.stringify({ files, items }, null, 2)}\n`;

mkdirSync(join(packageRoot, 'generated'), { recursive: true });

let previous: string | null;
try {
  previous = readFileSync(target, 'utf8');
} catch {
  previous = null;
}

if (previous === payload) {
  console.log(
    `kb:build — ${items.length} item(s) from ${files.length} file(s): already current.`,
  );
} else {
  writeFileSync(target, payload);
  console.log(
    `kb:build — ${items.length} item(s) from ${files.length} file(s): written.`,
  );
}
