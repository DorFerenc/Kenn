-- create_household() is the only way a household row is born, so its
-- behaviour is part of the security boundary, not a convenience.

begin;

select plan(5);

insert into auth.users (id, email, instance_id, aud, role)
values ('cccccccc-0000-0000-0000-000000000003', 'new@example.test',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- Anonymous callers are refused.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);

select throws_ok(
  $$select create_household('No auth')$$,
  '42501',
  null,
  'create_household refuses a caller with no auth.uid()'
);

-- A signed-in user gets a household and owns it.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'cccccccc-0000-0000-0000-000000000003',
                    'role', 'authenticated')::text,
  true
);

create temporary table made as
select create_household('Kenn test household', 'en') as id;

select isnt(
  (select id from made), null,
  'create_household returns the new household id'
);

select is(
  (select count(*) from household h join made m on m.id = h.id),
  1::bigint,
  'the caller can immediately see the household they created'
);

select is(
  (select role from member m join made x on x.id = m.household_id
   where m.user_id = 'cccccccc-0000-0000-0000-000000000003'),
  'owner',
  'the caller is recorded as owner'
);

select is(
  (select default_locale from household h join made m on m.id = h.id),
  'en',
  'the locale argument is stored, so an English speaker is not given Hebrew'
);

select * from finish();
rollback;
