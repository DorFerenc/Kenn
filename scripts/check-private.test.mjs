/**
 * The privacy guard's own tests.
 *
 * They exist because the guard was green for a whole session while doing
 * nothing: its identity check read `git config`, which in a cloud session is a
 * bot it correctly ignores, so it scanned for nobody and said "nothing found".
 * A security check that can quietly degrade to a no-op needs tests that do not
 * depend on the environment it happens to run in — so these call `scanText`
 * with planted content and explicit identities, and never shell out to git.
 *
 * Every pattern gets a test that plants it. A pattern with no test is a
 * pattern nobody has seen fire.
 */

import { describe, expect, it } from 'vitest';
import { scanText } from './check-private.mjs';

const scan = (text, identities = []) => scanText('docs/fixture.md', text, identities);
const PERSON = [{ value: 'Ada Lovelace', what: 'the name of an author' }];
const HANDLE = [{ value: 'alovelace', what: 'a GitHub handle' }];

describe('key material', () => {
  it.each([
    ['a JWT', 'token: eyJhbGciOiJIUzI1NiwidHlwIjoiSldUIn0.abcdefghijkl'],
    ['a private key block', '-----BEGIN RSA PRIVATE KEY-----'],
    ['an AWS access key id', 'AKIAIOSFODNN7EXAMPLE'],
    ['a GitHub token', 'ghp_0123456789abcdefghijklmnopqrstuvwxyzAB'],
    ['a GitHub fine-grained token', 'github_pat_0123456789abcdefghijklmnopqrstuvwxyz'],
    // The shape this project will certainly hold, and the one the original
    // `sk-[A-Za-z0-9]{32,}` could not match because it admits no hyphen.
    ['an Anthropic API key', 'sk-ant-api03-AAAAbbbbCCCCddddEEEEffffGGGG'],
    ['an OpenAI-style API key', 'sk-abcdefghijklmnopqrstuvwxyz0123456789'],
    // Exactly 35 characters after the prefix, which is the real shape; built
    // rather than typed, because a hand-counted fixture tests the fixture.
    ['a Google API key', `AIza${'b'.repeat(35)}`],
    ['a Supabase secret key', 'sb_secret_abcdefghijklmnop'],
    ['a Supabase publishable key', 'sb_publishable_abcdefghijklmnop'],
    ['a Slack token', 'xoxb-1234567890-abcdefghij'],
    [
      'a database connection string with a password',
      'postgresql://postgres:hunter2@db.example.com:5432/postgres',
    ],
  ])('catches %s', (what, planted) => {
    const findings = scan(planted);
    expect(findings.join('\n')).toContain(what);
  });
});

describe('Israeli personal data', () => {
  it.each([
    '050-1234567',
    '0501234567',
    '050 123 4567',
    '+972-50-1234567',
    '972501234567',
  ])('catches the mobile number %s', (planted) => {
    expect(scan(`call ${planted}`).join('\n')).toContain('mobile number');
  });

  it('leaves the public emergency numbers alone', () => {
    // The emergency card lists these, and a guard that fires on them would be
    // turned off before the card ships.
    expect(scan('Ambulance 101, police 100, fire 102.')).toEqual([]);
  });

  it.each(['IL620108000000099999999', 'IL62 0108 0000 0009 9999 999'])(
    'catches the IBAN %s, grouped or not',
    (planted) => {
      expect(scan(planted).join('\n')).toContain('IBAN');
    },
  );
});

describe('identifiers that name infrastructure or a person', () => {
  it('catches a path containing a username', () => {
    expect(scan('/home/someperson/kenn').join('\n')).toContain('username');
  });

  it.each(['root', 'runner', 'ubuntu', 'node'])(
    'allows the generic path /home/%s',
    (who) => {
      expect(scan(`/home/${who}/kenn`)).toEqual([]);
    },
  );

  it.each([
    'https://abcdefghijklmnopqrst.supabase.co',
    'db.abcdefghijklmnop1234.supabase.co',
    'SUPABASE_PROJECT_ID=abcdefghijklmnop1234.supabase.co',
  ])('catches the project reference in %s', (planted) => {
    expect(scan(planted).join('\n')).toContain('Supabase project reference');
  });
});

describe('email addresses', () => {
  it.each([
    'dev-one@kenn.test',
    'owner@example.test',
    'someone@example.com',
    'admin@email.com',
  ])('allows the fixture address %s', (address) => {
    expect(scan(`contact ${address}`)).toEqual([]);
  });

  it('catches a real-looking address', () => {
    expect(scan('contact someone@gmail.com').join('\n')).toContain(
      'real-looking email address',
    );
  });

  it('does not reprint the address it found', () => {
    // A CI log is public and permanent. Echoing the address would put it
    // somewhere the author cannot delete it from.
    const finding = scan('contact firstname.lastname@gmail.com').join('\n');
    expect(finding).not.toContain('firstname.lastname');
    expect(finding).toContain('f…@gmail.com');
  });
});

describe('identities', () => {
  it('catches a full name', () => {
    expect(scan('Reviewed by Ada Lovelace.', PERSON).join('\n')).toContain(
      'Use a role, not a person',
    );
  });

  it('catches a name Prettier reflowed across two lines', () => {
    // The failure a line-by-line match goes quiet on, which is the one most
    // likely to happen in a markdown document.
    expect(scan('Reviewed by Ada\nLovelace, who approved it.', PERSON)).toHaveLength(1);
  });

  it('is case-insensitive', () => {
    expect(scan('REVIEWED BY ADA LOVELACE', PERSON)).toHaveLength(1);
  });

  it('matches a handle on a word boundary, not as a substring', () => {
    // A contributor whose handle is a common word must not make the gate fail
    // on hundreds of unrelated lines; a gate that cries wolf gets bypassed.
    expect(scan('see github.com/alovelace', HANDLE)).toHaveLength(1);
    expect(scan('the alovelaceable option', HANDLE)).toEqual([]);
  });

  it('leaves an attribution file alone', () => {
    // A licence must keep the author it credits, or the only way to a green
    // gate is deleting legally required attribution.
    expect(scanText('LICENSE', 'Copyright (c) Ada Lovelace', PERSON)).toEqual([]);
    expect(scanText('NOTICE.md', 'Ada Lovelace', PERSON)).toEqual([]);
  });

  it('scans a normal document for the same name', () => {
    expect(scanText('docs/plan.md', 'Ada Lovelace', PERSON)).toHaveLength(1);
  });
});

describe('clean content', () => {
  it('reports nothing for ordinary prose', () => {
    expect(
      scan('The household table carries references to auth.users, behind RLS.', PERSON),
    ).toEqual([]);
  });
});
