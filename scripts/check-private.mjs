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
 *   3. Whoever has authored or committed in this clone, read at runtime from
 *      `git config` and `git log`. So it catches an author's own name, GitHub
 *      handle or address appearing in tracked content, without that identity
 *      ever being committed.
 *
 *      `git config` alone was not enough. In a Claude Code cloud session the
 *      configured name is "Claude", which this file correctly ignores as a bot
 *      — so the check that was verified by planting a name did nothing in the
 *      environment where most of the writing now happens. `git log` carries the
 *      real identities in any clone with history, including CI.
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
  // Israeli personal data the project rules name explicitly: no bank details,
  // and a household's own phone numbers belong in Postgres, not in git. The
  // emergency card's public numbers (101, 100) are three digits and unaffected.
  [/\b05\d[-\s]?\d{7}\b/, 'an Israeli mobile number'],
  [/\bIL\d{2}[-\s]?\d{19}\b/, 'an Israeli IBAN'],
  // A home directory names its user.
  [
    /\/(?:home|Users)\/(?!root\b|user\b|runner\b|ubuntu\b|node\b|vscode\b)[A-Za-z0-9._-]{2,}/,
    'a path containing a username',
  ],
  // A hosted Supabase project reference. Infrastructure identity belongs in the
  // deployment's environment, not in the repository.
  [/\bhttps:\/\/[a-z]{20}\.supabase\.(?:co|in)\b/, 'a hosted Supabase project reference'],
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

/** Bots and placeholders. These are not people, so they are not identities. */
const GENERIC =
  /^(claude|claude code|github[- ]actions(\[bot\])?|dependabot(\[bot\])?|ci|root|unknown|your name|user)$/i;
const BOT_EMAIL = /@(anthropic\.com|users\.noreply\.github\.com|github\.com)$/i;

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/**
 * Everyone this clone knows about: the configured identity, plus every author
 * and committer in the history. Read at runtime and never written anywhere, so
 * the guard still carries no list of names.
 */
function gitIdentities() {
  const found = new Map();
  const addName = (name, what) => {
    // A full name has a space; a single word is too likely to be an ordinary
    // English word appearing in prose.
    if (name && name.includes(' ') && !GENERIC.test(name)) found.set(name, what);
  };
  const addEmail = (email, what) => {
    if (!email || GENERIC.test(email) || BOT_EMAIL.test(email)) return;
    if (FIXTURE_DOMAINS.some((d) => email.endsWith(`@${d}`))) return;
    found.set(email, what);
  };

  addName(
    git(['config', '--get', 'user.name']),
    'the git user.name configured in this clone',
  );
  addEmail(
    git(['config', '--get', 'user.email']),
    'the git user.email configured in this clone',
  );

  for (const line of git(['log', '--format=%an%x00%ae%x00%cn%x00%ce']).split('\n')) {
    const [authorName, authorEmail, committerName, committerEmail] = line.split('\0');
    addName(authorName, 'the name of an author in this repository history');
    addName(committerName, 'the name of a committer in this repository history');
    addEmail(authorEmail, 'the address of an author in this repository history');
    addEmail(committerEmail, 'the address of a committer in this repository history');

    // `1234567+handle@users.noreply.github.com` carries a GitHub username.
    for (const email of [authorEmail, committerEmail]) {
      const handle = /^\d+\+([A-Za-z0-9-]{4,})@users\.noreply\.github\.com$/i.exec(
        email ?? '',
      )?.[1];
      if (handle) found.set(handle, 'a GitHub handle from this repository history');
    }
  }

  return [...found].map(([value, what]) => ({ value, what }));
}

const findings = [];
const identity = gitIdentities();

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
