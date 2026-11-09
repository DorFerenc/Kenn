# Things: recommended lists and build-your-own

Roadmap steps **8a** and **8b**. Supersedes the CSV-first shape of step 8: CSV
import is now a convenience for people who already keep a spreadsheet, not the
way a family gets a list. See [`things-csv-import.md`](things-csv-import.md).

Decisions behind this: [ADR-0005](../adr/0005-recommendation-catalogue-in-kb-with-safety-veto.md)
(where the catalogue lives, and the safety veto) and
[ADR-0006](../adr/0006-source-policy-for-live-recommendation-updates.md)
(which sources update live, and which do not).

## Goal

A parent opens Things and sees a list that already fits them — their home, their
budget, their season, whether they have a car, whether grandma has a cot — built
from curated lists rather than from a blank page. They tick what they want. Items
that Israeli or international safety guidance advises against are shown as "do
not buy", with the reason and the source, and no amount of popularity changes
that.

## Not in scope

Price tracking, stock checks, affiliate links, or anything that scrapes a
retailer. Buying from inside Kenn. A recommendation feed driven by what other
Kenn families bought.

## What the real lists taught us

Four independent real lists were used as the seed corpus: 61 items, 144 items,
123 items with an explicit priority column, and 165 items of one mother's curated
picks with models and shops. They agree on the frame and disagree on the content,
and that disagreement is the product.

**1. One "how necessary" field is not enough.** The same item appears as
mandatory in one list, "unnecessary in my opinion" in another, and medium
priority in a third. Necessity, _when_ you need it, and _how you get it_ are
three independent axes, and collapsing them loses the answer.

**2. Some items in real lists are ones safety authorities tell you not to use.**
This is the finding that shapes the whole feature:

| Item                             | How the real lists mark it                                                       | What guidance says                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| נחשוש / crib bumper              | **חובה** (mandatory) in one list; "מיותר" in another; medium priority in a third | The MoH's room-preparation page says the cot holds a fitted sheet and a blanket only — no pillows, toys, dolls, `נחשוש`, `מגן ראש` or `מגן מיטה`, because each raises the suffocation risk |
| מגן ראש / head guard             | medium priority                                                                  | same page, named explicitly                                                                                                                                                                |
| Side-sleeping positioning pillow | listed as "at grandma's"                                                         | AAP has advised against wedges and positioners since 2011; the FDA and CPSC have sought a ban                                                                                              |
| Inclined sleeper                 | not in these lists, but sold widely                                              | banned from manufacture and sale in the US by the Safe Sleep for Babies Act, 2022                                                                                                          |

A catalogue that merged these lists by popularity would recommend a crib bumper
as mandatory. **Popularity is a signal; safety is a veto.**

**3. Some items should not be bought because they arrive anyway.** The lists are
full of "comes in the birth package", "we got it as a gift", "at mum's", "take
from mum". A recommendation that ignores this costs real money.

Note: Israel's `מענק לידה` from Bituach Leumi is **money**, not a box of goods —
₪2,103 for a first child from 01.01.2026. The "birth package" the lists refer to
is a commercial or health-fund starter kit, whose contents vary and are not an
official entitlement. The catalogue must not state otherwise.

**4. The lists already encode profile conditions in prose.** "Does she need a
sleeping bag? Depends on the season." "Not useful with one child." "Only from
sitting age." These are `applies_if` conditions written as notes, which is where
the existing schedule-engine mechanism applies directly.

## Shape

Two layers, as everywhere else in Kenn.

### The catalogue — KB, in git, human-approved

`packages/kb/content/things/*.yaml`. A catalogue item is a KB item with the
ordinary fields (`id`, `version`, `locales` with `he` and `en`, `sources`,
`review_by`, `applies_if`) plus:

```yaml
id: things.crib-bumper
kind: thing
category: sleep
necessity: unsafe # essential | recommended | optional | discouraged | unsafe
necessity_reason:
  he: 'משרד הבריאות: במיטה סדין מהודק ושמיכה בלבד — ללא כריות, בובות, נחשוש או מגן ראש.'
  en: 'Ministry of Health: the cot holds a fitted sheet and a blanket only — no pillows, dolls, bumper or head guard.'
safety_authority: moh # REQUIRED when necessity is unsafe or discouraged
timing: not_applicable # before_birth | hospital_bag | first_weeks | by_month | when_needed
how_acquired: not_applicable # buy | often_gifted | borrowable | starter_kit | rent
price_ils: { typical_min: null, typical_max: null }
applies_if: {}
lists: # provenance, so the UI can show disagreement honestly
  - { list: il.seed-list-a, tier: mandatory }
  - { list: il.seed-list-b, tier: unnecessary }
sources:
  - https://me.health.gov.il/parenting/raising-children/after-childbirth/initial-care-for-newborn-after-birth/preparing-the-babys-room/
review_by: 2027-03-01
```

