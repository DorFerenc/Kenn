# ADR-0005 — The recommendation catalogue lives in the KB, and safety vetoes popularity

- **Date:** 2026-11-09
- **Status:** accepted
- **Supersedes / superseded by:** none

## Context

Things was specified as a shopping list a family fills in, with CSV import as the
way to get started. That was reversed: the list should arrive already populated
from curated recommendations, with the family ticking what they want, and CSV
import demoted to a convenience.

Four real lists were used as the seed corpus — 61, 144, 123 and 165 items, from
three different households. They agree on the categories and disagree on the
content. Two facts out of that corpus decide this ADR.

**First, the lists contain items that safety authorities advise against.**

- `נחשוש` (a cot bumper) is marked **חובה**, mandatory, in one list; "מיותר
  בעיניי", unnecessary, in another; and medium priority in a third.
- `מגן ראש` (a head guard) is marked medium priority.
- A side-sleeping positioning pillow is listed as available at a grandparent's.

The Ministry of Health's page on preparing the baby's room directs that the cot
hold a fitted sheet and a blanket only — explicitly no pillows, toys, dolls,
`נחשוש`, `מגן ראש` or `מגן מיטה`, each of which raises the suffocation risk. The
AAP has advised against wedges and positioners since 2011, the FDA and CPSC have
sought a ban, and the US Safe Sleep for Babies Act of 2022 outlawed the
manufacture and sale of cot bumpers and inclined sleepers.

So a catalogue built by merging real lists on popularity would recommend a cot
bumper as mandatory. That is not a theoretical failure mode; it is what the data
in hand produces.

**Second, the lists disagree usefully.** The disagreement is information a parent
wants ("4 of 5 lists include this, 1 calls it unnecessary"), and flattening it
into one invented verdict throws that away.

## Decision

**1. The catalogue is a KB content type**, `kind: thing`, under
`packages/kb/content/things/`. It is guidance: versioned in git, both locales
mandatory, sources required, `review_by` required, changed only by a merged pull
request a human approved. The same rules that govern a vaccine window govern a
recommendation to buy something.

**2. Necessity is three independent axes**, because one field loses the answer:
`necessity` (essential / recommended / optional / **discouraged** / **unsafe**),
`timing` (before birth / hospital bag / first weeks / by month / when needed),
and `how_acquired` (buy / often gifted / borrowable / starter kit / rent).

**3. Safety is a veto, not a vote.** `necessity: unsafe` or `discouraged`
requires a `safety_authority` and at least one source URL, enforced by a zod
refinement in `packages/kb/schema.ts` so CI fails without it. An item so marked
is shown as "do not buy" with its reason and source, is excluded from "add all
essentials", and can only be added to a family's list with an explicit
acknowledgement. **No `lists` provenance, popularity count or community signal
can raise it.**

**4. Community lists are provenance, never sources.** A seed list appears in a
`lists` entry with the tier it assigned. Only an authority appears in `sources`.
The distinction is load-bearing: it is what stops a spreadsheet from becoming a
citation.

**5. The family's picks stay in Postgres**, with `inventory_item` carrying
`kb_item_id` and `kb_version` exactly as `task_instance` does, so a catalogue
change never silently rewrites a decision a family already made.

## Consequences

- Adding a recommendation is now as much work as adding a vaccine item: both
  locales, a source, a review date. That is the intended cost. The alternative is
  a shopping list that can kill a baby.
- The catalogue inherits the clinical-review gate before anyone outside the
  family uses Kenn, and `review_by` issues when a date passes.
- Curating 300+ items will not fit one session, which is why step 8 splits into
  8a (mechanism) and 8b (content), and why the safety overrides are seeded first.
- Kenn will sometimes contradict what a parent's friends recommend, and must do
  so with the source one tap away. That is the feature, not a bug in it.
- `packages/kb` grows a second content shape. The schema must keep `kind` as a
  discriminated union so a thing cannot borrow a schedule item's fields.

## Alternatives considered

- **Catalogue as household data, seeded per family.** Rejected: it is shared
  guidance, so it would escape review, versioning and the watcher, and every
  family would get a private copy of the same mistakes.
- **One `necessity` field, community-ranked.** Rejected on the evidence above —
  it recommends a cot bumper as mandatory.
- **Safety as a warning banner, leaving the item recommendable.** Rejected: a
  warning next to a tick box that still adds the item is the pattern that gets
  ignored at 3 a.m. Exclusion plus an explicit acknowledgement is the weakest
  form that actually holds.
- **Omit unsafe items entirely.** Rejected, and this is the subtler call: the
  parent has already seen `נחשוש` on a friend's list and will search for it.
  Silence reads as "Kenn does not know about it". An explicit "do not buy, and
  here is the Ministry of Health page" is more useful than absence.
