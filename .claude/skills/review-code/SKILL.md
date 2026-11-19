---
description: Review the current change for correctness, security, i18n, RTL, accessibility and tests before a PR. Runs the reviewer agent, plus security-reviewer on sensitive paths.
when_to_use: The user asks for a review, asks whether a change is ready, or is about to open a PR. Also run automatically as phase 5 of implement-step.
allowed-tools: Read, Glob, Grep, Bash, Agent
---

# Review the change

## 1. Establish what changed

```
git diff --stat
git diff
```

Read the `CLAUDE.md` of every package the diff touches. A finding that ignores a
package's own rules is noise.

## 2. Run the agents

- `reviewer` — always.
- `security-reviewer` — if the diff touches `packages/db/`,
  `apps/web/app/api/`, `apps/web/lib/services/` or `apps/web/lib/coach/`.

They review with a context that never watched the code being written, which is
the entire point. Do not pre-digest the diff for them.

## 3. Verify, do not just relay

For each finding, decide whether it is **confirmed** or **plausible**. Confirm by
running something: `pnpm check`, a targeted test, `pnpm db:test`, or
`TZ=America/Los_Angeles pnpm test` for anything in the engine. Report which is
which. A plausible finding stated as fact wastes more time than it saves.

## 4. The checklist

Ordered by what has actually hurt projects like this one.

**Security and data isolation** — a query outside `lib/services`; the service-role
key on a request path; a new household table without RLS or without its pgTAP
test; a policy with `using (true)` or missing `with check`; **a policy that is
`for all` when the app only reads, inserts and updates** — the Data API exposes
every table to a member's own JWT, so a policy silent about the operation is a
delete nobody wrote; **a cascade into an append-only table**, which removes rows
without an update or a delete and so passes every assertion about them; a
`security definer` function without `search_path`; a secret in `NEXT_PUBLIC_*`;
real-looking data in `seed.sql`.

**A claim and the layer that would have to hold it** — a comment, an ADR or a
commit message asserting a property ("append-only", "no request path deletes
this", "one household per person", "aria-current comes from the library") where
the thing that enforces it is one layer above the attack. Check the claim
against the boundary, not against the code that happens to respect it. A comment
asserting a property the code does not implement is a finding, not
documentation.

**AI boundaries** — fetched, shared or user-written text reaching the model as
instruction rather than data; an AI-reachable path that can delete, share, read a
document or send a message; an AI write missing from `audit_log`; an MCP tool
trusting a household id from the request body; a red-flag path that calls the
model instead of returning static text.

**Medical content** — a timing, dose, amount or age with no source URL; a
published item missing a locale; a missing or stale `review_by`; anything
resembling a dose calculator.

**Correctness** — `any` or a cast hiding a real type; a nullable value assumed
present; `new Date()` in the engine; a window stored as a date rather than an
offset; a special case branched into `materialize()` instead of added as a `Rule`;
a migration that drops or renames in one step.

**Next.js 16** — a request API used synchronously; `'use client'` higher than
needed; a server action without zod validation; a parallel route without
`default.tsx`; caching assumed rather than declared; a custom webpack config,
which fails the build.

**i18n and RTL** — a hard-coded string; a key in one locale; `margin-left`
instead of `margin-inline-start`; a gendered Hebrew string without an ICU
`select`; a number or phone number that will render RTL.

**Accessibility** — a tap target under 48 px; a hand-rolled dialog or menu; a
confirmation dialog where undo belongs; contrast failing in dark mode.

**Tests** — new behaviour untested; a test asserting the middle of a window
instead of its boundaries; a test that would still pass with the feature deleted;
**a test whose name claims a property its assertion does not exercise** — plant
the bug the name describes and watch it fail (step 6a: "anon cannot mint a feed"
passed on the function body's `if` while `anon` held the grant, and "same tasks
as the screens" never compared the two);
an engine change never run under a non-UTC timezone; **a gate whose violation was
only ever planted by hand** — the planting belongs in the test, or the gate dies
with the terminal session that verified it; **a scan that covers less than it
claims** — ask what it cannot see, not what it rejects (a glob that matches no
file, a pattern that misses the common spelling, a file kind skipped); **a gate
that enumerates what it protects** — derive the list from the filesystem or the
schema, or invert it into an allowlist, because a hand-written denylist goes
stale in the direction that hurts; **a fake or mock that ignores a filter the
real client applies**, which makes a missing `where` clause invisible to every
test; **a fixture that continues after its own precondition failed**, which turns
one clear failure into a confusing one three locators later.

**Hygiene** — dead code knip would catch; an unused dependency; a stray
`console.log`; a TODO with no issue.

## 5. Report

A severity-ordered table — Critical, Major, Minor — then the detail: file and
line, the failure scenario, the fix. Critical and Major get fixed. Minor gets
fixed or recorded.

If the change is clean, say so and name what you checked. Do not manufacture a
finding.

## 6. Feed the loop

Count findings by category. A category that has now appeared three times belongs
in this checklist — say so, and let `/retro` propose the edit.
