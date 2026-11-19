# ADR-0009 — A read without a session goes through one token-scoped function, as `anon`

- **Date:** 2026-11-18
- **Status:** accepted
- **Supersedes / superseded by:** none

## Context

Hard rule 1 says only `apps/web/lib/services` touches the database, "always
with the signed-in user's JWT — never the service-role key". Every read until
step 6a had a signed-in user behind it.

The calendar feed does not. Google's and Apple's servers fetch the ICS URL on
their own schedule, with no cookie and no session, and they will keep doing so
for as long as the subscription exists. Step 15's share links and step 6b's
reminder job have the same shape: someone or something must read one
household's data without being a member of it.

Three ways to give that caller data:

- **The service-role key** in the route handler. It bypasses RLS on every
  table, so the route's own `where household_id = …` becomes the only thing
  between a bug and every family's pregnancy. Hard rule 1 exists to forbid
  exactly this.
- **A table policy for `anon`** keyed on a token. RLS cannot see a request
  parameter, so the token would have to travel as a header the policy reads
  through `current_setting()`, and every table the feed reads — `pregnancy`,
  `household_profile`, `task_state` — would carry an `anon` policy forever.
- **One `SECURITY DEFINER` function that takes the raw token** and returns
  exactly what the caller needs, granted to `anon` and to nothing else that
  `anon` can reach. This is how `accept_invite()` already works.

## Decision

**A read without a session is one `SECURITY DEFINER` function per purpose,
callable by `anon`, that takes the raw token and returns the minimum.**

For the calendar feed that is `calendar_feed_inputs(token)`:

1. The token is 256 random bits minted in SQL. Only its SHA-256 hash is
   stored, and members cannot select the hash. Unsalted SHA-256 is enough for a
   value with 256 bits of entropy; a salt defends low-entropy secrets.
2. It returns the three inputs `composeTasks()` needs, each cut to the
   minimum — the dating method and the one date it uses, the profile, and the
   ids of decided items without their state — plus the feed's locale and a
   per-feed UID salt, and nothing else: no household id, no member, no email,
   no note, no audit row.
   The windows are derived in `apps/web` from the same function the Checklist
   uses (ADR-0008).
3. Unknown, revoked and expired tokens all return `null`, and the route turns
   every one of those, and a malformed token, into the same bare 404.
4. The route calls it through a Supabase client built in `lib/services` with
   the publishable key and no session. The service-role key is still held by
   nothing on a request path.
5. **The table is written by nobody directly.** Create, rotate and revoke are
   `SECURITY DEFINER` functions that write their `audit_log` row in the same
   transaction, `authenticated` holds no insert, update or delete privilege,
   and restrictive `false` policies back that up against a future
   `grant all`. This is the shape ADR-0008 prescribes for every household
   write at step 9, used here from the first migration.
6. A feed expires after a year and rotates in one tap; making a new one
   revokes the maker's previous one in the same transaction.

Hard rule 1 gains one clause: the exception is a token-scoped function called
as `anon`, never the service-role key.

## Consequences

- **"Granted to `anon` and nothing else" is a privilege, asserted as one.**
  Supabase's default privileges grant execute on every new function in
  `public` to `anon` by name, and `revoke ... from public` does not remove it —
  found by the security review of step 6a, when every member-only function was
  callable by `anon` and refused it with one `if`. The default no longer grants
  it, a function `anon` may call says so with an explicit `grant`, and pgTAP
  checks `has_function_privilege()` rather than relying on the body's refusal.
- Each new kind of sessionless read is a new function with its own pgTAP
  file, rather than a widening of a table policy. Step 15's share links follow
  this ADR; step 6b's reminder job, which reads every household, needs its own
  decision.
- The feed's titles leave Kenn: they sit on Google's or Apple's servers once
  subscribed. The Household page says so before the link exists, and the
  default is full titles, which the user chose over generic ones.
- The token is in a URL path, so it reaches whatever logs the host keeps and
  the subscribing calendar's storage. Rotation and expiry are the mitigation;
  the route is excluded from the proxy and sends `no-store` and `noindex`.
- `calendar_feed_inputs()` returns a per-feed `uid_salt` rather than
  `household_id`, which the route hashes into event UIDs, so the two parents'
  calendars cannot be tied to one household. The profile is returned whole,
  because `applies_if` can test any of it and a narrower list kept in SQL would
  drift from the KB. That is the residual exposure of a leaked token.
- A feed dies with its creator's membership: the function returns `null` once
  the creator is no longer a member, so a parent who leaves keeps no window
  into the household.

## Alternatives considered

- **Service-role key in the route.** Rejected by hard rule 1, for the reason
  that rule was written.
- **`anon` policies on the household tables.** Rejected: three tables would
  each carry a second door, each one a place a later migration could widen.
- **Generic event titles.** Offered, and not chosen: a subscription is opt-in
  and its value is seeing "NT scan" on Tuesday. Revisit at Gate C, when other
  families arrive.
