# packages/ui — rules for Claude

Design tokens, shadcn/ui components and RTL helpers. Built at roadmap step 2.

## Tokens before components

Settle the design system once, before the second screen exists: one accent colour,
warm neutrals, 8-pt spacing, one illustration style for the weekly cards. Fonts
Heebo or Rubik, both with full Hebrew coverage. A component that hard-codes a
colour or a spacing value is a bug.

## RTL is not a theme

- **CSS logical properties only.** `margin-inline-start`, `padding-inline-end`,
  `inset-inline-start` — never `margin-left` or `right`.
- Direction comes from the Radix direction provider, driven by the user's locale.
- Directional icons (back arrows, progress) flip. Numbers, phone numbers, timers
  and the emergency card's phone numbers stay LTR.
- Test every component in both directions. A component that has only been seen in
  LTR is not done.

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
