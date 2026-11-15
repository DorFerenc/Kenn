/**
 * The two values a Supabase client needs, read at call time.
 *
 * Read at call time and not at module scope, deliberately: `pnpm check` builds
 * the app in CI, where no Supabase exists, and a module-scope throw would make
 * the build depend on a running database. Every authenticated route is dynamic
 * (see apps/web/CLAUDE.md), so nothing needs these during a build.
 *
 * The publishable key is the one that may reach a browser: it carries no
 * privileges of its own and every request it makes is still subject to RLS. The
 * secret key — `sb_secret_…`, formerly the service-role key — belongs to CI and
 * the watcher and must never appear in this app, which is why there is no
 * function here that would read one.
 */

import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

export function supabaseEnv(): SupabaseEnv {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!parsed.success) {
    // Names only. The message reaches logs, and a key in a log is a key that
    // has left the places that are allowed to hold one.
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(
      `Supabase is not configured: ${missing}. Run \`pnpm db:start\` and then \`pnpm dev:env\`, ` +
        'or see apps/web/.env.example.',
    );
  }

  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}
