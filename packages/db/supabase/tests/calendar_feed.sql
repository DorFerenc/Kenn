-- RLS and function tests for calendar_feed (roadmap step 6a, ADR-0009).
--
-- The first table nobody writes directly, and the first function anon may
-- call. So beyond household A against household B, this asserts the two things
-- that make the design hold: a member cannot reach the hash or write around
-- the auditing functions in their *own* household, and an anonymous caller
-- learns one household's inputs with a live token and nothing at all without.

begin;

select plan(21);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email, instance_id, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'parent-a@example.test',
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
values ('11111111-0000-0000-0000-000000000001', 'lmp', '2026-07-01', 1);

insert into task_state (household_id, kb_item_id, kb_version, state, acted_by)
values ('11111111-0000-0000-0000-000000000001', 'preg.nt-scan', 1, 'done',
        'aaaaaaaa-0000-0000-0000-000000000001');

-- Household B's live feed, and an expired one in A, written as the owner
-- because nobody else can write this table at all.
insert into calendar_feed (id, household_id, created_by, token_hash, locale)
values ('cccccccc-0000-0000-0000-00000000000b', '22222222-0000-0000-0000-000000000002',
        'bbbbbbbb-0000-0000-0000-000000000002',
        encode(extensions.digest('token-of-household-b', 'sha256'), 'hex'), 'en');

insert into calendar_feed (household_id, created_by, token_hash, locale, expires_at)
values ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        encode(extensions.digest('expired-token-of-a', 'sha256'), 'hex'), 'he',
        now() - interval '1 day');

-- ---------------------------------------------------------- sign in as A
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text,
  true
);

create temporary table first_token as
  select create_calendar_feed('11111111-0000-0000-0000-000000000001', 'he') as t;

select matches(
  (select t from first_token), '^[0-9a-f]{64}$',
  'create_calendar_feed returns a 256-bit hex token'
);

-- ------------------------------------------------------------- SELECT
select is(
  (select count(*) from calendar_feed
   where household_id = '11111111-0000-0000-0000-000000000001' and revoked_at is null),
  1::bigint,
  'a member of A sees their own live feed — and creating it rotated the expired one'
);

select is(
  (select count(*) from calendar_feed
   where household_id = '22222222-0000-0000-0000-000000000002'),
  0::bigint,
  'a member of A cannot see household B''s feed'
);

select throws_ok(
  'select token_hash from calendar_feed',
  '42501', null,
  'a member cannot read the token hash, even of their own feed'
);

-- ------------------------------------------- INSERT / UPDATE / DELETE, direct
select throws_ok(
  $$insert into calendar_feed (household_id, created_by, token_hash, locale)
    values ('11111111-0000-0000-0000-000000000001',
            'aaaaaaaa-0000-0000-0000-000000000001', repeat('a', 64), 'he')$$,
  '42501', null,
  'a member cannot insert a feed directly, even into their own household'
);

select throws_ok(
  $$update calendar_feed set revoked_at = null
    where household_id = '11111111-0000-0000-0000-000000000001'$$,
  '42501', null,
  'a member cannot update a feed directly, so a revoked link cannot be revived'
);

select throws_ok(
  $$delete from calendar_feed where household_id = '22222222-0000-0000-0000-000000000002'$$,
  '42501', null,
  'a member cannot delete household B''s feed'
);

select throws_ok(
  $$delete from calendar_feed where household_id = '11111111-0000-0000-0000-000000000001'$$,
  '42501', null,
  'a member cannot delete their own feed either — revoking is the only removal'
);

-- ------------------------------------------------------------- functions
select is(
  (select count(*) from audit_log
   where household_id = '11111111-0000-0000-0000-000000000001'
     and action = 'calendar_feed.create'),
  1::bigint,
  'creating a feed wrote its audit row in the same transaction'
);

select throws_ok(
  $$select create_calendar_feed('22222222-0000-0000-0000-000000000002', 'en')$$,
  '42501', null,
  'a member of A cannot create a feed for household B'
);

select throws_ok(
  $$select revoke_calendar_feed('cccccccc-0000-0000-0000-00000000000b')$$,
  '42501', null,
  'a member of A cannot revoke household B''s feed'
);

create temporary table second_token as
  select create_calendar_feed('11111111-0000-0000-0000-000000000001', 'en') as t;

select is(
  (select count(*) from calendar_feed
   where household_id = '11111111-0000-0000-0000-000000000001'
     and revoked_at is null and expires_at > now()),
  1::bigint,
  'a new feed rotates: the creator''s previous live feed is revoked'
);

select is(
  (calendar_feed_inputs((select t from second_token))->>'household_id'),
  '11111111-0000-0000-0000-000000000001',
  'a live token yields its own household''s inputs'
);

select is(
  jsonb_array_length(calendar_feed_inputs((select t from second_token))->'decisions'),
  1,
  'the inputs carry the household''s decisions, so a done item is not re-announced'
);

select ok(
  calendar_feed_inputs((select t from first_token)) is null,
  'the rotated token yields nothing'
);

select ok(
  calendar_feed_inputs('expired-token-of-a') is null,
  'an expired token yields nothing'
);

select lives_ok(
  $$select revoke_calendar_feed(
      (select id from calendar_feed
       where household_id = '11111111-0000-0000-0000-000000000001'
         and revoked_at is null and expires_at > now()))$$,
  'a member can revoke their own household''s feed'
);

select ok(
  calendar_feed_inputs((select t from second_token)) is null,
  'a revoked token yields nothing'
);

-- ------------------------------------------------------------- anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  calendar_feed_inputs('token-of-household-b')->>'household_id',
  '22222222-0000-0000-0000-000000000002',
  'anon with a live token gets exactly that household'
);

select throws_ok(
  'select id from calendar_feed',
  '42501', null,
  'anon cannot read the table'
);

select throws_ok(
  $$select create_calendar_feed('22222222-0000-0000-0000-000000000002', 'en')$$,
  '42501', null,
  'anon cannot mint a feed'
);

select * from finish();
rollback;
