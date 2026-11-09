# 2026-11-09 · step 0 follow-up

**Goal:** close the two items step 0 left open — the default branch, and the
shopping-list CSV.

**Outcome:** both closed. `main` is the default branch. The CSV re-export is
good, so step 8 is unblocked, and its import contract is recorded in
`docs/plans/things-csv-import.md`. Documentation only; no code changed.
`pnpm check` green.

## What was learned

**1. Decoding successfully is not evidence a file is intact.** The broken export
decoded cleanly as `utf-8`, `utf-8-sig`, `cp1255` **and** `iso-8859-8` —
precisely because it was pure ASCII. Excel had _replaced_ every Hebrew character
with a literal `?` byte rather than mis-encoding it, so there was nothing left to
decode. The working file, by contrast, decodes only as UTF-8 and fails the two
Hebrew codepages outright. A validator that asks "did it decode?" passes the
corrupt file and fails the good one.

This is the second time encoding has cost this project time, so per the promotion
rules it earns a check rather than a sentence — and the check belongs in the
importer, not in `CLAUDE.md`. Written into `things-csv-import.md` as a required
validation: refuse a file whose text columns are mostly `?`, count per column
rather than per file (`?` is legitimate in a URL and in this file's own `חובה?`
and `נקנה?` headers), and name the fix in the error.

**2. The `format-changed.sh` hook fired for real**, on the `Write` of
`things-csv-import.md`, and reformatted it after the edit. Step 0 only ever
tested it with a synthetic payload; this was the first genuine run.

**3. A file attached to a session is not durable.** The CSV exists in the
session, not in the repository, and household data does not belong in git —
`seed.sql` is fake-household-only for exactly that reason, since it loads into
every preview environment. Recording the _structure_ while the file was in hand
cost ten minutes and keeps step 8 buildable weeks from now without the data.
Worth doing for anything attached that a later step depends on.

**4. Reading the real data changed the design.** Two fields the plan's item model
does not have turned out to be in use: a sourcing note (4 rows put "look on
AliExpress" in the _link_ column), and a required flag independent of bought/not
bought. And one parameter that looks like tracking, `variant`, must be kept —
stripping it changes which product the link points at. None of that was
predictable from the plan; it came from looking at 61 real rows.

## Not done

Nothing outstanding from this follow-up. The step 0 learning file was left
unedited: it is a dated record, and the CSV was genuinely unusable when it was
written.

## Rule candidates

| Candidate                                                                    | Automatable? | Status                                                                                  |
| ---------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------- |
| "Decoding is not validation — check the content, not the codec"              | yes          | **promoted** to a required check in `things-csv-import.md`, to be implemented at step 8 |
| "Capture the structure of a session-attached file before the container goes" | no           | first occurrence — stays here                                                           |

## Next

**Step 1**, unchanged, still blocked on the current week and ultrasound-corrected
EDD and on the Supabase, Vercel and Anthropic accounts. PR #1 is open, green and
awaiting review.

---

# 2026-11-09 (later) · Things re-scoped, repo gated

**Goal:** make Things recommendation-first rather than CSV-first, research what
is actually necessary from real sources, add decision hints, keep the
recommendations live, and gate `main` behind a PR and CI.

**Outcome:** done as design and governance. Two ADRs, a feature plan, step 8
split into 8a/8b, a new hard rule, a branch-protection script, a PR template and
Dependabot. No application code. `pnpm check` green.

## What was learned

**1. Reading the real data overturned the feature, not just its details.** Four
real family lists — 61, 144, 123 and 165 items — were the seed corpus. Between
them they mark a cot bumper (`נחשוש`) as **mandatory**, a head guard as medium
priority, and a side-sleeping positioning pillow as something to take from a
grandparent. The MoH's room-preparation page says the cot holds a fitted sheet
and a blanket only, naming `נחשוש` and `מגן ראש` explicitly; the AAP has advised
against positioners since 2011; the US banned bumpers and inclined sleepers in 2022.

So the obvious design — merge real lists, rank by how many include an item — has
a concrete, reproducible failure: **it recommends a cot bumper as mandatory.**
That is now hard rule 11 and ADR-0005: safety is a veto, not a vote, enforced by
a zod refinement rather than by review.

The general lesson: when a feature aggregates what people actually do, the
aggregate can be worse than any single input. Look for the case where popularity
and safety disagree _before_ designing the ranking.

**2. One field was hiding three.** "How necessary" could not hold the data:
necessity, timing and how-you-get-it are independent, and the lists prove it with
"comes in the birth package", "we got it as a gift", "take from mum", "not until
sitting age". Collapsing them loses the answer the parent wanted.

**3. A requirement had to be narrowed, with reasons.** "Make the recommendations
live and get updates from the relevant sources" named baby shops and mother
forums. Scraping those was declined in ADR-0006 on three grounds — retailer terms
and `robots.txt`, a weekly diff against a shop being almost all price churn that
would bury the authoritative changes, and forum content being anecdotal and
demonstrably recommending unsafe products. A forum list still enters Kenn, as a
named `lists` provenance entry added by a human. Narrowing an ask is fine when
the reasons are concrete and the alternative path is spelled out.

**4. Configuration belongs in git, not in a settings page.** Branch protection
went in as `scripts/setup-branch-protection.sh` rather than as instructions,
because a ruleset nobody can review drifts silently. Rulesets, not classic
protection, since they work on private repositories on every plan. Zero required
approvals is the deliberate temporary setting, with `--approvals 1` as the single
change when code review starts.

## Not done

- **The script has not been run.** This session has content read/write on the
  repository but not administration, so a repo admin runs it once.
- Three settings a script cannot reach: secret scanning with push protection,
  Dependabot alerts, auto-delete head branches.
- The Class B editorial source list is not yet named. Needed before step 13.

## Rule candidates

| Candidate                                                                                                                   | Automatable? | Status                                                                         |
| --------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| "Safety vetoes popularity; an authority verdict is not outvoted"                                                            | yes          | **promoted** — hard rule 11, ADR-0005, enforced by a zod refinement at step 8a |
| "When a feature aggregates real behaviour, find the case where popularity and safety disagree before designing the ranking" | no           | first occurrence — stays here                                                  |
| "Repo configuration goes in a script in git, not in a settings page"                                                        | partly       | first occurrence — stays here                                                  |

## Next

**Step 1**, unchanged. Things 8a/8b sit in Release 1 after it.
