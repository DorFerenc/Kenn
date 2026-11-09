# ADR-0007 — Design tokens live in CSS, in hex, and contrast is a test

- **Date:** 2026-11-09
- **Status:** accepted
- **Supersedes / superseded by:** none

## Context

`packages/ui/CLAUDE.md` has said since step 0 that "a component that hard-codes
a colour or a spacing value is a bug", and that "contrast holds in dark mode,
which is the default at night". Step 2 had to decide what form the tokens take,
and that decision settles whether those two sentences are rules or wishes.

Three things bear on it.

**Tailwind 4 reads its theme from CSS.** A `@theme` block generates the utility
classes, so the values have to exist as CSS custom properties whatever else is
true. A TypeScript object would therefore be a _second_ home for the same
numbers, and the project has just spent a session removing facts that had two
homes and disagreed.

**The modern default is `oklch`.** Tailwind 4's own palette is oklch, and it
covers a wider gamut on displays that can show it. But a WCAG contrast ratio is
defined on sRGB relative luminance, so a contrast check against oklch values
needs an oklch → sRGB conversion — roughly a hundred lines of colour science,
with its own failure modes, standing between the tokens and the assertion.

**An accessibility rule that is not a test is not a rule.** This is an app used
one-handed at three in the morning in a dark room, by two people who will not
re-audit the palette. The step-1 and step-3 sessions both produced evidence for
the same general point: a rule the gate does not enforce is a rule that lasts
until the first hurried change.

## Decision

**1. `packages/ui/src/tokens.css` is the single source of truth** for colour,
spacing, type and radius, as a Tailwind 4 `@theme` block. No TypeScript mirror.
Code that needs a value reads `var(--token)`; nothing restates one.

**2. Colours are hex literals, not `oklch`.** A hex literal lets
`packages/ui/src/contrast.ts` compute the WCAG 2.2 ratio in about thirty lines
that a person can read and check against the spec. **The gate must be simpler
than the thing it guards, or it will not be trusted when it fails.**

**3. Contrast is asserted, in both themes.** `tokens.test.ts` holds a table of
every pair that must hold and the threshold it must hold at — 4.5:1 for text,
3:1 for a component that conveys state. Adding a colour token means adding its
row, or nobody has checked it.

**4. Semantic tokens alias base colours and never introduce one.** A task
window's three states are the neutral/success/danger triple; an evidence badge
is one of the text colours. The test resolves aliases, so an alias is covered by
the base colour's row.

**5. The 8-pt grid is arithmetic.** A single `--spacing: 0.5rem`, which Tailwind
multiplies, makes every spacing utility an 8-pt multiple by construction;
`-0.5` is the only sub-8 step the scale can express.

**6. The same test scans the repository** for a hard-coded hex or a physical CSS
property in `apps/web` and `packages/ui`. ESLint does not read CSS, and RTL
correctness depends on CSS as much as on TSX, so one mechanism covers both file
kinds rather than two that each cover half.

Revisit the colour space when a contrast implementation for a wider gamut is
something Kenn can depend on rather than write. Not before: the gamut gain is
invisible on the phones this runs on, and the test is the point.

## Consequences

- Adding a colour is now two edits: the token and its contrast row. That is the
  intended cost, and it is how a palette stays accessible after the tenth screen.
- Dark mode is one `prefers-color-scheme` block, so every literal colour must
  have a dark counterpart — the test fails without one. A manual light/dark
  toggle will need a `[data-theme]` selector, and that is the point at which the
  dark values would be written twice; the override belongs with the settings
  screen that needs it, not before.
- The repository scan can produce a false positive on a colour-like string in
  source. It strips comments first, and test files are exempt because a fixture
  legitimately holds a literal.
- Kenn's palette will look slightly flatter on a wide-gamut display than a
  modern oklch one. Accepted.

## Alternatives considered

- **A TypeScript token object, with CSS generated from it.** Rejected: Tailwind
  needs the CSS anyway, so this adds a generator and a build step to produce
  what could simply be written, and creates the second home for a fact that
  ADR-0001's sibling problem keeps producing.
- **`oklch` with a conversion in the test.** Rejected on the "gate simpler than
  the thing it guards" argument. A bug in a hand-written colour-space conversion
  silently passes an inaccessible palette, which is worse than no test, because
  it is believed.
- **Contrast checked by a linter or an external audit tool.** Rejected for now:
  it checks rendered pages, so it needs a running app and screens, neither of
  which exists at step 2 — and the tokens are exactly what should be checked
  before any screen is built on them. Worth adding at step 5 as well, against
  real pages; the two do not conflict.
- **Trusting the palette, as most projects do.** Rejected. The one evening this
  matters is the one where someone is reading a red-flag card at 3 a.m.
