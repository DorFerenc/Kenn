/**
 * pnpm check:private — refuse to commit private data or key material.
 *
 * Deliberately contains no names. A denylist of real names would put those
 * names in the repository, which is the thing it is meant to prevent. Instead
 * it checks three things:
 *
 *   1. Key material and personal-data shapes, from `private-patterns.mjs`.
 *   2. Email addresses outside the fixture domains. Kenn's tests and seed data
 *      use .test domains on purpose; a real address is a mistake.
 *   3. Whoever has authored or committed in this clone, read at runtime from
 *      `git config` and `git log` and never written down. So it catches an
 *      author's own name, GitHub handle or address in tracked content without
 *      that identity ever being committed.
 *
 * **Scope, so nobody reads more into a green run than is there.** This scans
 * the working tree, not history: it answers "is private data in the checkout
 * now", not "has private data ever entered this repository". A key committed
 * and then deleted leaves this green while the blob stays reachable in
 * history — that is what GitHub secret scanning with push protection is for,
 * and it is a repository setting, not something a script can assert.
 *
 * It also cannot catch the shapes that matter most for an app about one
 * family: a relative's name, a clinic, a real due date, a real measurement.
 * `packages/db/CLAUDE.md` forbids those, and only a human reviewer can see
 * them. "Does anything in this diff describe a real person, place or date?"
 * belongs on the review checklist for exactly that reason.
 *
 * Household data never belongs in git at all: see docs/architecture.md and
 * packages/db/CLAUDE.md on seed.sql being fake-household-only.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ATTRIBUTION_FILES,
  FIXTURE_ADDRESSES,
  FIXTURE_DOMAINS,
  SECRET_PATTERNS,
} from './private-patterns.mjs';

const EMAIL = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;

/** Binary and generated files we do not scan. */
const SKIP = [
  /^pnpm-lock\.yaml$/,
  /^packages\/db\/types\.ts$/,
  /\.(png|jpg|jpeg|gif|webp|ico|pdf|woff2?|ttf|otf|mp4|zip|gz)$/i,
  /^scripts\/private-patterns\.mjs$/, // it names the shapes it looks for
  // Every value in it is a synthetic fixture planted to prove a pattern
  // fires. A detector's own tests cannot avoid containing what it detects.
  /^scripts\/check-private\.test\.mjs$/,
];

/** Bots and placeholders. These are not people, so they are not identities. */
const GENERIC =
  /^(claude|claude code|github[- ]actions(\[bot\])?|dependabot(\[bot\])?|ci|root|unknown|your name|user|node|test|main|docs|next|admin|owner)$/i;
