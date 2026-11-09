# Things: the shopping-list CSV import contract

> **CSV import is a convenience, not the way a family gets a list.** The primary
> path is the recommended catalogue in
> [`recommended-lists.md`](recommended-lists.md): a curated list filtered to the
> family's profile, which the parent ticks. This document stays because the
> importer is still built at step 8b, and because the file in hand taught us the
> column shape and the failure modes. The importer should also try to match an
> imported row to a catalogue item, so a family arriving with a spreadsheet
> inherits the guidance rather than a bare row of text.

Written at step 0 (2026-11-09) from the working re-export, so step 8 can build
the importer against a known shape. **The file itself is household data and is
not in this repository** — it lives with the family and is attached to the
session that needs it. Only its structure is recorded here.

Roadmap step 8. Related: `docs/plan.md`, section "Things (inventory)".

## The file

UTF-8 **with BOM** (`EF BB BF`), 61 item rows, 9 columns, comma-separated, no
quoted fields needed, consistent row width. Read it as `utf-8-sig`, not `utf-8`:
plain UTF-8 leaves the BOM glued to the first header name, so the first column
silently fails to match.

| #   | Header      | Filled | Meaning                                                    |
| --- | ----------- | ------ | ---------------------------------------------------------- |
| 0   | `קטגוריה`   | 61/61  | category                                                   |
| 1   | `פריט`      | 61/61  | item name — free text, the natural merge key with category |
| 2   | `כמות`      | 2/61   | quantity                                                   |
| 3   | `דגם`       | 5/61   | model                                                      |
| 4   | `מחיר`      | 4/61   | price, bare integer shekels, no separator or symbol        |
| 5   | `לינק`      | 7/61   | **overloaded — see below**                                 |
| 6   | `חובה?`     | 61/61  | `חובה` \| `לא חובה`                                        |
| 7   | `מתי לקנות` | 61/61  | `לפני הלידה` \| `אחרי הלידה`                               |
| 8   | `נקנה?`     | 61/61  | `כן` \| `לא`                                               |

Categories, with counts: `ציוד נלווה` 14 · `ריהוט/חדר` 12 · `רפואי` 9 ·
`התניידות` 7 · `מקלחת` 7 · `ביגוד` 6 · `כביסה` 4 · `הנקה` 2.

4 items are priced, totalling ₪7,000; 57 are unpriced. 3 are already bought.
52 are mandatory, 9 optional. 57 are wanted before the birth, 4 after.

## Mapping to `inventory_item`

| CSV           | Field           | Rule                                                   |
| ------------- | --------------- | ------------------------------------------------------ |
| `קטגוריה`     | `category`      | as-is                                                  |
| `פריט`        | `name`          | as-is                                                  |
| `כמות`        | `qty`           | **default 1 when blank** — only 2 rows carry one       |
| `דגם`         | `model`         | as-is                                                  |
| `מחיר`        | `price_ils`     | integer; blank is unknown, not zero                    |
| `לינק` (URL)  | `url`           | tracking parameters stripped                           |
| `לינק` (text) | `sourcing_note` | see "The overloaded link column"                       |
| `נקנה?`       | `status`        | `כן` → `have`, `לא` → `need`                           |
| `חובה?`       | `required`      | `חובה` → true, `לא חובה` → false                       |
| `מתי לקנות`   | `needed_by`     | `לפני הלידה` → EDD anchor, `אחרי הלידה` → birth anchor |

### Two gaps this exposes in the item model

`docs/plan.md`'s item model does not cover two things the real list uses, and
both need deciding before the importer is written:

1. **A sourcing note** — "where to look", distinct from `source` (bought / gift /
   borrowed), which records where an item _came_ from. Four rows carry one.
2. **A required flag.** `status` has five values (need, ordered, have, borrowed,
   not needed) but none of them says whether an item is optional. `חובה?` is a
   separate axis from `נקנה?` and collapsing them loses information: "optional
   and not bought" and "mandatory and not bought" are both `need`, and only one
   of them should ever show up on Today.

## The overloaded link column

7 rows are filled: **3 are URLs, 4 are notes to self.**

```
לחפש בעלי אקספקס        ("look on AliExpress")      x3
לחפש למסירה או יד 2     ("look for a giveaway or second-hand")
```

The importer must not reject or drop a non-URL value in a URL column. Route
anything that does not parse as `http(s)` to `sourcing_note` and show it in the
preview as a mapped note, not as an error. A real spreadsheet column means
whatever its owner needed it to mean.

## Stripping tracking parameters

Observed across the 3 URLs, all on `agalease-baby.co.il`:

- **Strip:** `gclid`, `gbraid`, `_gl`, `stkn`, `tw_source`, `tw_adid`,
  `tw_campaign`, `tw_kwdid`, `gad_source`, `gad_campaignid`
- **Keep:** `variant`, `currency`, `country`

`docs/plan.md` names `gclid`, `gbraid` and `_gl`. The Twitter and Google Ads
parameters above are also present and also tracking.

**`variant` must not be stripped.** `variant=43217325916249` identifies which
product variant the link points at; removing it changes what was chosen. Strip
by an allowlist of known tracking keys, never by a "looks like an id" heuristic.

## Validation: reject a destroyed export

The first export of this file was unusable, and the importer should be able to
say so rather than import the damage. Excel's "CSV" on a Hebrew locale wrote
every Hebrew character as a literal `?` byte (`0x3F`) — not mis-encoded, but
replaced. No decoding recovers it: the first attempt here produced 2,148 `?`
characters and zero Hebrew, with only 8 of 62 lines keeping any Latin or
numeric content.

So, before mapping:

1. Decode as `utf-8-sig`, then `utf-8`, then `cp1255`, then `iso-8859-8` — the
   working file decodes only as UTF-8; the broken one decodes as all four,
   because it was pure ASCII. **Decoding successfully is not evidence the file
   is intact.**
2. **Refuse a file where a text column is more than ~30% `?` characters**, and
   say why: the Hebrew was lost at export, and the fix is Google Sheets →
   Download → CSV, not an Excel "Save as CSV".
3. Note that `?` is legitimate inside a URL and inside a header name — this
   file's own headers are `חובה?` and `נקנה?`. Count `?` per _text_ column, not
   per file.

This check is the difference between a user seeing "your file lost its Hebrew,
re-export it from Google Sheets" and a user seeing 61 rows of `?????`.

## Test fixtures step 8 should carry

- A good file: UTF-8 with BOM, mixed Hebrew and Latin, blank cells throughout.
- The destroyed file: ASCII with `?` for every Hebrew character — must be
  refused with the re-export instruction.
- Names with characters that trip naive parsing, all real in this list:
  a literal backslash (`רדיאטור \ מחמם בטיחותי לבית`) and apostrophes
  (`מדבקות קיר חיות ג'ונגל`, `בובות חיות ג'ונגל`).
- A row whose link column holds free text rather than a URL.
- A category containing a slash (`ריהוט/חדר`) — it is one category, not a path.
