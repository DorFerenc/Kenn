-- RLS tests for household_profile.
--
-- The same four operations against household B, plus one assertion that is
-- about correctness rather than access: a column left unanswered stays null.
-- `appliesTo()` in @kenn/engine treats null as "does not match", so a default
-- creeping into this table would quietly start showing items to families the
-- guidance does not apply to.

begin;

select plan(10);

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

insert into household_profile (household_id, firstborn, health_fund)
values
  ('11111111-0000-0000-0000-000000000001', true, 'clalit'),
  ('22222222-0000-0000-0000-000000000002', false, 'maccabi');

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
  (select health_fund from household_profile
   where household_id = '11111111-0000-0000-0000-000000000001'),
  'clalit',
  'a member of A can select their own profile'
);

select is(
  (select count(*) from household_profile
   where household_id = '22222222-0000-0000-0000-000000000002'),
  0::bigint,
  'a member of A cannot select household B profile'
);

select is(
  (select count(*) from household_profile),
  1::bigint,
  'an unfiltered select over household_profile returns only A'
);

-- ------------------------------------------------------------- INSERT
select throws_ok(
  $$insert into household_profile (household_id, firstborn)
    values ('22222222-0000-0000-0000-000000000002', true)$$,
  '42501',
  null,
  'a member of A cannot insert a profile into household B'
);

-- ------------------------------------------------------------- UPDATE
create temporary table upd_other as
with u as (
  update household_profile set health_fund = 'leumit'
  where household_id = '22222222-0000-0000-0000-000000000002'
  returning 1
) select * from u;

select is(
  (select count(*) from upd_other), 0::bigint,
  'an update aimed at household B profile touches no rows'
);

create temporary table upd_own as
with u as (
  update household_profile set health_fund = 'meuhedet'
  where household_id = '11111111-0000-0000-0000-000000000001'
  returning 1
) select * from u;

select is(
  (select count(*) from upd_own), 1::bigint,
  'a member of A can update their own profile'
);

-- ------------------------------------------------------------- DELETE
create temporary table del_other as
with d as (
  delete from household_profile
  where household_id = '22222222-0000-0000-0000-000000000002'
  returning 1
) select * from d;

select is(
  (select count(*) from del_other), 0::bigint,
  'a delete aimed at household B profile touches no rows'
);

-- --------------------------------------------- household B survived all of it
reset role;
select is(
  (select health_fund from household_profile
   where household_id = '22222222-0000-0000-0000-000000000002'),
  'maccabi',
  'household B profile is untouched after every attempt above'
);

-- ------------------------------------- an unanswered question stays unanswered
select is(
  (select rh_negative from household_profile
   where household_id = '11111111-0000-0000-0000-000000000001'),
  null,
  'a column nobody answered is null, which appliesTo() reads as "does not match"'
);

select throws_ok(
  $$insert into household_profile (household_id, health_fund)
    values ('11111111-0000-0000-0000-000000000001', 'a-fund-that-does-not-exist')$$,
  '23514',
  null,
  'a health fund outside the four is refused'
);

select * from finish();
rollback;
