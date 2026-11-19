-- RLS and function tests for calendar_feed (roadmap step 6a, ADR-0009).
--
-- The first table nobody writes directly, and the first function anon may
-- call. So beyond household A against household B, this asserts the two things
-- that make the design hold: a member cannot reach the hash or write around
-- the auditing functions in their *own* household, and an anonymous caller
-- learns one household's inputs with a live token and nothing at all without.

begin;

select plan(31);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email, instance_id, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'parent-a@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'parent-a2@example.test',
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
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', 'owner', 'en'),
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

insert into calendar_feed (household_id, created_by, token_hash, locale)
values ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011',
        encode(extensions.digest('token-of-the-other-parent', 'sha256'), 'hex'), 'en');

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
  2::bigint,
  'a member of A sees both parents'' live feeds — and creating one rotated only their own expired one'
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
  $$insert into calendar_feed (household_id, created_by, token_hash, locale)
    values ('22222222-0000-0000-0000-000000000002',
            'aaaaaaaa-0000-0000-0000-000000000001', repeat('b', 64), 'en')$$,
  '42501', null,
  'a member of A cannot insert a feed into household B'
);

select throws_ok(
  $$update calendar_feed set revoked_at = now()
    where household_id = '22222222-0000-0000-0000-000000000002'$$,
  '42501', null,
  'a member of A cannot update household B''s feed'
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
     and created_by = 'aaaaaaaa-0000-0000-0000-000000000001'
     and revoked_at is null and expires_at > now()),
  1::bigint,
  'a new feed rotates: the creator''s previous live feed is revoked'
);

select ok(
  calendar_feed_inputs('token-of-the-other-parent') is not null,
  'one parent rotating leaves the other parent''s feed live'
);

select is(
  (select array_agg(k order by k) from jsonb_object_keys(
     calendar_feed_inputs((select t from second_token))) k),
  array['decided', 'locale', 'pregnancy', 'profile', 'uid_salt'],
  'the function returns exactly these keys — a new one must be added here on purpose'
);

select is(
  (select array_agg(k order by k) from jsonb_object_keys(
     calendar_feed_inputs((select t from second_token))->'pregnancy') k),
  array['anchor', 'dating_method', 'fetuses'],
  'the pregnancy carries one date, not all three'
);

select is(
  calendar_feed_inputs((select t from second_token))->'pregnancy'->>'anchor',
  '2026-07-01',
  'a live token yields its own household''s inputs'
);

select is(
  calendar_feed_inputs((select t from second_token))->'decided',
  '["preg.nt-scan"]'::jsonb,
  'the inputs carry which items are decided, not how, so a done item is not re-announced'
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
         and created_by = 'aaaaaaaa-0000-0000-0000-000000000001'
         and revoked_at is null and expires_at > now()))$$,
  'a member can revoke their own household''s feed'
);

select ok(
  calendar_feed_inputs((select t from second_token)) is null,
  'a revoked token yields nothing'
);

select is(
  (select count(*) from audit_log
   where household_id = '11111111-0000-0000-0000-000000000001'
     and action = 'calendar_feed.revoke'),
  1::bigint,
  'revoking wrote its audit row in the same transaction'
);

-- ------------------------------------------------------------- anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  calendar_feed_inputs('token-of-household-b')->>'uid_salt',
  'cccccccc-0000-0000-0000-00000000000b',
  'anon with a live token gets exactly that feed''s inputs'
);

select throws_ok(
  'select id from calendar_feed',
  '42501', null,
  'anon cannot read the table'
);

-- Privileges, not the function bodies' own `auth.uid() is null` check: a test
-- that passes on the body's refusal passes whether or not anon holds the grant,
-- which is how anon kept execute on every function until step 6a's review.
select ok(
  not has_function_privilege('anon', 'public.create_calendar_feed(uuid,text)', 'execute'),
  'anon holds no execute on create_calendar_feed'
);

select ok(
  not has_function_privilege('anon', 'public.revoke_calendar_feed(uuid)', 'execute'),
  'anon holds no execute on revoke_calendar_feed'
);

select ok(
  not has_function_privilege('anon', 'public.accept_invite(text)', 'execute')
  and not has_function_privilege('anon', 'public.create_household(text,text)', 'execute'),
  'anon holds no execute on the member-only functions from earlier steps either'
);

select ok(
  has_function_privilege('anon', 'public.calendar_feed_inputs(text)', 'execute'),
  'anon may call calendar_feed_inputs, the one function meant for it'
);

-- ------------------------------------------------- the creator leaves
reset role;
delete from member
where household_id = '22222222-0000-0000-0000-000000000002'
  and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
set local role anon;

select ok(
  calendar_feed_inputs('token-of-household-b') is null,
  'a feed dies with its creator''s membership'
);

select * from finish();
rollback;
