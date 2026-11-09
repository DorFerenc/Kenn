# packages/engine — rules for Claude

The schedule engine: `(kb_items, anchors, today) → task_instances`. Built at
roadmap step 4.

## Purity

- **No database, no clock, no framework.** No Next.js, React, Supabase or app
  imports — enforced by `no-restricted-imports` in the root `eslint.config.mjs`.
- `today` is a parameter, never `new Date()` inside the engine. Tests pass known
  dates; the same inputs must always give the same outputs.
- Plain types and functions. The class diagram in `docs/architecture.md` is a
  model, not an instruction to write classes with hidden state.

## Dates

- **ISO date strings (`YYYY-MM-DD`), never `Date` objects with a time.** A `Date`
  carries a timezone and an hour, and both produce off-by-one bugs west of UTC.
- Windows are stored as **day offsets from an anchor**, not as dates. An anchor
  changing re-materializes the windows; it does not rewrite stored dates.
- Anchors are LMP, EDD, birth and corrected birth.
- Hebrew calendar work goes through `@hebcal/core`: brit on day 8, pidyon haben on
  day 31, Shabbat shifts.
- Always run the suite under a non-UTC timezone before calling it green:
  `TZ=America/Los_Angeles pnpm test`.

## Special cases are rules, not branches

Adding a country, a custom or a health-fund quirk means adding a `Rule`
(`applies(ctx)` and `adjust(window, ctx)`), not editing `materialize()`. The known
ones: `RsvBirthMonthRule` (April–August births get Beyfortus at Tipat Halav),
`BritMilahRule`, `PidyonHabenRule` (firstborn son, vaginal birth only),
`ShabbatShiftRule`.

## Tests

Vitest, with dates from the research blueprint: NT at 11+0 to 13+6, glucose at
24–28 weeks, Tdap at 27–36, GBS from the start of week 36 to the end of week 37.
Test the boundaries, not the middle of a window.
