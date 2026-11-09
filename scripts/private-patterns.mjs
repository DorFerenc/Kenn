/**
 * The shapes `check:private` refuses, kept in their own file.
 *
 * This file is skipped by the scan — it necessarily contains the things it
 * hunts for. Keeping it separate from `check-private.mjs` means the guard's
 * *logic* is still scanned, so the skip is a hole the width of a pattern list
 * rather than the width of the whole guard.
 */

/** Domains that exist to be fake. RFC 2606 reserves .test and example.*. */
export const FIXTURE_DOMAINS = [
  'example.test',
  'example.com',
  'example.org',
  'kenn.test',
];

/**
 * Exact addresses that are allowed although their domain is real.
 *
 * `email.com` is a live consumer mail provider, so allowlisting the whole
 * domain would let any real address at it pass. Only the literal the Supabase
 * CLI writes into `config.toml` is permitted.
 */
export const FIXTURE_ADDRESSES = ['admin@email.com'];

/**
 * Files where a third party's name is required rather than forbidden. A
 * licence or an attribution notice must keep the author it credits.
 */
export const ATTRIBUTION_FILES =
  /(^|\/)(LICEN[CS]E|NOTICE|AUTHORS|CONTRIBUTORS|THIRD[-_]PARTY[\w-]*)(\.[\w]+)?$/i;

export const SECRET_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, 'a JWT'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key block'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'a GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}\b/, 'a GitHub fine-grained token'],
  // `sk-[A-Za-z0-9]{32,}` cannot match sk-ant-api03-… : it admits no hyphen.
  // The one key shape this project will certainly hold needs its own entry.
  [/\bsk-ant-[A-Za-z0-9_-]{24,}\b/, 'an Anthropic API key'],
  [/\bsk-[A-Za-z0-9]{32,}\b/, 'an OpenAI-style API key'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'a Google API key'],
  [/\bsb_secret_[A-Za-z0-9_-]{10,}\b/, 'a Supabase secret key'],
  [/\bsb_publishable_[A-Za-z0-9_-]{10,}\b/, 'a Supabase publishable key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'a Slack token'],
  [
    /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/,
    'a database connection string with a password',
  ],

  // Israeli personal data the project rules name explicitly: no bank details,
  // and a household's own phone numbers belong in Postgres, not in git. The
  // emergency card's public numbers (101, 100) are three digits and unaffected.
  [/\b05\d(?:[-\s]?\d){7}\b/, 'an Israeli mobile number'],
  [/\+?972[-\s]?5\d(?:[-\s]?\d){7}\b/, 'an Israeli mobile number'],
  // IBANs are written in groups of four, so a separator may fall anywhere.
  [/\bIL\d{2}(?:[-\s]?\d){19}\b/, 'an Israeli IBAN'],

  // A home directory names its user.
  [
    /\/(?:home|Users)\/(?!root\b|user\b|runner\b|ubuntu\b|node\b|vscode\b)[A-Za-z0-9._-]{2,}/,
    'a path containing a username',
  ],
  // A hosted Supabase project reference, with or without a scheme — it also
  // appears bare in a connection string and in SUPABASE_PROJECT_ID.
  [/\b[a-z0-9]{20}\.supabase\.(?:co|in|net)\b/, 'a hosted Supabase project reference'],
];
