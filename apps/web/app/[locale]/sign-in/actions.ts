'use server';

/**
 * Sign in and sign up.
 *
 * Both validate with the same zod schema the form used, because the client's
 * validation is a convenience and the server's is the one that counts. Neither
 * returns a provider error string: `errorKey` is a message key, so nothing
 * written for a developer reaches a parent's screen, and a wrong password and
 * an unknown address are told apart nowhere the browser can see.
 */

import { credentialsSchema } from '@/lib/schemas/auth.ts';
import { signIn, signOut, signUp } from '@/lib/services/auth.ts';
import { isLocale } from '@kenn/ui';
import { redirect } from 'next/navigation';

export interface AuthFormState {
  errorKey?: string;
}

function localeOf(formData: FormData): string {
  const candidate = String(formData.get('locale') ?? '');
  return isLocale(candidate) ? candidate : 'he';
}

/** Where to go once signed in: the invite flow comes back to its own page. */
function nextPath(formData: FormData, locale: string): string {
  const next = String(formData.get('next') ?? '');
  // Only a path inside this app, never an absolute URL: `next` arrives from a
  // query string, and an open redirect on a sign-in page is how a convincing
  // phishing link gets built.
  return /^\/[a-zA-Z0-9][\w\-/]*$/.test(next) ? next : `/${locale}`;
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = localeOf(formData);
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { errorKey: 'invalidInput' };

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) return { errorKey: result.errorKey ?? 'unknown' };

  redirect(nextPath(formData, locale));
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = localeOf(formData);
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { errorKey: 'invalidInput' };

  const created = await signUp(parsed.data.email, parsed.data.password);
  if (!created.ok) return { errorKey: created.errorKey ?? 'unknown' };

  // Local Supabase has email confirmation off, so a new account is signed in
  // already. Signing in explicitly keeps this correct either way.
  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) return { errorKey: result.errorKey ?? 'unknown' };

  redirect(nextPath(formData, locale));
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  await signOut();
  redirect(`/${locale}/sign-in`);
}
