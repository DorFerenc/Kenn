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
 *   - a placeholder, a select or a rich-text tag that one locale dropped
 *   - a `t('...')` call naming a key no catalogue defines
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
 * arguments at any depth, the select arguments with their branches, and the
 * rich-text tags.
 *
 * Tags matter as much as arguments. next-intl throws at render when a message
 * contains a tag the call site did not supply a handler for, so a component
 * written against English crashes the Hebrew page — and a `{date}` nested
 * inside `<link>…</link>` is invisible to a walk that does not descend into
 * tag children.
 */
function inspect(
  ast,
  found = { arguments: new Set(), selects: new Map(), tags: new Set() },
) {
  for (const node of ast) {
    switch (node.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        found.arguments.add(node.value);
        break;
      case TYPE.tag:
        found.tags.add(node.value);
        inspect(node.children, found);
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

/**
 * Everything a call site must supply for this message, as one set.
 *
 * `genderForm` is the one deliberate exception: `genderValues()` always
 * supplies it, and Hebrew selects on it where English has no reason to. Every
 * other select argument belongs here — a select present in one locale and
 * absent in the other throws "the intl string context variable was not
 * provided" on the locale that has it.
 */
function requiredOf(found) {
  return new Set([
    ...[...found.arguments].map((name) => `{${name}} placeholder`),
    ...[...found.selects.keys()]
      .filter((name) => name !== GENDER_ARGUMENT)
      .map((name) => `{${name}} select`),
    ...[...found.tags].map((tag) => `<${tag}> tag`),
  ]);
}

/**
 * The locales the interface actually serves, read from @kenn/ui rather than
 * restated here. Parsed from the source instead of imported, for the reason
 * gen-kb-catalog.mjs reads YAML rather than the zod schema: `pnpm docs:gen`
 * stays a plain node script with no TypeScript build step.
 */
function supportedLocales(
  source = 'packages/ui/src/locales.ts',
  fallback = ['he', 'en'],
) {
  if (!existsSync(source)) return fallback;
  const match = /export const locales = \[([^\]]*)\]/.exec(readFileSync(source, 'utf8'));
  if (!match?.[1]) return fallback;
  return [...match[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
}

/**
 * Keys repeated inside one object. `JSON.parse` keeps the last silently, so a
 * catalogue can carry two values for one key and the gate would report only
 * the survivor. Scans the raw text, tracking strings and escapes.
 */
function duplicateKeys(text) {
  const duplicates = [];
  const stack = [new Set()];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      let value = '';
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\') {
          value += text[j + 1];
          j += 2;
          continue;
        }
        value += text[j];
        j += 1;
      }
      // A string is a key when the next non-space character is a colon.
      let k = j + 1;
      while (k < text.length && /\s/.test(text[k] ?? '')) k += 1;
      if (text[k] === ':') {
        const seen = stack[stack.length - 1];
        if (seen?.has(value)) duplicates.push(value);
        seen?.add(value);
      }
      i = j + 1;
      continue;
    }
    if (ch === '{') stack.push(new Set());
    else if (ch === '}') stack.pop();
    i += 1;
  }
  return duplicates;
}

function readCatalogues(dir, problems = []) {
  if (!existsSync(dir)) return [];
  const supported = supportedLocales();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const catalogues = [];
  for (const file of files) {
    const locale = file.replace(/\.json$/, '');
    if (!supported.includes(locale)) {
      // Otherwise a stray schema.json becomes a locale and every key is
      // reported as missing from it, or an ar.json quietly becomes a third
      // language the app cannot serve.
      problems.push(
        `${file} is not one of the locales @kenn/ui serves (${supported.join(', ')}). ` +
          `Add the locale there first, or remove the file.`,
      );
      continue;
    }
    const text = readFileSync(join(dir, file), 'utf8');
    for (const key of duplicateKeys(text)) {
      problems.push(`${file}: "${key}" appears twice in the same object`);
    }
    catalogues.push({ locale, messages: flatten(JSON.parse(text)) });
  }
  return catalogues;
}

