/**
 * Where a sign-in may send you afterwards.
 *
 * `next` arrives in a query string, so it is attacker-controlled: a real link
 * on the real domain can carry `?next=https://kenn-app.example/he/sign-in` and
 * hand an already-signed-in parent to a convincing copy of this page. The guard
 * existed in the server action and the page redirected without it — found by
 * the security review of step 5a — so it lives in one module that both import.
 *
 * Only a path inside this app: one leading slash, then a word character, which
 * also rejects `//evil.com` (a protocol-relative URL the browser treats as
 * absolute) and `/\evil.com`.
 */

const INTERNAL_PATH = /^\/[a-zA-Z0-9][\w\-/]*$/;

export function safeNext(next: string | undefined | null, locale: string): string {
  const candidate = typeof next === 'string' ? next : '';
  return INTERNAL_PATH.test(candidate) ? candidate : `/${locale}`;
}
