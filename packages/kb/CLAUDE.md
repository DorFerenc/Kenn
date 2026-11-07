# packages/kb — rules for Claude

Guidance as YAML in git. Humans change it; AI drafts it as a PR. Built at roadmap
step 3.

## The one rule that matters

**Never write a timing, a dose, an amount or an eligibility rule from memory.**
Every field traces to a source page or to the research blueprint. If you cannot
cite it, the item is `status: draft` and does not publish. This is the rule that
keeps Kenn from hurting someone.

There are no dose calculators in Kenn, in this package or anywhere else. A dose
comes from the label or the pharmacist.

## Item shape

Required on a published item: `id`, `version`, `country`, `phase`, `category`,
`locales.he`, `locales.en`, `window` (anchor plus day offsets), `sources` (at least
one URL), `valid_from`, `review_by`, `priority`, `evidence`, `coverage`.
`applies_if` defaults to `{}`, which means "everyone".

- `locales` must hold **both** `he` and `en`. CI fails on a published item missing
  one. AI may draft a translation; a human reviews the PR.
- `window` is `{ anchor, start_days, end_days }` plus `red_flag_days`. Offsets,
  never dates.
- `applies_if` conditions: dating method, number of fetuses, birth type, health
  fund and tier, customs, firstborn or later child.
- `review_by` is mandatory. A date that passes opens an issue, so an item with no
  page change still gets rechecked.
- Bump `version` on any change to meaning. Completed task instances stay pinned to
  the version they were done under, so history reads as it happened.

## Validation

`pnpm kb:validate` parses every file and checks the schema in `schema.ts`. It runs
in CI on every PR. Add a case to it rather than relying on review to catch a
malformed item.

## Writing one

See `docs/kb-authoring.md`, and use the `add-kb-item` skill so nothing in the
checklist is skipped.
