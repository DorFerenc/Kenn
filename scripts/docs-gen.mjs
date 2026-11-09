#!/usr/bin/env node
/**
 * pnpm docs:gen — regenerate and verify the docs that must not drift from code.
 *
 * Today it does four real jobs and reports the one it cannot do yet:
 *
 *   1. Diagram sync (working now). Every docs/diagrams/*.mmd must match, byte for
 *      byte, the ```mermaid block it was extracted from. The .mmd file is the
 *      source; the block in the document is what a reader sees on GitHub. Keeping
 *      both means they can disagree, so this checks they do not.
 *   2. ER diagram from the migrations           — roadmap step 1
 *   3. KB catalog from packages/kb/content      — roadmap step 3
 *   4. i18n coverage from apps/web/messages     — roadmap step 2
 *   5. MCP tool list from the tool registry     — roadmap step 9
 *
 * Exits non-zero when a diagram has drifted. See docs/architecture.md, section
 * "Docs that stay current".
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateEr } from './gen-er.mjs';
import { generateCatalog } from './gen-kb-catalog.mjs';
import { generateCoverage } from './gen-i18n-coverage.mjs';

const DIAGRAM_DIR = 'docs/diagrams';
const MANIFEST = join(DIAGRAM_DIR, 'manifest.json');

let failures = 0;

// ------------------------------------------------------- KB catalogue
function writeKbCatalog() {
  const { markdown, count } = generateCatalog();
  const target = 'docs/kb-catalog.md';
  const before = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const changed = before !== markdown;
  if (changed) writeFileSync(target, markdown);
  console.log(
    `KB catalogue: ${count} item(s)` +
      (changed ? ' — regenerated.' : ' — already current.'),
  );
}

// ------------------------------------------------------- i18n coverage
function writeI18nCoverage() {
  const { markdown, problems, keyCount, localeCount } = generateCoverage();
  if (localeCount === 0) {
    console.log('i18n coverage: no message catalogues yet, nothing to generate.');
    return;
  }

  const target = 'docs/i18n-coverage.md';
  const before = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const changed = before !== markdown;
  if (changed) writeFileSync(target, markdown);

  for (const problem of problems) {
    console.error(`  i18n: ${problem}`);
    failures += 1;
  }

  console.log(
    `i18n coverage: ${keyCount} key(s) in ${localeCount} locale(s)` +
      (problems.length > 0 ? ` — ${problems.length} problem(s).` : '') +
      (changed ? ' — regenerated.' : ' — already current.'),
  );
}

// ------------------------------------------------------------- ER generation
function writeErDiagram() {
  if (!existsSync('packages/db/supabase/migrations')) return;
  const sqlFiles = readdirSync('packages/db/supabase/migrations').filter((f) =>
    f.endsWith('.sql'),
  );
  if (sqlFiles.length === 0) {
    console.log('ER diagram: no migrations yet, nothing to generate.');
    return;
  }

  const { mermaid, tableCount } = generateEr();
  const target = 'docs/diagrams/er.mmd';
  const before = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (before !== mermaid) writeFileSync(target, mermaid);

  // Splice it into the document between its anchors, so the rendered diagram a
  // reader sees is the same bytes as the .mmd source.
  const doc = 'docs/architecture.md';
  const text = readFileSync(doc, 'utf8');
  const open = '<!-- generated: er. Do not edit by hand; run `pnpm docs:gen`. -->';
  const close = '<!-- /generated: er -->';
  const i = text.indexOf(open);
  const j = text.indexOf(close);
  if (i === -1 || j === -1) {
    console.error(
      `${doc} is missing the generated-er anchors; cannot place the diagram.`,
    );
    failures += 1;
    return;
  }
  const replacement = `${open}\n\n\`\`\`mermaid\n${mermaid}\`\`\`\n\n${close}`;
  const updated = text.slice(0, i) + replacement + text.slice(j + close.length);
  if (updated !== text) writeFileSync(doc, updated);

  const changed = before !== mermaid || updated !== text;
  console.log(
    `ER diagram: ${tableCount} tables from ${sqlFiles.length} migration(s)` +
      (changed ? ' — regenerated.' : ' — already current.'),
  );
}

// ---------------------------------------------------------------- 1. diagrams
function checkDiagrams() {
  if (!existsSync(MANIFEST)) {
    console.error(`missing ${MANIFEST}; cannot check diagram sync.`);
    failures += 1;
    return;
  }

  const { diagrams } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const docCache = new Map();
  const blocksFor = (doc) => {
    if (!docCache.has(doc)) {
      const text = readFileSync(doc, 'utf8');
      docCache.set(
        doc,
        [...text.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]),
      );
    }
    return docCache.get(doc);
  };

  const onDisk = readdirSync(DIAGRAM_DIR).filter((f) => f.endsWith('.mmd'));
  const listed = Object.keys(diagrams).map((p) => p.replace(`${DIAGRAM_DIR}/`, ''));

  for (const file of onDisk) {
    if (!listed.includes(file)) {
      console.error(`${DIAGRAM_DIR}/${file} is not in manifest.json`);
      failures += 1;
    }
  }

  let checked = 0;
  let expected = 0;
  for (const [path, docs] of Object.entries(diagrams)) {
    const targets = Array.isArray(docs) ? docs : [docs];
    expected += targets.length;
    if (!existsSync(path)) {
      console.error(`${path} is in manifest.json but does not exist`);
      failures += 1;
      continue;
    }
    const source = readFileSync(path, 'utf8');
    const normalized = source.endsWith('\n') ? source : `${source}\n`;
    for (const doc of targets) {
      if (!blocksFor(doc).includes(normalized)) {
        console.error(
          `DRIFT: ${path} does not match any \`\`\`mermaid block in ${doc}.\n` +
            `       The .mmd file is the source. Paste it back into ${doc}, or ` +
            `update the .mmd if the document is right.`,
        );
        failures += 1;
      } else {
        checked += 1;
      }
    }
  }
  console.log(`diagrams: ${checked}/${expected} embeddings in sync with their document.`);
}

// ------------------------------------------------------- 2-5. not yet possible
function filesMatching(dir, predicate) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesMatching(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}

const pendingGenerators = [
  {
    name: 'MCP tool list',
    from: 'apps/web/app/api/mcp',
    step: 9,
    hasContent: (d) => filesMatching(d, (f) => f.endsWith('.ts')).length > 0,
  },
];

function reportPending() {
  for (const g of pendingGenerators) {
    if (g.hasContent(g.from)) {
      console.error(
        `  ${g.name}: ${g.from} now has content, but no generator is wired up ` +
          `(due at roadmap step ${g.step}). docs/${g.name} would be stale.`,
      );
      failures += 1;
    } else {
      console.log(`  ${g.name}: source empty (step ${g.step})`);
    }
  }
}

writeErDiagram();
writeKbCatalog();
writeI18nCoverage();
checkDiagrams();
console.log('generators awaiting their roadmap step:');
reportPending();

if (failures > 0) {
  console.error(`\ndocs:gen failed with ${failures} problem(s).`);
  process.exit(1);
}
console.log('\ndocs:gen: clean.');
