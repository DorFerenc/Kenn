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
test; a policy with `using (true)` or missing `with check`; a `security definer`
function without `search_path`; a secret in `NEXT_PUBLIC_*`; real-looking data in
`seed.sql`.

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
an engine change never run under a non-UTC timezone.

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
