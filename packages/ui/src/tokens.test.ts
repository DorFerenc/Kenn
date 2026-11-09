/**
 * The design system's gate.
 *
 * Two rules from packages/ui/CLAUDE.md are asserted here rather than reviewed:
 * "a component that hard-codes a colour or a spacing value is a bug", and
 * "contrast holds in dark mode, which is the default at night". Both are the
 * kind of rule that survives exactly as long as someone remembers it, so they
 * are a test instead.
 *
 * The repository scan at the bottom also covers CSS, which ESLint does not
 * read. One mechanism for both file kinds beats two that each cover half.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AA, contrastRatio, isHex, type Hex } from './contrast.ts';

const TOKENS_FILE = 'packages/ui/src/tokens.css';
const css = readFileSync(TOKENS_FILE, 'utf8');

// --------------------------------------------------------------- parsing

/** Strip `/* *\/` and `//` comments, so prose cannot satisfy or trip a scan. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/**
 * The declarations of one brace-delimited block, by the text that opens it.
 * Deliberately simple: the token file is the only input, and a real CSS parser
 * would be a dependency guarding thirty lines of literals.
 */
function declarations(source: string, opener: string): Map<string, string> {
  const start = source.indexOf(opener);
  if (start === -1) throw new Error(`${TOKENS_FILE} has no \`${opener}\` block`);
  let depth = 0;
  let i = source.indexOf('{', start);
  const from = i + 1;
  for (; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const body = source.slice(from, i);
  const out = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (name && value) out.set(name, value.trim().replace(/\s+/g, ' '));
  }
  return out;
}

const clean = stripComments(css);
const light = declarations(clean, '@theme');
const darkOverrides = declarations(clean, '@media (prefers-color-scheme: dark)');

/** Light values, then the dark block's overrides on top. */
const dark = new Map([...light, ...darkOverrides]);

/** Follow `var(--other)` until a literal value. */
function resolve(tokens: Map<string, string>, name: string): string {
  const seen = new Set<string>();
  let value = tokens.get(name);
  while (value !== undefined) {
    const alias = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value)?.[1];
    if (!alias) return value;
    if (seen.has(alias)) throw new Error(`token alias cycle at ${name}`);
    seen.add(alias);
    value = tokens.get(alias);
  }
  throw new Error(`${TOKENS_FILE} does not define ${name}`);
}

function colour(tokens: Map<string, string>, name: string): Hex {
  const value = resolve(tokens, name);
  if (!isHex(value)) throw new Error(`${name} is not a hex colour: ${value}`);
  return value;
}

const THEMES = [
  { name: 'light', tokens: light },
  { name: 'dark', tokens: dark },
] as const;

// ---------------------------------------------------------------- contrast

/**
 * Every pair that has to hold, and the threshold it has to hold at. A new
 * colour token belongs in this table or it is not accessible — nobody has
 * checked it.
 */
const CONTRAST_PAIRS = [
  ['--color-text', '--color-surface', AA.text],
  ['--color-text', '--color-surface-raised', AA.text],
  ['--color-text', '--color-surface-sunken', AA.text],
  ['--color-text-muted', '--color-surface', AA.text],
  ['--color-text-muted', '--color-surface-raised', AA.text],
  ['--color-accent', '--color-surface', AA.text],
  ['--color-accent', '--color-surface-raised', AA.text],
  ['--color-on-accent', '--color-accent', AA.text],
  ['--color-success', '--color-surface', AA.text],
  ['--color-danger', '--color-surface', AA.text],
  ['--color-warning', '--color-surface', AA.text],
  ['--color-focus', '--color-surface', AA.nonText],
  // The task window's bar conveys state, so WCAG 1.4.11 applies to all three.
  ['--color-window-before', '--color-surface', AA.nonText],
  ['--color-window-inside', '--color-surface', AA.nonText],
  ['--color-window-after', '--color-surface', AA.nonText],
  // An evidence badge is read as text.
  ['--color-evidence-strong', '--color-surface', AA.text],
  ['--color-evidence-moderate', '--color-surface', AA.text],
  ['--color-evidence-weak', '--color-surface', AA.text],
  ['--color-evidence-custom', '--color-surface', AA.text],
  ['--color-border-strong', '--color-surface', AA.nonText],
] as const;

