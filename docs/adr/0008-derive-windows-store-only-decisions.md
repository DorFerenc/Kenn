# ADR-0008 — Derive task windows at read time; store only what a person decided

- **Date:** 2026-11-15
- **Status:** accepted
- **Supersedes / superseded by:** none

## Context

The planning document's data model listed a `task_instance` table holding "KB
item + version, computed window, status, assignee, `done_by`, `done_at`, note",
and said instances "are materialized when an anchor changes, so reminders are
plain SQL queries". Step 5a is the step that had to build it, and three facts
that arrived after that sentence was written argue against it.

**A window is not a date.** `packages/engine/CLAUDE.md` has said since step 0
that "windows are stored as day offsets from an anchor, not as dates", and step
4 built exactly that: `materialize(items, ctx, today)` adds `start_days` and
`end_days` to an anchor, then lets rules move the result. 20 published KB items,
one pure function, no clock.

**The anchor moves.** The dating precedence decided at step 1 — an
ultrasound-corrected EDD beats a remembered LMP, an IVF transfer beats both —
exists because the first scan can correct the EDD, which is also why `pregnancy`
keeps `lmp`, `edd` and `transfer_date` side by side rather than one of them. A
stored window is therefore not a fact recorded once; it is a derived value that
has to be rewritten every time the family edits their dating, for every item.

**A stored window that disagrees with the engine is invisible.** Nothing raises.
The checklist simply shows a test in the wrong week, which is the one failure
this app exists to prevent, and it would be discovered by a person comparing the
app with a clinic letter.

The second question in the same step: `audit_log` arrives now rather than at step
10, because `apps/web/CLAUDE.md` requires every service write that changes
household state to write one, and the first such write is this step's task tick.
`packages/db/CLAUDE.md` gives one RLS policy pattern for every household table —
a single `for all` policy using `is_member(household_id)`. Applied to an audit
log, that pattern lets a member rewrite or delete their own household's history,
which is the one thing an audit log must not permit.

## Decision

**1. There is no `task_instance` table.** `task_state` stores the one thing the
engine cannot derive: that a person decided something. Its primary key is
`(household_id, kb_item_id)`; its columns are `kb_version`, `state`
(`done | skipped | open`), `acted_by`, `acted_at` and `note`. No `due_start`, no
`due_end`, no `status`.

**2. Windows are materialised on every read.** `apps/web/lib/services/tasks.ts`
composes three sources and stores none of the result: guidance from `@kenn/kb`,
windows from `@kenn/engine` given the anchors in `pregnancy`, and decisions from
`task_state`. A decision overrides the clock — a done item reads `done`, not
`overdue` — and the status time alone would give travels with the task as
`timeStatus`, so undoing a tick puts the item back in the group its window
dictates without a second request.

**3. A reopen is an upsert, not a delete.** Putting an item back writes
`state = 'open'`, so the row keeps `acted_by` and `acted_at` and no request path
in the app can remove one. That is hard rule 5 ("there is no delete tool") made
structural rather than conventional.

**4. `kb_version` is the version the decision was made under.** A later guidance
change is then shown as "guidance updated" on a completed item instead of
rewriting what somebody did. An item nobody has decided has no row and therefore
nothing to supersede: it is simply re-derived from the current version.

**5. `audit_log` is append-only, and is the one household table that does not
use the single `for all` policy.** It has a select policy and an insert policy,
both `is_member(household_id)`, and deliberately **no** update or delete policy,
so both default-deny. A check constraint requires `actor_name` when
`actor_kind = 'mcp'`, so "revoke all AI access" at step 10 can always say which
client did what.

**6. The refusal is asserted, because it is silent.** An `UPDATE` with no
matching policy reports zero rows rather than raising, so
`packages/db/supabase/tests/audit_log.sql` asserts that a member cannot change
or remove their **own** household's history, and that both households' rows are
unchanged afterwards. It is the one place in this schema where the positive case
is a refusal.

**7. Default deny means per operation, not only per household — added after the
security review of this step.** Decisions 3 and 5 were both false of the
database when first written, and the reason generalises past them: the
publishable key is public and `[api] schemas = ["public"]` exposes every table,
so a signed-in member holds a general-purpose SQL client against their own
household, and `for all` says nothing about which operation. One request
(`DELETE /rest/v1/household?id=eq.<mine>`) deleted the household row and
cascaded away every `audit_log` row, because a cascade is not subject to the
referencing table's RLS; another deleted a `task_state` row that decision 3
calls structurally undeletable. So every table now carries policies for exactly
the operations the app performs, **no table has a delete policy**, column
privileges narrow `member` to the caller's own preferences and `invite` to
`revoked_at`, the audit insert policy pins `actor_user_id` to `auth.uid()`,
`task_state` pins `acted_by` the same way, and the audit foreign key refuses a
household delete rather than cascading.