`lists` is what makes the UI honest: "4 of 5 curated lists include this; 1 calls
it unnecessary" beats a single invented verdict. Each seed list is a named,
versioned source, not an anonymous average.

### The family's list — Postgres, RLS

`inventory_item` gains `kb_item_id`, `kb_version` and `picked_from`
(`catalogue` | `csv` | `manual`), exactly as `task_instance` points at the KB
item and version it came from. A catalogue change therefore never silently
rewrites what a family decided.

## Decision hints

The profile fields that filter the catalogue. Each becomes an `applies_if`
condition, so one catalogue serves every family — the same mechanism the
schedule engine already uses for `fetuses` and `birth_type`.

| Hint                                                | Changes what is recommended                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `has_baby_room`                                     | a changing table, or a changing mat on an existing dresser              |
| `home_size`, `floor`, `has_elevator`                | stroller weight and fold; whether a second cot is worth it              |
| `budget_ils`                                        | a running total against the budget, and an "essentials only" view       |
| `season_at_birth` (derived from the EDD, not asked) | textiles, sleeping-bag TOG, heating                                     |
| `has_car`                                           | car seat, ARB bar, mirror — or a taxi plan and a lightweight carrier    |
| `feeding_intent`                                    | the pump, bags and nipple-shield set, or the bottles and steriliser set |
| `help_available`                                    | marks `borrowable` items as "ask first" rather than "buy"               |
| `firstborn`                                         | a later child skips most of the catalogue                               |
| `customs`                                           | brit and pidyon haben items                                             |

Nothing here is asked twice: `season_at_birth` and `firstborn` already exist or
derive from the anchors.

## The two steps

### Step 8a — the mechanism

- `kind: thing` added to the KB schema in `packages/kb/schema.ts`, with the
  fields above and a zod refinement: **`necessity: unsafe | discouraged` without
  a `safety_authority` and a source fails validation.**
- The profile fields, as a migration with RLS and its pgTAP test.
- Catalogue filtering in `packages/engine` — pure, reusing the `applies_if`
  evaluator the schedule engine already has.
- The picker UI: browse by category, filtered by profile, each item showing
  necessity, timing, typical price, list provenance and any safety verdict. Tick
  to add.
- Budget view: running total against `budget_ils`, split by category, essentials
  separated from optional.
- **Acceptance:** a profile with no car does not show a car seat; an `unsafe`
  item cannot be added without an explicit acknowledgement and never appears in
  "add all essentials"; a ticked item appears in the family's list pinned to the
  catalogue version it came from.

### Step 8b — the content and the import

- Seed the catalogue from the four lists via `/add-kb-item`, both locales, each
  item carrying its `lists` provenance.
- The safety overrides first, before anything else: bumper, head guard,
  positioning pillow, inclined sleeper, and anything a recall names.
- The CSV importer, per [`things-csv-import.md`](things-csv-import.md), which now
  also tries to match an imported row to a catalogue item so the family inherits
  the guidance rather than a bare row of text.
- The gift registry: the "need" items as a scoped share, with claims hidden from
  other viewers.
- **Acceptance:** `pnpm kb:validate` green on the whole catalogue; every
  `unsafe`/`discouraged` item cites an authority; a Hebrew-only reader sees no
  English; the destroyed-export check refuses the broken file.

## Live updates

Per ADR-0006, three classes of source. The watcher (step 13) handles the first
two; the third is deliberately not automated.

- **Class A, authoritative** — MoH safe sleep and room preparation, Beterem,
  Israeli recall notices, US CPSC, EU Safety Gate, Bituach Leumi amounts. A
  change here can set `necessity: unsafe` or flag a bought item. Watched weekly.
- **Class B, editorial** — Hebrew parenting portals and health-fund guides. A
  diff opens a PR proposing a catalogue change. Watched weekly.
- **Class C, retailers and forums** — read by a human curator, **never scraped.**
  Reasons in ADR-0006.

Every class ends the same way: a pull request a parent merges. Nothing reaches
the catalogue automatically, which is the existing rule for guidance and applies
here unchanged.

## Risks

| Risk                                                | Cost                                               | What catches it early                                                                                                                                                            |
| --------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The catalogue recommends something unsafe           | A baby is harmed. The only risk here that matters. | The schema refuses `unsafe`/`discouraged` without an authority; the safety overrides are seeded before anything else; clinical review before anyone outside the family uses Kenn |
| Curating 300+ items is slower than one session      | Step 8b slips                                      | Seed the safety overrides and the essentials first; optional items can land after Gate A                                                                                         |
| Profile hints multiply into untestable combinations | Nobody trusts the filter                           | Hints are independent booleans and enums over one `applies_if` evaluator, with table-driven tests; no hint reads another                                                         |
| A seed list's prose carries a claim with no source  | Invented guidance                                  | A seed list is a `lists` provenance entry, never a `sources` entry. Only an authority is a source.                                                                               |
