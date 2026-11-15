-- Who did what, append-only.
--
-- apps/web/CLAUDE.md requires every service write that changes household state
-- to land here, and the first such write arrives with roadmap step 5a — which
-- is why the table does too, rather than waiting for the MCP write tools at
-- step 10. A rule enforced one step after the code it governs is not a rule.
--
-- This is the one household table that does NOT use the single `for all`
-- policy, and the departure is the point (ADR-0008): there is a select policy
-- and an insert policy, and deliberately no update or delete policy, so both
-- default-deny. An audit log its subject can edit is not an audit log. The
-- pgTAP test asserts that a member cannot change or remove their OWN rows,
-- which is the one place in this schema where the positive case is a refusal.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household (id) on delete cascade,
  actor_kind text not null check (actor_kind in ('user', 'mcp', 'cron')),
  actor_user_id uuid references auth.users (id),
  actor_name text,
  action text not null check (length(trim(action)) > 0),
  entity text not null check (length(trim(entity)) > 0),
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),

  -- An MCP write must say which client made it, because "revoke all AI access"
  -- at step 10 has to be able to show the parent what that client did.
  constraint audit_log_mcp_names_its_client check (
    actor_kind <> 'mcp' or actor_name is not null
  )
);

comment on table audit_log is
  'Append-only history of household writes. Select and insert policies only; update and delete default-deny.';
comment on column audit_log.actor_name is
  'The MCP client name for an AI write. Required for actor_kind = mcp.';

create index audit_log_household_created_idx
  on audit_log (household_id, created_at desc);

alter table audit_log enable row level security;

create policy audit_log_select on audit_log
  for select
  using (is_member(household_id));

create policy audit_log_insert on audit_log
  for insert
  with check (is_member(household_id));
