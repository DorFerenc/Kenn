/**
 * Sign in, sign up, sign out, and the session refresh the proxy performs.
 *
 * Email and a password, which is roadmap step 5a's door and not the product's:
 * 5b adds Google OAuth and real TOTP enrolment, and decides whether this door
 * stays open in production. It is the local door because the alternative —
 * magic links — is rate-limited to two emails an hour by the local stack, which
 * the end-to-end suite would exhaust on its second run.
 *
 * Nothing here decides what a signed-in user may see. That is RLS.
 */

import type { CookieOptions } from '@supabase/ssr';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@kenn/db';
import { supabaseEnv } from './env.ts';
import { serverDb } from './server-client.ts';

export interface AuthResult {
  ok: boolean;
  /** A key into `messages/*.json`, never a provider message: an auth error
   *  string is written for a developer and leaks what exists. */
  errorKey?: 'invalidCredentials' | 'emailTaken' | 'weakPassword' | 'unknown';
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const db = await serverDb();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (!error) return { ok: true };
  return { ok: false, errorKey: 'invalidCredentials' };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const db = await serverDb();
  const { error } = await db.auth.signUp({ email, password });
  if (!error) return { ok: true };

  if (error.code === 'user_already_exists' || error.status === 422) {
    return { ok: false, errorKey: 'emailTaken' };
  }
  if (error.code === 'weak_password') return { ok: false, errorKey: 'weakPassword' };
  return { ok: false, errorKey: 'unknown' };
}

export async function signOut(): Promise<void> {
  const db = await serverDb();
  await db.auth.signOut();
}

export interface ProxyCookies {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options: CookieOptions) => void;
}

/**
 * Refresh the session during the proxy pass.
 *
 * `proxy.ts` is the only part of a request that can both read and write
 * cookies, so it is the only place an expired access token can be exchanged for
 * a fresh one. It lives here rather than in `proxy.ts` because the proxy may not
 * import a Supabase client — hard rule 1 is about the directory, not about the
 * kind of file.
 */
export async function refreshSession(cookies: ProxyCookies): Promise<void> {
  const { url, publishableKey } = supabaseEnv();

  const db = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) cookies.set(name, value, options);
      },
    },
  });

  // The call is the point: getUser() refreshes an expired token as a side
  // effect, and the cookies written above carry the new one onward.
  await db.auth.getUser();
}
