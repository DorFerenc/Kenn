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
