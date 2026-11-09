/**
 * Generate docs/i18n-coverage.md from apps/web/messages, and refuse a catalogue
 * that would ship a half-translated screen.
 *
 * Hard rule 4 in CLAUDE.md is "no hard-coded UI strings: add he and en keys
 * together, every time". A rule phrased as "together" needs something that
 * notices when they are not, which is this. It fails the gate on:
 *
 *   - a key present in one locale and missing from the other
 *   - an empty or whitespace-only message
 *   - a message that is not valid ICU
 *   - a `genderForm` select missing feminine, masculine or other
 *   - a placeholder that one locale uses and the other dropped
 *
 * The messages are parsed with @formatjs/icu-messageformat-parser — the parser
 * next-intl already uses at runtime, so this reports what the app will actually
 * do rather than what a regex guesses about it.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse, TYPE } from '@formatjs/icu-messageformat-parser';

const MESSAGES = 'apps/web/messages';

/**
 * The gender-form branches every Hebrew message that addresses the reader must
 * carry. The database stores `neutral`; ICU spells that branch `other`. The
 * mapping lives in @kenn/ui's genderBranch(); this is the shape it produces.
 */
const GENDER_ARGUMENT = 'genderForm';
const GENDER_BRANCHES = ['feminine', 'masculine', 'other'];

/** `{ a: { b: 'x' } }` -> `Map { 'a.b' => 'x' }`, so two locales can be compared. */
function flatten(value, prefix = '', out = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, path, out);
    } else {
      out.set(path, child);
    }
  }
  return out;
}

/**
 * Walk an ICU AST once and report everything the checks need: the simple
 * arguments at any depth, and the select arguments with their branches.
 */
function inspect(ast, found = { arguments: new Set(), selects: new Map() }) {
  for (const node of ast) {
    switch (node.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        found.arguments.add(node.value);
        break;
      case TYPE.select:
      case TYPE.plural:
        if (node.type === TYPE.select) {
          found.selects.set(node.value, Object.keys(node.options));
        } else {
          found.arguments.add(node.value);
        }
        for (const option of Object.values(node.options)) {
          inspect(option.value, found);
        }
        break;
      default:
        break;
    }
  }
  return found;
}

function readCatalogues(dir) {
  const locales = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''))
        .sort()
    : [];

  return locales.map((locale) => ({
    locale,
    messages: flatten(JSON.parse(readFileSync(join(dir, `${locale}.json`), 'utf8'))),
  }));
}

/**
 * Check every catalogue in `dir` against every other one.
 *
 * Returns the problems (each a sentence a reader can act on) alongside the
 * facts the document renders. Takes a directory so the tests can point it at a
 * throwaway one.
 */
export function checkMessages(dir = MESSAGES) {
  const catalogues = readCatalogues(dir);
  const problems = [];

  if (catalogues.length === 0)
    return { catalogues, keys: [], problems, parsed: new Map() };

  const keys = [
    ...new Set(catalogues.flatMap(({ messages }) => [...messages.keys()])),
  ].sort();
  const parsed = new Map();

  for (const { locale, messages } of catalogues) {
    for (const key of keys) {
      const message = messages.get(key);

      if (message === undefined) {
        problems.push(`${key} is missing from ${locale}.json`);
        continue;
      }
      if (typeof message !== 'string') {
        problems.push(`${locale}.json: ${key} is ${typeof message}, not a string`);
        continue;
      }
      if (message.trim() === '') {
        problems.push(`${locale}.json: ${key} is empty`);
        continue;
      }

      let found;
      try {
        found = inspect(parse(message));
      } catch (error) {
        problems.push(`${locale}.json: ${key} is not valid ICU — ${error.message}`);
        continue;
      }

      const branches = found.selects.get(GENDER_ARGUMENT);
      if (branches) {
        const missing = GENDER_BRANCHES.filter((b) => !branches.includes(b));
        if (missing.length > 0) {
          problems.push(
            `${locale}.json: ${key} selects on ${GENDER_ARGUMENT} but has no ` +
              `${missing.join(' or ')} branch. Hebrew addresses the reader by ` +
              `gender, and ICU needs an \`other\` branch for the neutral plural.`,
          );
        }
      }

      parsed.set(`${locale}\u0000${key}`, found);
    }
  }

  // A placeholder one locale uses and the other dropped: the Hebrew says "opens
  // soon" where the English says the date, and nothing fails until a parent
  // reads it.
  const [reference, ...others] = catalogues;
  for (const { locale, messages } of others) {
    for (const key of keys) {
      if (!messages.has(key) || !reference.messages.has(key)) continue;
      const mine = parsed.get(`${locale}\u0000${key}`);
      const theirs = parsed.get(`${reference.locale}\u0000${key}`);
      if (!mine || !theirs) continue;
      for (const argument of theirs.arguments) {
        if (!mine.arguments.has(argument)) {
          problems.push(
            `${locale}.json: ${key} drops the {${argument}} placeholder that ` +
              `${reference.locale}.json uses`,
          );
        }
      }
      for (const argument of mine.arguments) {
        if (!theirs.arguments.has(argument)) {
          problems.push(
            `${reference.locale}.json: ${key} drops the {${argument}} placeholder ` +
              `that ${locale}.json uses`,
          );
        }
      }
    }
  }

  return { catalogues, keys, problems, parsed };
}