describe.each(THEMES)('$name theme', ({ tokens }) => {
  it.each(CONTRAST_PAIRS)('%s on %s reaches %s:1', (fg, bg, threshold) => {
    const ratio = contrastRatio(colour(tokens, fg), colour(tokens, bg));
    expect(
      ratio,
      `${fg} on ${bg} is ${ratio.toFixed(2)}:1, below the ${threshold}:1 minimum`,
    ).toBeGreaterThanOrEqual(threshold);
  });
});

// -------------------------------------------------------------- the system

describe('token system', () => {
  it('keeps every spacing utility on the 8-pt grid', () => {
    // Tailwind multiplies this one value, so `p-1` is 8px and `p-0.5` is the
    // only sub-8 step the scale can express.
    expect(light.get('--spacing')).toBe('0.5rem');
  });

  it('holds the tap target at 48px', () => {
    expect(light.get('--size-tap')).toBe('3rem');
  });

  it('overrides every literal colour in the dark theme', () => {
    const literal = [...light]
      .filter(([name, value]) => name.startsWith('--color-') && isHex(value))
      .map(([name]) => name);

    expect(literal.length).toBeGreaterThan(0);
    for (const name of literal) {
      expect(
        darkOverrides.has(name),
        `${name} has no dark value; dark mode is the night default, not a theme`,
      ).toBe(true);
    }
  });

  it('introduces no colour in the dark theme that the light theme lacks', () => {
    for (const name of darkOverrides.keys()) {
      expect(light.has(name), `${name} exists only in dark mode`).toBe(true);
    }
  });

  it('resolves semantic aliases rather than repeating a hex', () => {
    // The window states and the evidence badges must be aliases: a fifth and
    // sixth literal red would be a fifth and sixth thing to keep accessible.
    for (const name of [
      '--color-window-before',
      '--color-window-inside',
      '--color-window-after',
      '--color-evidence-strong',
      '--color-evidence-moderate',
      '--color-evidence-weak',
      '--color-evidence-custom',
    ]) {
      expect(light.get(name), `${name} should alias a base colour`).toMatch(
        /^var\(--color-[\w-]+\)$/,
      );
    }
  });
});

// ------------------------------------------------------- repository scan

const SCAN_ROOTS = ['apps/web', 'packages/ui'];
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.css'];
const SKIP_DIRECTORIES = new Set(['node_modules', '.next', 'dist', 'coverage']);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRECTORIES.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (SCAN_EXTENSIONS.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

/** Test files may hold a colour literal as a fixture; source files may not. */
const isTest = (file: string) => /\.test\.tsx?$/.test(file);

const scanned = SCAN_ROOTS.flatMap(sourceFiles).map((file) => ({
  file,
  body: stripComments(readFileSync(file, 'utf8')),
}));

describe('repository', () => {
  it('has files to scan', () => {
    expect(scanned.length).toBeGreaterThan(0);
  });

  it('hard-codes no colour outside the token file', () => {
    const offenders = scanned
      .filter(({ file }) => file !== TOKENS_FILE && !isTest(file))
      .flatMap(({ file, body }) =>
        [...body.matchAll(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g)].map(
          (m) => `${file}: ${m[0]}`,
        ),
      );

    expect(offenders, 'use a token from tokens.css instead of a colour literal').toEqual(
      [],
    );
  });

  it('uses CSS logical properties, never physical ones', () => {
    // RTL is not a theme (packages/ui/CLAUDE.md): a physical property is
    // correct in English and wrong in Hebrew, which is the default language.
    const physical: Array<[RegExp, string]> = [
      [/\b(margin|padding|border)-(left|right)\b/g, 'use -inline-start / -inline-end'],
      [/(?<![\w-])(?:inset-)?(?:left|right)\s*:/g, 'use inset-inline-start / -end'],
      [/\btext-align\s*:\s*(left|right)\b/g, 'use text-align: start / end'],
      [/(?<![\w-])(?:ml|mr|pl|pr)-/g, 'use the ms-/me-/ps-/pe- utilities'],
      [/(?<![\w-])(?:border|rounded)-(?:l|r)(?![\w-])/g, 'use the -s / -e utilities'],
      [/(?<![\w-])text-(?:left|right)(?![\w-])/g, 'use text-start / text-end'],
    ];

    const offenders = scanned
      .filter(({ file }) => !isTest(file))
      .flatMap(({ file, body }) =>
        physical.flatMap(([pattern, fix]) =>
          [...body.matchAll(pattern)].map((m) => `${file}: ${m[0].trim()} — ${fix}`),
        ),
      );

    expect(offenders).toEqual([]);
  });
});
