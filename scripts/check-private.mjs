/**
 * pnpm check:private — refuse to commit private data or key material.
 *
 * Deliberately contains no names. A denylist of real names would put those
 * names in the repository, which is the thing it is meant to prevent. Instead
 * it checks three things:
 *
 *   1. Key material, by shape: JWTs, PEM blocks, AWS and GitHub tokens,
 *      Supabase publishable/secret keys, OpenAI-style keys.
 *   2. Email addresses outside the fixture domains. Kenn's tests and seed data
 *      use .test domains on purpose; a real address is a mistake.
 *   3. Whoever is configured in this clone's git identity, read at runtime from
 *      `git config`. So it catches an author's own name or address appearing in
 *      tracked content without that identity ever being committed.
 *
 * Household data never belongs in git at all: see docs/architecture.md and
 * packages/db/CLAUDE.md on seed.sql being fake-household-only.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Domains that exist to be fake. RFC 2606 reserves .test and example.*. */
const FIXTURE_DOMAINS = [
  'example.test',
  'example.com',
  'example.org',
  'kenn.test',
  'email.com', // the Supabase CLI's own default in config.toml
];

const SECRET_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, 'a JWT'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key block'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'a GitHub token'],
  [/\bsk-[A-Za-z0-9]{32,}\b/, 'an OpenAI-style API key'],
  [/\bsb_secret_[A-Za-z0-9_-]{10,}\b/, 'a Supabase secret key'],
  [/\bsb_publishable_[A-Za-z0-9_-]{10,}\b/, 'a Supabase publishable key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'a Slack token'],
];

const EMAIL = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;

/** Binary and generated files we do not scan. */
const SKIP = [
  /^pnpm-lock\.yaml$/,
  /^packages\/db\/types\.ts$/,
  /\.(png|jpg|jpeg|gif|webp|ico|pdf|woff2?|ttf|otf|mp4|zip|gz)$/i,
  /^scripts\/check-private\.mjs$/, // this file names the patterns it looks for
];

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter((f) => !SKIP.some((re) => re.test(f)));
}

function gitIdentity() {
  const read = (key) => {
    try {
      return execFileSync('git', ['config', '--get', key], { encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  };
  const out = [];
  const name = read('user.name');
  const email = read('user.email');
  // Ignore the placeholder identities a CI runner or an agent uses.
  const generic = /^(claude|github[- ]actions|ci|root|unknown|your name)$/i;
  if (name && name.includes(' ') && !generic.test(name))
    out.push({ value: name, what: 'the git user.name configured in this clone' });
  if (
    email &&
    !generic.test(email) &&
    !FIXTURE_DOMAINS.some((d) => email.endsWith(`@${d}`))
  )
    out.push({ value: email, what: 'the git user.email configured in this clone' });
  return out;
}

const findings = [];
const identity = gitIdentity();

for (const file of trackedFiles()) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // unreadable or binary
  }
  if (text.includes('\u0000')) continue;

  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const at = `${file}:${i + 1}`;

    for (const [re, what] of SECRET_PATTERNS) {
      if (re.test(line)) findings.push(`${at}: looks like ${what}`);
    }

    for (const m of line.matchAll(EMAIL)) {
      const domain = m[1].toLowerCase();
      if (!FIXTURE_DOMAINS.includes(domain)) {
        findings.push(
          `${at}: real-looking email address "${m[0]}" — use a .test fixture domain`,
        );
      }
    }

    for (const { value, what } of identity) {
      if (line.includes(value)) {
        findings.push(`${at}: contains ${what}. Use a role, not a person.`);
      }
    }
  });
}

if (findings.length > 0) {
  console.error(`check:private — ${findings.length} problem(s):\n`);
  for (const f of [...new Set(findings)]) console.error(`  ${f}`);
  console.error(
    '\nNo real names, addresses or key material in the repository. Household data\n' +
      'belongs in Postgres behind RLS, never in git. See docs/architecture.md.',
  );
  process.exit(1);
}

console.log(
  `check:private — ${trackedFiles().length} tracked file(s) scanned, nothing private found.`,
);