/**
 * Every message key named by a `t('...')` call in the app, with the namespace
 * its translator was created with.
 *
 * This is the half of hard rule 4 the catalogues cannot check. next-intl's
 * default fallback renders the key path, so `t('app.nmae')` ships the literal
 * string `app.nmae` to a parent's screen with both catalogues perfectly in
 * sync and the gate green.
 *
 * Deliberately conservative: a file using more than one namespace is skipped
 * rather than guessed at, and a template-literal key cannot be resolved
 * statically, so its prefix is recorded as dynamic and never reported.
 */
export function usedKeys(roots = ['apps/web/app', 'apps/web/lib']) {
  const literal = [];
  const dynamicPrefixes = new Set();

  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;

      const text = readFileSync(full, 'utf8');
      const namespaces = [
        ...[...text.matchAll(/use[A-Za-z]*Translations\(\s*'([^']+)'/g)].map((m) => m[1]),
        ...[...text.matchAll(/namespace:\s*'([^']+)'/g)].map((m) => m[1]),
      ];
      const unique = [...new Set(namespaces)];
      if (unique.length > 1) continue; // ambiguous; do not guess
      const prefix = unique[0] ? `${unique[0]}.` : '';

      for (const m of text.matchAll(/\bt\(\s*'([A-Za-z][\w.]*)'/g)) {
        literal.push({ file: full, key: `${prefix}${m[1]}` });
      }
      for (const m of text.matchAll(/\bt\(\s*`([A-Za-z][\w.]*)\$\{/g)) {
        dynamicPrefixes.add(`${prefix}${m[1]}`);
      }
    }
  };

  for (const root of roots) walk(root);
  return { literal, dynamicPrefixes };
}

/**
 * Check every catalogue in `dir` against every other one.
 *
 * Returns the problems (each a sentence a reader can act on) alongside the
 * facts the document renders. Takes a directory so the tests can point it at a
 * throwaway one.
 */
export function checkMessages(dir = MESSAGES, { scanUsage = false } = {}) {
  const problems = [];
  const catalogues = readCatalogues(dir, problems);

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
      // Not `trim()`: a message of invisible formatting characters is empty
      // to a reader. `he.json` legitimately contains a word-joiner, so a
      // stray RLM left by a paste is a plausible accident.
      if (message.replace(/[\s\p{Cf}]/gu, '') === '') {
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
      const ours = requiredOf(mine);
      const theirRequired = requiredOf(theirs);
      for (const argument of theirRequired) {
        if (!ours.has(argument)) {
          problems.push(
            `${locale}.json: ${key} drops the ${argument} that ` +
              `${reference.locale}.json uses`,
          );
        }
      }
      for (const argument of ours) {
        if (!theirRequired.has(argument)) {
          problems.push(
            `${reference.locale}.json: ${key} drops the ${argument} ` +
              `that ${locale}.json uses`,
          );
        }
      }
    }
  }

  // A key a component asks for that no catalogue defines.
  const unreferenced = [];
  if (scanUsage) {
    const { literal, dynamicPrefixes } = usedKeys();
    const known = new Set(keys);
    for (const { file, key } of literal) {
      if (!known.has(key)) {
        problems.push(
          `${file}: t('${key}') names a key no catalogue defines — next-intl ` +
            `would render the key path to the screen`,
        );
      }
    }
    const referenced = new Set(literal.map((u) => u.key));
    for (const key of keys) {
      if (referenced.has(key)) continue;
      if ([...dynamicPrefixes].some((p) => key.startsWith(p))) continue;
      unreferenced.push(key);
    }
  }

  return { catalogues, keys, problems, parsed, unreferenced };
}

function namespaceOf(key) {
  const dot = key.indexOf('.');
  return dot === -1 ? key : key.slice(0, dot);
}

export function toMarkdown(result) {
  const { catalogues, keys, parsed, unreferenced = [] } = result;
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

  if (unreferenced.length > 0) {
    lines.push(
      '',
      '## Defined and not used',
      '',
      'No `t()` call names these. Not an error — a key may be waiting for the ' +
        'screen that uses it — but each one is a string nobody has seen ' +
        'rendered. Keys reached through a template literal are excluded, ' +
        'because a static scan cannot resolve them.',
      '',
      unreferenced.map((k) => `- \`${k}\``).join('\n'),
    );
  }

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
  const result = checkMessages(dir, { scanUsage: true });
  return {
    markdown: toMarkdown(result),
    problems: result.problems,
    keyCount: result.keys.length,
    localeCount: result.catalogues.length,
  };
}
