# packages/ui — rules for Claude

Design tokens, RTL helpers and the locale vocabulary. shadcn/ui components
arrive at roadmap step 5, with the first screen that needs one.

## Tokens before components

Settled at roadmap step 2, before the second screen existed: one accent colour,
warm neutrals, 8-pt spacing, Heebo. **`src/tokens.css` is the single source of
truth** — colour, spacing, type, radius — and a component that hard-codes a
colour or a spacing value is a bug.

`src/tokens.test.ts` is what makes that true rather than aspirational. It fails
on a hard-coded hex or a physical CSS property anywhere in `apps/web` or
`packages/ui`, on a colour whose contrast falls below WCAG AA in either theme,
and on a dark theme missing an override. Adding a colour token means adding its
row to `CONTRAST_PAIRS`, or nobody has checked it.

Three things to know before adding a token:

- **Colours are hex, not oklch.** A hex literal lets `contrast.ts` compute a
  WCAG ratio in thirty auditable lines, so the contrast gate is a real test.
- **Semantic names alias base colours; they never add one.** A task window's
  three states are the neutral/success/danger triple, and an evidence badge is
  one of the text colours.
- **The 8-pt grid is arithmetic.** Tailwind multiplies a single `--spacing` of
  `0.5rem`, so every spacing utility is an 8-pt multiple and `-0.5` is the only
  sub-8 step the scale can express.

## RTL is not a theme

- **CSS logical properties only.** `margin-inline-start`, `padding-inline-end`,
  `inset-inline-start` — never `margin-left` or `right`.
- Direction comes from `dir` on `<html>`, set by the locale layout from
  `dirForLocale()`. There is no RTL stylesheet and there must never be one: a
  mirrored copy of the styles is a second thing to keep correct.
- Directional icons (back arrows, progress) flip. Numbers, phone numbers, timers
  and the emergency card's phone numbers stay LTR.
- Test every component in both directions. A component that has only been seen in
  LTR is not done.
- The `numeric` utility in `tokens.css` is how a run of digits stays LTR inside
  Hebrew text: it sets `direction`, `unicode-bidi: isolate` and tabular figures
  in one place.

## Accessibility is a constraint, not a polish pass

- 48 px minimum tap target. The app is used with one thumb at 3 a.m.
- Radix primitives for anything with focus, keyboard or ARIA behaviour. Do not
  hand-roll a dialog, a menu or a tooltip.
- Contrast holds in dark mode, which is the default at night.
- No confirmation dialogs. Act, then offer undo.

## Shape

Every item has exactly one primary action, and shows its window as a short bar:
grey before, green inside, red after. Every recommendation carries an evidence
badge (strong / moderate / weak / custom) with its source one tap away.
