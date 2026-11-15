/**
 * No household route may be prerendered.
 *
 * apps/web/CLAUDE.md asks roadmap step 5 for this assertion, and the reason is
 * worth stating plainly: `app/[locale]/layout.tsx` exports
 * `generateStaticParams`, which is correct for a public shell. A route below it
 * that reads a household and does not force itself dynamic inherits that, and
 * Next.js will bake one family's pregnancy into a build artefact served to
 * everyone who asks for that URL.
 *
 * Every authenticated segment therefore sets `export const dynamic =
 * 'force-dynamic'`. This checks that it worked, against the build output rather
 * than against the source — a comment claiming a page is dynamic is not
 * evidence, and the manifest is.
 *
 * Run after `next build`, as part of `pnpm check`.
 */

import { readFileSync } from 'node:fs';

const MANIFEST = 'apps/web/.next/prerender-manifest.json';

/**
 * Route prefixes that must never appear as prerendered output. Locale-prefixed
 * (`/he/today`) and bare (`/today`), because the locale segment is part of
 * every URL and a future unprefixed route would still be a household route.
 */
const PRIVATE_SEGMENTS = [
  'today',
  'checklist',
  'household',
  'onboarding',
  'join',
  'sign-in',
];

/** Everything Next lists as prerendered, however it listed it. */
export function prerenderedRoutes(manifest) {
  return [
    ...Object.keys(manifest.routes ?? {}),
    ...Object.keys(manifest.dynamicRoutes ?? {}),
    ...(manifest.notFoundRoutes ?? []),
  ];
}

export function offendingRoutes(manifest) {
  return prerenderedRoutes(manifest).filter((route) => {
    const segments = route.split('/').filter(Boolean);
    return segments.some((segment) => PRIVATE_SEGMENTS.includes(segment));
  });
}

function main() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  } catch {
    // Not a pass: the gate has to have looked at something.
    console.error(
      `check:prerender — ${MANIFEST} is missing. Run \`pnpm --filter @kenn/web build\` first.`,
    );
    process.exit(1);
  }

  const offenders = offendingRoutes(manifest);
  if (offenders.length > 0) {
    console.error('check:prerender — these household routes were prerendered:\n');
    for (const route of offenders) console.error(`  ${route}`);
    console.error(
      "\nAdd `export const dynamic = 'force-dynamic'` to the segment, or move the read " +
        'behind a request API. See apps/web/CLAUDE.md.',
    );
    process.exit(1);
  }

  const routes = prerenderedRoutes(manifest);
  console.log(
    `check:prerender — ${routes.length} prerendered route(s), none of them a household route.`,
  );
}

// `process.argv[1]` is this file only when it was run, not when it was imported
// by its test.
if (process.argv[1]?.endsWith('check-prerender.mjs')) main();
