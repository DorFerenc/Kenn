/**
 * The Content-Security-Policy, built per request around a fresh nonce
 * (roadmap step 6a).
 *
 * Scripts are the part that matters, and they are strict: only a script
 * carrying this request's nonce runs, plus what it loads (`'strict-dynamic'`).
 * Next.js reads the nonce from the request's own CSP header and stamps it on
 * every script it emits, which is why `proxy.ts` sets the header on the
 * request as well as on the response.
 *
 * Styles allow `'unsafe-inline'`. Next.js, next/font and React write inline
 * `style` attributes that a nonce cannot cover, and an injected style can
 * restyle a page but cannot run code or read data. That is a deliberate,
 * named trade, not an oversight.
 *
 * `connect-src` names the Supabase origin twice, because realtime arrives over
 * a WebSocket and `'self'` does not cover a different port, let alone `ws:`.
 */

export interface CspInput {
  nonce: string;
  /** NEXT_PUBLIC_SUPABASE_URL: the one other origin the browser talks to. */
  supabaseUrl: string;
  /** React's development build evaluates strings; production never does. */
  development: boolean;
  /** Only an HTTPS deployment should ask the browser to upgrade requests. */
  https: boolean;
}

export function contentSecurityPolicy({
  nonce,
  supabaseUrl,
  development,
  https,
}: CspInput): string {
  const supabase = new URL(supabaseUrl);
  const socket = `${supabase.protocol === 'https:' ? 'wss:' : 'ws:'}//${supabase.host}`;

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(development ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", supabase.origin, socket],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  const policy = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.join(' ')}`,
  );
  if (https) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

/** 128 bits, base64. A nonce is only worth anything if it cannot be guessed. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
