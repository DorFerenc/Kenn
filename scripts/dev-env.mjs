/**
 * Write `apps/web/.env.local` from the running local Supabase stack.
 *
 * The local keys are well-known demo values, and they are still keys: they have
 * the shape `check:private` refuses, and a key in git is a key in git whatever
 * its value. So they are never committed — this reads them from
 * `supabase status` each time instead, which also means the file cannot go
 * stale against a restarted stack.
 *
 * Prints names, never values. A key echoed into a terminal is a key in a
 * scrollback buffer, a CI log and a screenshot.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const TARGET = 'apps/web/.env.local';

let status;
try {
  status = JSON.parse(
    execFileSync('pnpm', ['exec', 'supabase', 'status', '--workdir', '.', '-o', 'json'], {
      cwd: 'packages/db',
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
} catch {
  console.error('dev:env — the local stack is not running. Run `pnpm db:start` first.');
  process.exit(1);
}

// Supabase CLI v3 issues publishable and secret keys (`sb_publishable_…`,
// `sb_secret_…`) alongside the legacy anon and service-role JWTs. The
// publishable one is what may reach a browser; the secret one is deliberately
// not written to this file, because nothing in apps/web may hold it.
const url = status.API_URL;
const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;

if (!url || !publishableKey) {
  console.error('dev:env — `supabase status` returned no API URL or publishable key.');
  process.exit(1);
}

writeFileSync(
  TARGET,
  [
    '# Written by `pnpm dev:env` from the local Supabase stack. Not in git.',
    '# Regenerate after `pnpm db:start`; never paste a hosted key in here.',
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
    '',
  ].join('\n'),
);

console.log(
  `dev:env — wrote ${TARGET}: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.`,
);