const BOT_EMAIL = /@(anthropic\.com|users\.noreply\.github\.com|github\.com)$/i;

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export function trackedFiles() {
  return git(['ls-files'])
    .split('\n')
    .filter(Boolean)
    .filter((f) => !SKIP.some((re) => re.test(f)));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Everyone this clone knows about: the configured identity, plus every author
 * and committer in the history. Read at runtime and never written anywhere, so
 * the guard still carries no list of names.
 *
 * `git config` alone was not enough. In a Claude Code cloud session the
 * configured name is a bot, which this correctly ignores — so the check did
 * nothing in the environment where most of the writing happens. `git log`
 * covers any clone **with history**: a CI job must check out with
 * `fetch-depth: 0`, and `assertIdentitiesFound()` below fails loudly when it
 * has not, because a guard that silently degrades to a no-op is worse than no
 * guard.
 */
export function gitIdentities() {
  const found = new Map();

  const addName = (name, what) => {
    // A full name has a space; a single word is too likely to be an ordinary
    // English word appearing in prose.
    if (name && name.includes(' ') && !GENERIC.test(name)) found.set(name, what);
  };
  const addEmail = (email, what) => {
    if (!email || GENERIC.test(email) || BOT_EMAIL.test(email)) return;
    if (FIXTURE_ADDRESSES.includes(email.toLowerCase())) return;
    if (FIXTURE_DOMAINS.some((d) => email.toLowerCase().endsWith(`@${d}`))) return;
    found.set(email, what);
  };

  addName(git(['config', '--get', 'user.name']), 'the git user.name of this clone');
  addEmail(git(['config', '--get', 'user.email']), 'the git user.email of this clone');

  for (const line of git(['log', '--format=%an%x00%ae%x00%cn%x00%ce']).split('\n')) {
    const [authorName, authorEmail, committerName, committerEmail] = line.split('\0');
    addName(authorName, 'the name of an author in this repository history');
    addName(committerName, 'the name of a committer in this repository history');
    addEmail(authorEmail, 'the address of an author in this repository history');
    addEmail(committerEmail, 'the address of a committer in this repository history');

    // A GitHub no-reply address carries a numeric id, a plus sign and the
    // account's username, before the no-reply domain. That username is an
    // identity even though the address itself is pseudonymous.
    for (const email of [authorEmail, committerEmail]) {
      const handle = /^\d+\+([A-Za-z0-9-]{5,})@users\.noreply\.github\.com$/i.exec(
        email ?? '',
      )?.[1];
      // A handle is one word, so it goes through GENERIC and is matched on a
      // word boundary below. A contributor called `node` must not make the
      // gate fail on several hundred unrelated lines.
      if (handle && !GENERIC.test(handle)) {
        found.set(handle, 'a GitHub handle from this repository history');
      }
    }
  }

  return [...found].map(([value, what]) => ({ value, what }));
}

/** Show a real-looking address without reprinting it into a CI log. */
function maskAddress(address) {
  const [local = '', domain = ''] = address.split('@');
  return `${local.slice(0, 1)}…@${domain}`;
}

/**
 * Scan one file's text. Exported so the self-test can plant each shape without
 * depending on the environment the guard happens to run in.
 */
export function scanText(file, text, identities = []) {
  const findings = [];

  text.split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`;

    for (const [re, what] of SECRET_PATTERNS) {
      if (re.test(line)) findings.push(`${at}: looks like ${what}`);
    }

    for (const m of line.matchAll(EMAIL)) {
      const address = m[0].toLowerCase();
      if (FIXTURE_ADDRESSES.includes(address)) continue;
      if (FIXTURE_DOMAINS.includes(m[1].toLowerCase())) continue;
      // Masked on purpose: a CI log is public and permanent, so echoing the
      // address would put it somewhere the author cannot delete it from.
      findings.push(
        `${at}: real-looking email address ${maskAddress(address)} — use a .test fixture domain`,
      );
    }
  });

  // Identities are matched against the whole file with whitespace collapsed,
  // because Prettier reflowing a paragraph can split a full name across two
  // lines and a line-by-line match would go quiet exactly then.
  if (!ATTRIBUTION_FILES.test(file)) {
    const flat = text.replace(/\s+/g, ' ');
    for (const { value, what } of identities) {
      const pattern = value.includes(' ')
        ? new RegExp(escapeRe(value), 'i')
        : new RegExp(`\\b${escapeRe(value)}\\b`, 'i');
      if (pattern.test(flat)) {
        findings.push(`${file}: contains ${what}. Use a role, not a person.`);
      }
    }
  }

  return findings;
}

function main() {
  const files = trackedFiles();
  const identity = gitIdentities();
  const findings = [];

  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue; // unreadable or binary
    }
    if (text.includes('\u0000')) continue;
    findings.push(...scanText(file, text, identity));
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

  if (identity.length === 0) {
    // Not a pass. The identity half of this guard checked nobody, which is how
    // it was green for a whole session while doing nothing.
    console.error(
      'check:private — no identities could be read from `git config` or `git log`,\n' +
        'so the name check scanned for nobody and only the shape checks ran.\n' +
        'In CI this means the checkout has no history: set `fetch-depth: 0`.',
    );
    process.exit(1);
  }

  console.log(
    `check:private — ${files.length} tracked file(s) scanned against ` +
      `${identity.length} identit(ies), nothing private found.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
