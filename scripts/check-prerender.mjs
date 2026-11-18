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
 * The routes that MAY be prerendered. Everything else may not.
 *
 * This list used to run the other way — six hand-written segment names that
 * must not appear — and the review of step 5a pointed out what that cannot
 * see: step 8a's `things`, step 11's `coach` and step 15's settings would each
 * be a household route the gate is blind to, while it reported "none of them a
 * household route". A gate that enumerates what it protects goes stale in
 * exactly the direction that hurts.
 *
 * Inverted, a new route fails this check until somebody declares it public,
 * which is the decision worth making deliberately. Next's own error documents
 * are the only entries, and they render no household data.
 */
const MAY_BE_PRERENDERED = new Set(['/_not-found', '/_global-error', '/_error']);

/** Everything Next lists as prerendered, however it listed it. */
export function prerenderedRoutes(manifest) {
  return [
    ...Object.keys(manifest.routes ?? {}),
    ...Object.keys(manifest.dynamicRoutes ?? {}),
    ...(manifest.notFoundRoutes ?? []),
  ];
}

export function offendingRoutes(manifest) {
  return prerenderedRoutes(manifest).filter((route) => !MAY_BE_PRERENDERED.has(route));
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
    console.error(
      'check:prerender — these routes were prerendered and are not declared public:\n',
    );
    for (const route of offenders) console.error(`  ${route}`);
    console.error(
      "\nAdd `export const dynamic = 'force-dynamic'` to the segment, or move the read " +
        'behind a request API. If the route really is public and holds no household ' +
        'data, add it to MAY_BE_PRERENDERED in this file — deliberately. See ' +
        'apps/web/CLAUDE.md.',
    );
    process.exit(1);
  }

  const routes = prerenderedRoutes(manifest);
  console.log(
    `check:prerender — ${routes.length} prerendered route(s), all of them declared public.`,
  );
}

// `process.argv[1]` is this file only when it was run, not when it was imported
// by its test.
if (process.argv[1]?.endsWith('check-prerender.mjs')) main();
