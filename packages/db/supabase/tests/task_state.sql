-- RLS tests for task_state.
--
-- This is the table two parents write to all day, so it gets the four
-- operations against household B plus the two cases that are specific to it:
-- a second member of the same household can tick an item their partner created
-- a row for, and the realtime publication actually carries the table — a
-- subscription that silently covers nothing looks exactly like a quiet app.

begin;

select plan(12);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email, instance_id, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'parent-a@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'parent-b@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'stranger@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into household (id, name, default_locale)
values
  ('11111111-0000-0000-0000-000000000001', 'Household A', 'he'),
  ('22222222-0000-0000-0000-000000000002', 'Household B', 'en');

-- Household A is the two-parent case the product exists for.
insert into member (household_id, user_id, role, locale)
values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner', 'he'),
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', 'owner', 'en'),
  ('22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'owner', 'en');

insert into task_state (household_id, kb_item_id, kb_version, state, acted_by)
values
  ('11111111-0000-0000-0000-000000000001', 'preg.nt-scan', 1, 'done',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000002', 'preg.glucose-challenge', 1, 'done',
   'bbbbbbbb-0000-0000-0000-000000000002');

-- -------------------------------------------------- sign in as parent A of A
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
  (select state from task_state
   where household_id = '11111111-0000-0000-0000-000000000001'
     and kb_item_id = 'preg.nt-scan'),
  'done',
  'a member of A can select their own task state'
);

select is(
  (select count(*) from task_state
   where household_id = '22222222-0000-0000-0000-000000000002'),
  0::bigint,
  'a member of A cannot select household B task state'
);

select is(
  (select count(*) from task_state),
  1::bigint,
  'an unfiltered select over task_state returns only A'
);

-- Which items another family has done is health data: it says what they were
-- tested for and when.
select is_empty(
  $$select kb_item_id from task_state where kb_item_id = 'preg.glucose-challenge'$$,
  'household B''s completed items are invisible even when the item id is known'
);

-- ------------------------------------------------------------- INSERT
select throws_ok(
  $$insert into task_state (household_id, kb_item_id, kb_version, state, acted_by)
    values ('22222222-0000-0000-0000-000000000002', 'preg.tdap', 1, 'done',
            'aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'a member of A cannot tick an item in household B'
);

select lives_ok(
  $$insert into task_state (household_id, kb_item_id, kb_version, state, acted_by)
    values ('11111111-0000-0000-0000-000000000001', 'preg.tdap', 1, 'done',
            'aaaaaaaa-0000-0000-0000-000000000001')$$,
  'a member of A can tick an item in their own household'
);

-- ------------------------------------------------------------- UPDATE
create temporary table upd_other as
with u as (
  update task_state set state = 'open'
  where household_id = '22222222-0000-0000-0000-000000000002'
  returning 1
) select * from u;

select is(
  (select count(*) from upd_other), 0::bigint,
  'an update aimed at household B task state touches no rows'
);

-- ------------------------------------------------------------- DELETE
create temporary table del_other as
with d as (
  delete from task_state
  where household_id = '22222222-0000-0000-0000-000000000002'
  returning 1
) select * from d;

select is(
  (select count(*) from del_other), 0::bigint,
  'a delete aimed at household B task state touches no rows'
);

-- ------------------------------------- the other parent, same household
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'aaaaaaaa-0000-0000-0000-000000000011',
    'role', 'authenticated'
  )::text,
  true
);

create temporary table upd_partner as
with u as (
  update task_state set state = 'open', acted_by = 'aaaaaaaa-0000-0000-0000-000000000011'
  where household_id = '11111111-0000-0000-0000-000000000001'
    and kb_item_id = 'preg.nt-scan'
  returning 1
) select * from u;

select is(
  (select count(*) from upd_partner), 1::bigint,
  'the other parent of the same household can reopen an item'
);

select is(
  (select count(*) from task_state
   where household_id = '22222222-0000-0000-0000-000000000002'),
  0::bigint,
  'the other parent of A also sees nothing of household B'
);

-- --------------------------------------------- household B survived all of it
reset role;
select is(
  (select state from task_state
   where household_id = '22222222-0000-0000-0000-000000000002'),
  'done',
  'household B task state is untouched after every attempt above'
);

-- ----------------------------------------- realtime actually carries the table
select is(
  (select count(*) from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public'
     and tablename = 'task_state'),
  1::bigint,
  'task_state is in the supabase_realtime publication, so a subscription is not silently empty'
);

select * from finish();
rollback;