**What is still only true of the application:** a write made straight to the
Data API with a member's own JWT changes `task_state` or `pregnancy` and leaves
no `audit_log` row, because the audit write lives in `apps/web`. Closing that
means one `security definer` function per write — the change and its audit row
in one transaction, with `authenticated` holding no direct insert or update
privilege — which also fixes the fact that the audit insert is a second
statement and can fail after the change has committed. It belongs before step 9
makes the MCP route a second actor, and it is step 9's first task rather than a
sentence here.

## Consequences

- A corrected EDD moves every window at once, with no write and no backfill.
  There is no code path that could leave one row stale, because there are no
  rows to leave stale.
- **Reminders are no longer a plain SQL query.** Step 6's Sunday digest and ICS
  feed have to run the engine per household through the service layer rather
  than selecting rows due this week. That is the price of this decision and it
  is paid in step 6; it buys the certainty that the reminder and the screen
  cannot disagree.
- `kb_item_id` is a foreign key into git, and Postgres cannot enforce it.
  `decideTask` rejects an id that is not a published KB item, and renaming a KB
  item id orphans any row that references it. A KB item id is therefore
  permanent once published — treat it as part of the schema.
- Realtime carries decisions, not windows. `task_state` is in the
  `supabase_realtime` publication, so a tick reaches the other parent's screen;
  an edited anchor does not emit an event and is picked up on the next read.
- Per-task fields the planning document put on `task_instance` — an assignee, a
  per-item reminder override — become columns on `task_state` if they are ever
  wanted. Nothing about this decision blocks them.
- Reading the checklist is three small queries — anchors, profile, decisions —
  plus pure computation, and storage is one row per decision rather than 20 rows
  per household from the first day. Both cheaper; neither was the reason.
- `audit_log` cannot be corrected. A wrong entry is history, and a row written
  by mistake stays. Pruning old entries will need a migration or a service-role
  job in CI, never a request path.
- `packages/db/CLAUDE.md`'s "every household table, without exception" now has
  exactly one exception, named here. A second table claiming the same exemption
  needs its own ADR, or the pattern stops meaning anything.
- The `for all` template that `packages/db/CLAUDE.md` gives is what propagated
  the over-broad policies to four tables in one step, so that file now shows the
  per-operation form instead. Step 8a's columns on `household_profile` inherit
  the narrower pattern.
- One household per person is enforced inside `accept_invite()` rather than by a
  unique index on `member(user_id)`, because step 15 gives a caregiver a role in
  more than one household and an index would have to be dropped against live
  data. A check in the one function that adds a membership is the same guarantee
  today and a one-line change then.

## Alternatives considered

- **Materialise `task_instance` rows and rewrite them when an anchor changes**
  (the planning document's design). Rejected: it creates a second home for every
  date, and the engine is the first. The rewrite has to be transactional across
  every item and every rule, and the failure mode of a missed rewrite is a
  window that quietly contradicts the engine — believed, because it is on the
  screen.
- **Compute the windows in SQL, as a view or a generated column.** Rejected: the
  arithmetic is not just addition. `ShabbatShiftRule`, `BritMilahRule` and
  `PidyonHabenRule` need the Hebrew calendar through `@hebcal/core`, so a SQL
  implementation is a second engine — untested against the step-4 suite, and
  impossible to keep in step with the first.
- **Cache the materialised windows in a table written on anchor change, as an
  optimisation over the derived read.** Deferred, not rejected. 20 items and
  three queries per screen is not a performance problem, and a cache is reversible; a
  schema that assumes stored dates is not.
- **One `for all` policy on `audit_log`, like every other table.** Rejected: it
  makes the log editable by its own subject, and an audit log its subject can
  edit is not an audit log. The consistency gained is cosmetic.
- **A `before update or delete` trigger on `audit_log` that raises.** Rejected:
  the absence of a policy already default-denies, and RLS is the mechanism every
  other table in this schema uses. The cost is that a blocked write reports zero
  rows instead of an error, which is exactly why decision 6 asserts it.
- **Service-role-only inserts into `audit_log`.** Rejected outright by hard rule
  1: no request path in `apps/web` holds the service-role key. A member's own
  JWT writes their own household's audit rows, and RLS checks the household.
