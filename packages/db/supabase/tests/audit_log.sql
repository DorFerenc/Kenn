-- RLS tests for audit_log, the one household table that is append-only.
--
-- The four operations against household B are here as on every other table,
-- but the assertions that matter most are the ones aimed at household A's OWN
-- rows: a member may read and insert, and may NOT update or delete. There is no
-- update or delete policy, so both default-deny — and the test has to prove
-- that, because the failure mode is silent. An UPDATE with no matching policy
-- does not raise; it reports zero rows affected, so an app that rewrote its own
-- audit trail would look like an app that worked.

begin;

select plan(12);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email, instance_id, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'stranger@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into household (id, name, default_locale)
values
  ('11111111-0000-0000-0000-000000000001', 'Household A', 'he'),
  ('22222222-0000-0000-0000-000000000002', 'Household B', 'en');

insert into member (household_id, user_id, role, locale)
values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner', 'he'),
  ('22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'owner', 'en');

insert into audit_log (id, household_id, actor_kind, actor_user_id, action, entity, entity_id)
values
  ('dddddddd-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-000000000001',
   'user', 'aaaaaaaa-0000-0000-0000-000000000001', 'task.complete', 'task_state', 'preg.nt-scan'),
  ('dddddddd-0000-0000-0000-00000000000b', '22222222-0000-0000-0000-000000000002',
   'user', 'bbbbbbbb-0000-0000-0000-000000000002', 'task.complete', 'task_state', 'preg.tdap');

-- -------------------------------------------------- sign in as a member of A
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'aaaaaaaa-0000-0000-0000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);

-- ------------------------------------------------------------- SELECT
select is(
  (select action from audit_log where household_id = '11111111-0000-0000-0000-000000000001'),
  'task.complete',
  'a member of A can read their own household history'
);

select is(
  (select count(*) from audit_log where household_id = '22222222-0000-0000-0000-000000000002'),
  0::bigint,
  'a member of A cannot read household B history'
);

select is(
  (select count(*) from audit_log),
  1::bigint,
  'an unfiltered select over audit_log returns only A'
);

-- ------------------------------------------------------------- INSERT
select throws_ok(
  $$insert into audit_log (household_id, actor_kind, action, entity)
    values ('22222222-0000-0000-0000-000000000002', 'user', 'task.complete', 'task_state')$$,
  '42501',
  null,
  'a member of A cannot write history into household B'
);

select lives_ok(
  $$insert into audit_log (household_id, actor_kind, actor_user_id, action, entity)
    values ('11111111-0000-0000-0000-000000000001', 'user',
            'aaaaaaaa-0000-0000-0000-000000000001', 'pregnancy.update', 'pregnancy')$$,
  'a member of A can append to their own household history'
);

-- ------------------------------- append-only: their OWN rows are not editable
create temporary table upd_own as
with u as (
  update audit_log set action = 'nothing.happened'
  where household_id = '11111111-0000-0000-0000-000000000001'
  returning 1
) select * from u;

select is(
  (select count(*) from upd_own), 0::bigint,
  'a member cannot rewrite their own household history: no update policy exists'
);

create temporary table del_own as
with d as (
  delete from audit_log
  where household_id = '11111111-0000-0000-0000-000000000001'
  returning 1
) select * from d;

select is(
  (select count(*) from del_own), 0::bigint,
  'a member cannot delete their own household history: no delete policy exists'
);

-- ------------------------------------------------------------- UPDATE/DELETE on B
create temporary table upd_other as
with u as (
  update audit_log set action = 'nothing.happened'
  where household_id = '22222222-0000-0000-0000-000000000002'
  returning 1
) select * from u;

select is(
  (select count(*) from upd_other), 0::bigint,
  'an update aimed at household B history touches no rows'
);

create temporary table del_other as
with d as (
  delete from audit_log
  where household_id = '22222222-0000-0000-0000-000000000002'
  returning 1
) select * from d;

select is(
  (select count(*) from del_other), 0::bigint,
  'a delete aimed at household B history touches no rows'
);

-- --------------------------------------------- everything survived all of it
reset role;
select is(
  (select action from audit_log where id = 'dddddddd-0000-0000-0000-00000000000a'),
  'task.complete',
  'household A''s own history entry is unchanged'
);

select is(
  (select action from audit_log where id = 'dddddddd-0000-0000-0000-00000000000b'),
  'task.complete',
  'household B''s history entry is unchanged'
);

-- ------------------------------- an AI write has to name the client that made it
select throws_ok(
  $$insert into audit_log (household_id, actor_kind, action, entity)
    values ('11111111-0000-0000-0000-000000000001', 'mcp', 'task.complete', 'task_state')$$,
  '23514',
  null,
  'an mcp write with no client name is refused, so "revoke all" can always say who did what'
);

select * from finish();
rollback;
