# ADR-0006 — Source policy for live recommendation updates

- **Date:** 2026-11-09
- **Status:** accepted
- **Supersedes / superseded by:** none

## Context

The recommendation catalogue is required to be live: kept current from the
relevant sources rather than frozen at the moment someone typed it in. The
sources that _could_ feed it are not alike, and the request named baby shops and
parent forums among them.

The sources actually available:

- **Authorities.** MoH safe sleep and room-preparation pages, Beterem, Israeli
  recall notices, US CPSC, EU Safety Gate, Bituach Leumi amounts.
- **Editorial guides.** Hebrew parenting portals and health-fund guides that
  publish "what to buy before the birth" checklists. Reasonably stable, usually
  attributed, and broadly consistent with each other on the frame.
- **Retailers.** Shilav, KSP, TEMU, AliExpress, and the specific shops named
  across the seed lists.
- **Parent forums and groups.** Facebook and WhatsApp groups, forum threads, the
  shared spreadsheets families pass around — which is exactly where the seed
  corpus came from.

Kenn already has a rule for live guidance: the watcher proposes, a human merges,
and nothing scraped is auto-applied. The question is which of the four classes
that machinery should point at.

## Decision

Three classes, two of them automated.

**Class A — authoritative. Watched weekly, can set a safety verdict.**
MoH, Beterem, recall notices, CPSC, EU Safety Gate, Bituach Leumi. A diff opens
a pull request labelled `guidance-change`. A change here may set
`necessity: unsafe`, flag an item a family already owns via recall matching, or
move an amount. These are the only sources that may appear in a catalogue item's
`sources`.

**Class B — editorial. Watched weekly, proposes catalogue changes only.**
Parenting portals and health-fund guides. A diff opens a pull request suggesting
an addition, a timing change or a necessity change. It can never set a safety
verdict on its own, because a commercial guide is not an authority.

**Class C — retailers and parent forums. Read by a human, never scraped.**
A curator may read them and open a pull request like any other contributor.
Three reasons the watcher does not:

1. **Terms and robots.** Retailer terms of service and `robots.txt` generally
   forbid automated collection of catalogue and price data. Kenn's own rule is to
   fetch politely, once a week, identified — which is not a licence to take what
   a site has said not to take.
2. **Noise.** Prices and stock change hourly. A weekly diff against a retailer
   page is almost entirely price and availability churn, and it would bury the
   Class A changes that actually matter in a stream nobody reads.
3. **Anecdote, and worse.** Forum content is unattributed and sometimes
   recommends products that safety authorities advise against — demonstrably so:
   the seed corpus for this very feature marks a cot bumper as mandatory. An
   automated pipeline that treats forum consensus as signal would import that.

A forum list may still enter Kenn, as a **named `lists` provenance entry** with
the tier it assigned, added by a human. That is how the four seed lists enter.
What it may not do is enter unattended, and it may never be a `source`.

## Consequences

- "Live" means Class A and B are watched weekly and a parent merges the result,
  usually within days. It does not mean the catalogue mirrors a shop.
- Price data is therefore not live. A typical price range on a catalogue item is
  curated and carries a `review_by` like anything else. Tracking the price of a
  specific item a family has already added is a separate, later feature with its
  own consent and its own source policy.
- Adding a forum or shop list is manual work per list. Acceptable: there are a
  handful of good ones, and each one read by a human is worth more than a
  hundred scraped.
- If a retailer later publishes a documented API or feed that permits this, that
  is a new ADR superseding this one, not an exception to it.

## Alternatives considered

- **Scrape everything weekly and let the PR review catch problems.** Rejected on
  all three grounds above, and on a fourth: a review queue that is mostly noise
  stops being a review.
- **Scrape retailers for prices only, not recommendations.** Tempting, and still
  rejected for now — it is the part most clearly covered by retailer terms, and
  the value is lower than it looks, since the family mostly needs a budget
  estimate rather than today's price.
- **Take no live input at all and curate by hand.** Rejected: the safety sources
  are exactly the ones that must not go stale, and watching them is already
  built for the schedule KB.
