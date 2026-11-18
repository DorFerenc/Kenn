-- RLS and constraint tests for pregnancy.
--
-- The four negative assertions prove household B is unreachable; the positives
-- prove the policy is not simply "deny all", which would pass all four and
-- break the app. The last three assert the dating constraint, because an
-- anchor-less pregnancy produces an empty checklist rather than an error, and
-- an empty checklist looks like a quiet morning.

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

insert into pregnancy (household_id, dating_method, lmp, fetuses)
values
  ('11111111-0000-0000-0000-000000000001', 'lmp', '2026-06-01', 1),
  ('22222222-0000-0000-0000-000000000002', 'lmp', '2026-07-01', 2);

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
  (select count(*) from pregnancy where household_id = '11111111-0000-0000-0000-000000000001'),
  1::bigint,
  'a member of A can select their own pregnancy'
);

select is(
  (select count(*) from pregnancy where household_id = '22222222-0000-0000-0000-000000000002'),
  0::bigint,
  'a member of A cannot select household B pregnancy'
);

select is(
  (select count(*) from pregnancy),
  1::bigint,
  'an unfiltered select over pregnancy returns only A'
);

-- B's fetus count is health data about another family, and the most likely
-- shape of a leak is an aggregate that forgets the where clause.
select is(
  (select coalesce(sum(fetuses), 0) from pregnancy),
  1::bigint,
  'an aggregate over pregnancy cannot see household B rows'
);

-- ------------------------------------------------------------- INSERT
select throws_ok(
  $$insert into pregnancy (household_id, dating_method, lmp)
    values ('22222222-0000-0000-0000-000000000002', 'lmp', '2026-01-01')$$,
  '42501',
  null,
  'a member of A cannot insert a pregnancy into household B'
);

-- ------------------------------------------------------------- UPDATE
create temporary table upd_other as
with u as (
  update pregnancy set lmp = '2020-01-01'
  where household_id = '22222222-0000-0000-0000-000000000002'
  returning 1
) select * from u;

select is(
  (select count(*) from upd_other), 0::bigint,
  'an update aimed at household B pregnancy touches no rows'
);

create temporary table upd_own as
with u as (
  update pregnancy set fetuses = 2
  where household_id = '11111111-0000-0000-0000-000000000001'
  returning 1
) select * from u;

select is(
  (select count(*) from upd_own), 1::bigint,
  'a member of A can update their own pregnancy'
);

-- ------------------------------------------------------------- DELETE
create temporary table del_other as
with d as (
  delete from pregnancy
  where household_id = '22222222-0000-0000-0000-000000000002'
  returning 1
) select * from d;

select is(
  (select count(*) from del_other), 0::bigint,
  'a delete aimed at household B pregnancy touches no rows'
);

-- --------------------------------------------- household B survived all of it
reset role;
select is(
  (select lmp from pregnancy where household_id = '22222222-0000-0000-0000-000000000002'),
  '2026-07-01'::date,
  'household B pregnancy is untouched after every attempt above'
);

-- ------------------------------------------- the dating method needs its date
-- With a valid date, so the foreign key is the only thing left to fail: the
-- check constraint fires first otherwise, and the test would pass for the wrong
-- reason.
select throws_ok(
  $$insert into pregnancy (household_id, dating_method, lmp)
    values ('11111111-0000-0000-0000-000000000099', 'lmp', '2026-06-01')$$,
  '23503',
  null,
  'a pregnancy cannot hang off a household that does not exist'
);

insert into household (id, name) values ('33333333-0000-0000-0000-000000000003', 'Household C');

select throws_ok(
  $$insert into pregnancy (household_id, dating_method)
    values ('33333333-0000-0000-0000-000000000003', 'ultrasound')$$,
  '23514',
  null,
  'ultrasound dating without an EDD is refused, not stored as an anchorless pregnancy'
);

select lives_ok(
  $$insert into pregnancy (household_id, dating_method, transfer_date)
    values ('33333333-0000-0000-0000-000000000003', 'ivf_transfer', '2026-05-05')$$,
  'IVF dating with a transfer date is accepted'
);

select * from finish();
rollback;