function namespaceOf(key) {
  const dot = key.indexOf('.');
  return dot === -1 ? key : key.slice(0, dot);
}

export function toMarkdown(result) {
  const { catalogues, keys, parsed } = result;
  const localeNames = catalogues.map((c) => c.locale);

  const gendered = keys.filter((key) =>
    localeNames.some((l) => parsed.get(`${l}\u0000${key}`)?.selects.has(GENDER_ARGUMENT)),
  );

  const untranslated = keys.filter((key) => {
    const values = catalogues.map((c) => c.messages.get(key));
    return values.length > 1 && new Set(values).size === 1;
  });

  const namespaces = [...new Set(keys.map(namespaceOf))].sort();

  const lines = [
    '# i18n coverage',
    '',
    '<!-- Generated by `pnpm docs:gen` from apps/web/messages. Do not edit by hand. -->',
    '',
    `${keys.length} key(s) across ${localeNames.length} locale(s): ` +
      `${localeNames.map((l) => `\`${l}\``).join(', ')}. ` +
      'Every key exists in every locale, or the gate fails.',
    '',
    '| Namespace | Keys | Gendered | Placeholders |',
    '| --- | --- | --- | --- |',
  ];

  for (const namespace of namespaces) {
    const inNamespace = keys.filter((k) => namespaceOf(k) === namespace);
    const genderedHere = inNamespace.filter((k) => gendered.includes(k)).length;
    const placeholders = new Set(
      inNamespace.flatMap((k) =>
        localeNames.flatMap((l) => [...(parsed.get(`${l}\u0000${k}`)?.arguments ?? [])]),
      ),
    );
    const shown = [...placeholders]
      .filter((p) => p !== GENDER_ARGUMENT)
      .sort()
      .map((p) => `\`{${p}}\``);
    lines.push(
      `| \`${namespace}\` | ${inNamespace.length} | ${genderedHere} | ` +
        `${shown.length > 0 ? shown.join(', ') : '—'} |`,
    );
  }

  lines.push(
    '',
    '## Gendered keys',
    '',
    'Hebrew addresses the reader by gender. Each of these selects on ' +
      `\`${GENDER_ARGUMENT}\` with a \`feminine\`, \`masculine\` and \`other\` branch, ` +
      'where `other` is the neutral plural and is what `member.gender_form = ' +
      "'neutral'` resolves to.",
    '',
  );
  lines.push(
    gendered.length > 0 ? gendered.map((k) => `- \`${k}\``).join('\n') : '_None yet._',
  );

  if (untranslated.length > 0) {
    lines.push(
      '',
      '## Identical in every locale',
      '',
      'Not an error — a product name or a symbol is the same everywhere — but ' +
        'worth a look, because an untranslated string looks exactly like this.',
      '',
      untranslated.map((k) => `- \`${k}\``).join('\n'),
    );
  }

  lines.push('');
  return lines.join('\n');
}

/** What `pnpm docs:gen` calls. */
export function generateCoverage(dir = MESSAGES) {
  const result = checkMessages(dir);
  return {
    markdown: toMarkdown(result),
    problems: result.problems,
    keyCount: result.keys.length,
    localeCount: result.catalogues.length,
  };
}
