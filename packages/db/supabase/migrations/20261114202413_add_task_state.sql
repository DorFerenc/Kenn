-- What a person decided about a task. Not the task itself.
--
-- There is no `task_instance` table with due_start and due_end, and that is the
-- central design decision of roadmap step 5a (see ADR-0008). A window is day
-- offsets from an anchor; @kenn/engine materialises it at read time from the
-- anchors in `pregnancy` and the KB in git. Storing the dates would mean a
-- corrected EDD had to rewrite every row, and a row that disagreed with the
-- engine would be invisible until it mattered.
--
-- So the database stores the one thing the engine cannot derive: that somebody
-- ticked it, skipped it, or put it back.
--
-- `kb_version` is the version the decision was made under, so a later guidance
-- change can be shown as "guidance updated" without rewriting history — the
-- step 1 rule that completed work reads as it happened.
--
-- One row per (household, item). A reopen is an update to state = 'open', never
-- a delete: hard rule 5 says "remove" archives, and an append-only audit of who
-- did what lives in audit_log.

create table task_state (
  household_id uuid not null references household (id) on delete cascade,
  kb_item_id text not null check (length(trim(kb_item_id)) > 0),
  kb_version integer not null check (kb_version > 0),
  state text not null check (state in ('done', 'skipped', 'open')),
  acted_by uuid not null references auth.users (id),
  acted_at timestamptz not null default now(),
  note text,
  primary key (household_id, kb_item_id)
);

comment on table task_state is
  'Human decisions about materialised tasks. The windows themselves are derived, never stored.';
comment on column task_state.kb_version is
  'The KB version the decision was made under. Completed work keeps reading as it happened.';
comment on column task_state.state is
  'done | skipped | open. "open" is an explicit reopen, so no request path ever deletes a row.';

alter table task_state enable row level security;

create policy task_state_rw on task_state
  for all
  using (is_member(household_id))
  with check (is_member(household_id));

-- Realtime: the other parent's screen updates without a reload. RLS applies to
-- the subscription exactly as it applies to a query, so a member only ever
-- receives their own household's changes — the authorisation is the policy
-- above, not the channel name the client asks for.
alter publication supabase_realtime add table task_state;
