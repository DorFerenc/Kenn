/**
 * The generator's own tests, written as the failures it must catch.
 *
 * A gate is only worth the cases it refuses, and the lesson from the ER
 * generator was that a silent omission is the worst failure mode for generated
 * output. So every check has a test that plants the mistake and expects the
 * complaint, and the last test proves the output is idempotent — a generator
 * that passes once and fails next time is what `pnpm check:twice` exists for.
 */

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkMessages, generateCoverage, toMarkdown } from './gen-i18n-coverage.mjs';

/** Write a throwaway messages directory and check it. */
function check(catalogues) {
  const dir = mkdtempSync(join(tmpdir(), 'kenn-i18n-'));
  for (const [locale, messages] of Object.entries(catalogues)) {
    writeFileSync(join(dir, `${locale}.json`), JSON.stringify(messages));
  }
  return { dir, ...checkMessages(dir) };
}

const GENDERED = '{genderForm, select, feminine {סמני} masculine {סמן} other {סמנו}}';

describe('a healthy catalogue', () => {
  it('reports no problem', () => {
    const { problems, keys } = check({
      he: { app: { name: 'קֵן' }, tasks: { markDone: GENDERED } },
      en: { app: { name: 'Kenn' }, tasks: { markDone: 'Mark as done' } },
    });
    expect(problems).toEqual([]);
    expect(keys).toEqual(['app.name', 'tasks.markDone']);
  });

  it('flattens nested namespaces into dotted keys', () => {
    const { keys } = check({
      he: { onboarding: { genderForm: { question: 'איך נפנה אליכם?' } } },
      en: { onboarding: { genderForm: { question: 'How should we address you?' } } },
    });
    expect(keys).toEqual(['onboarding.genderForm.question']);
  });
});

describe('a key in one locale only', () => {
  it('is caught when Hebrew is missing it', () => {
    const { problems } = check({ he: {}, en: { common: { save: 'Save' } } });
    expect(problems).toEqual(['common.save is missing from he.json']);
  });

  it('is caught when English is missing it', () => {
    const { problems } = check({ he: { common: { save: 'שמרו' } }, en: {} });
    expect(problems).toEqual(['common.save is missing from en.json']);
  });
});

describe('an unusable value', () => {
  it('refuses an empty string', () => {
    const { problems } = check({ he: { a: '' }, en: { a: 'A' } });
    expect(problems).toEqual(['he.json: a is empty']);
  });

  it('refuses whitespace', () => {
    const { problems } = check({ he: { a: '   ' }, en: { a: 'A' } });
    expect(problems).toEqual(['he.json: a is empty']);
  });

  it('refuses a value that is not a string', () => {
    const { problems } = check({ he: { a: 7 }, en: { a: 'A' } });
    expect(problems).toEqual(['he.json: a is number, not a string']);
  });

  it('refuses a message that is not valid ICU', () => {
    const { problems } = check({ he: { a: '{unclosed' }, en: { a: 'A' } });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('not valid ICU');
  });
});

describe('a gender form with a missing branch', () => {
  it.each([
    ['feminine', '{genderForm, select, masculine {סמן} other {סמנו}}'],
    ['masculine', '{genderForm, select, feminine {סמני} other {סמנו}}'],
  ])('names the missing %s branch', (missing, message) => {
    const { problems } = check({ he: { a: message }, en: { a: 'A' } });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`no ${missing} branch`);
  });

  it('accepts a select that carries all three', () => {
    const { problems } = check({ he: { a: GENDERED }, en: { a: 'A' } });
    expect(problems).toEqual([]);
  });

  it('leaves a select on something else alone', () => {
    // Only genderForm carries the three-branch rule; a different select is the
    // author's business.
    const { problems } = check({
      he: { a: '{kind, select, test {בדיקה} other {אחר}}' },
      en: { a: '{kind, select, test {Test} other {Other}}' },
    });
    expect(problems).toEqual([]);
  });
});

describe('a dropped placeholder', () => {
  it('is caught when the translation loses it', () => {
    const { problems } = check({
      he: { window: { before: 'ייפתח בקרוב' } },
      en: { window: { before: 'Opens {date}' } },
    });
    expect(problems).toEqual([
      'he.json: window.before drops the {date} placeholder that en.json uses',
    ]);
  });

  it('is caught in the other direction too', () => {
    const { problems } = check({
      he: { window: { before: 'נפתח ב־{date}' } },
      en: { window: { before: 'Opens soon' } },
    });
    expect(problems).toEqual([
      'en.json: window.before drops the {date} placeholder that he.json uses',
    ]);
  });

  it('sees a placeholder used only inside a select branch', () => {
    // The argument is nested two levels down; a check that only looked at the
    // top level would call this a dropped placeholder.
    const { problems } = check({
      he: {
        a: '{genderForm, select, feminine {סמני {date}} masculine {סמן {date}} other {סמנו {date}}}',
      },
      en: { a: 'Mark {date}' },
    });
    expect(problems).toEqual([]);
  });

  it('does not treat genderForm itself as a dropped placeholder', () => {
    // Hebrew selects on it and English has no reason to. This is the normal
    // case for most of the catalogue, so a false positive here would make the
    // gate unusable.
    const { problems } = check({ he: { a: GENDERED }, en: { a: 'Mark as done' } });
    expect(problems).toEqual([]);
  });
});

describe('the document', () => {
  it('lists a gendered key and a placeholder', () => {
    const result = check({
      he: { tasks: { markDone: GENDERED }, window: { before: 'נפתח ב־{date}' } },
      en: { tasks: { markDone: 'Mark as done' }, window: { before: 'Opens {date}' } },
    });
    const markdown = toMarkdown(result);
    expect(markdown).toContain('- `tasks.markDone`');
    expect(markdown).toContain('`{date}`');
  });

  it('flags a value that is identical in both locales without failing', () => {
    const result = check({
      he: { app: { name: 'Kenn' } },
      en: { app: { name: 'Kenn' } },
    });
    expect(result.problems).toEqual([]);
    expect(toMarkdown(result)).toContain('Identical in every locale');
  });

  it('says so when nothing is gendered yet', () => {
    const result = check({ he: { a: 'א' }, en: { a: 'A' } });
    expect(toMarkdown(result)).toContain('_None yet._');
  });

  it('is byte-for-byte identical on a second run', () => {
    const first = generateCoverage();
    const second = generateCoverage();
    expect(second.markdown).toBe(first.markdown);
  });

  it('ends with exactly one newline', () => {
    // Prettier ignores this file, so the generator owns the trailing newline.
    // Getting it wrong is how `check` passed once and failed next time before.
    const { markdown } = generateCoverage();
    expect(markdown.endsWith('\n')).toBe(true);
    expect(markdown.endsWith('\n\n')).toBe(false);
  });
});

describe('no catalogues at all', () => {
  it('is quiet rather than failing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kenn-i18n-empty-'));
    const { problems, keys } = checkMessages(dir);
    expect(problems).toEqual([]);
    expect(keys).toEqual([]);
  });
});
