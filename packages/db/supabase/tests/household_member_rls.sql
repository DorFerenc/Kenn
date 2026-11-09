-- RLS tests for household and member.
--
-- The shape every later household table copies: sign in as a member of
-- household A and assert zero rows from household B for select, insert, update
-- and delete, plus positive cases proving the policy is not simply "deny all".
--
-- A policy that denies everything passes the four negative assertions and
-- breaks the app, so the positives are not optional.

begin;

select plan(14);

-- ---------------------------------------------------------------- fixtures
-- Created as the migration role, which bypasses RLS, so the fixtures exist
-- regardless of the policies under test.

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
  (select count(*) from household where id = '11111111-0000-0000-0000-000000000001'),
  1::bigint,
  'a member of A can select their own household'
);

select is(
  (select count(*) from household where id = '22222222-0000-0000-0000-000000000002'),
  0::bigint,
  'a member of A cannot select household B'
);

select is(
  (select count(*) from household),
  1::bigint,
  'an unfiltered select over household returns only A'
);

select is(
  (select count(*) from member where household_id = '11111111-0000-0000-0000-000000000001'),
  1::bigint,
  'a member of A can select their own membership'
);

select is(
  (select count(*) from member),
  1::bigint,
  'an unfiltered select over member never leaks B'
);

-- ------------------------------------------------------------- INSERT
select throws_ok(
  $$insert into member (household_id, user_id, role)
    values ('22222222-0000-0000-0000-000000000002',
            'aaaaaaaa-0000-0000-0000-000000000001', 'owner')$$,
  '42501',
  null,
  'a member of A cannot insert themselves into household B'
);

select throws_ok(
  $$insert into household (id, name) values (gen_random_uuid(), 'Smuggled')$$,
  '42501',
  null,
  'nobody can insert a household row directly; create_household is the only way'
);

-- ------------------------------------------------------------- UPDATE
create temporary table upd_other as
with u as (
  update household set name = 'hijacked'
  where id = '22222222-0000-0000-0000-000000000002'
  returning 1
) select * from u;

select is(
  (select count(*) from upd_other), 0::bigint,
  'an update aimed at household B touches no rows'
);

create temporary table upd_own as
with u as (
  update household set name = 'Household A renamed'
  where id = '11111111-0000-0000-0000-000000000001'
  returning 1
) select * from u;

select is(
  (select count(*) from upd_own), 1::bigint,
  'a member of A can update their own household'
);

create temporary table upd_member_other as
with u as (
  update member set role = 'owner'
  where household_id = '22222222-0000-0000-0000-000000000002'
  returning 1
) select * from u;

select is(
  (select count(*) from upd_member_other), 0::bigint,
  'an update aimed at household B members touches no rows'
);

-- ------------------------------------------------------------- DELETE
create temporary table del_other as
with d as (
  delete from household
  where id = '22222222-0000-0000-0000-000000000002'
  returning 1
) select * from d;

select is(
  (select count(*) from del_other), 0::bigint,
  'a delete aimed at household B touches no rows'
);

create temporary table del_member_other as
with d as (
  delete from member
  where household_id = '22222222-0000-0000-0000-000000000002'
  returning 1
) select * from d;

select is(
  (select count(*) from del_member_other), 0::bigint,
  'a delete aimed at household B members touches no rows'
);

-- ------------------------------------------- household B survived all of it
reset role;
select is(
  (select name from household where id = '22222222-0000-0000-0000-000000000002'),
  'Household B',
  'household B is untouched after every attempt above'
);

select is(
  (select count(*) from member where household_id = '22222222-0000-0000-0000-000000000002'),
  1::bigint,
  'household B still has its member'
);

select * from finish();
rollback;
