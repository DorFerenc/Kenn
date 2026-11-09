-- RLS and redemption rules for invite.

begin;

select plan(11);

insert into auth.users (id, email, instance_id, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'owner-a@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'owner-b@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-00000000000c', 'partner@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into household (id, name) values
  ('aaaa1111-0000-0000-0000-000000000001', 'Household A'),
  ('bbbb2222-0000-0000-0000-000000000002', 'Household B');

insert into member (household_id, user_id, role) values
  ('aaaa1111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'owner'),
  ('bbbb2222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-00000000000b', 'owner');

-- Four invites: a good one for A, plus expired / revoked / already-accepted.
insert into invite (household_id, email, token_hash, invited_by, expires_at, accepted_at, revoked_at)
values
  ('aaaa1111-0000-0000-0000-000000000001', 'partner@example.test',
   encode(extensions.digest('good-token', 'sha256'), 'hex'),
   'aaaaaaaa-0000-0000-0000-00000000000a', now() + interval '7 days', null, null),
  ('aaaa1111-0000-0000-0000-000000000001', 'late@example.test',
   encode(extensions.digest('expired-token', 'sha256'), 'hex'),
   'aaaaaaaa-0000-0000-0000-00000000000a', now() - interval '1 day', null, null),
  ('aaaa1111-0000-0000-0000-000000000001', 'gone@example.test',
   encode(extensions.digest('revoked-token', 'sha256'), 'hex'),
   'aaaaaaaa-0000-0000-0000-00000000000a', now() + interval '7 days', null, now()),
  ('bbbb2222-0000-0000-0000-000000000002', 'other@example.test',
   encode(extensions.digest('b-token', 'sha256'), 'hex'),
   'bbbbbbbb-0000-0000-0000-00000000000b', now() + interval '7 days', null, null);

-- ------------------------------------------------- as the owner of household A
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-0000-0000-0000-00000000000a',
                    'role', 'authenticated')::text, true);

select is((select count(*) from invite), 3::bigint,
  'the owner of A sees only A''s three invites, never B''s');

select throws_ok(
  $$insert into invite (household_id, email, token_hash, invited_by, expires_at)
    values ('bbbb2222-0000-0000-0000-000000000002', 'x@example.test',
            repeat('f', 64), 'aaaaaaaa-0000-0000-0000-00000000000a', now() + interval '1 day')$$,
  '42501', null,
  'the owner of A cannot create an invite into household B');

-- ------------------------------------------------- as the invited partner
select set_config('request.jwt.claims',
  json_build_object('sub', 'cccccccc-0000-0000-0000-00000000000c',
                    'role', 'authenticated')::text, true);

select is((select count(*) from invite), 0::bigint,
  'the invitee cannot read the invite row at all before accepting');

select throws_ok($$select accept_invite('expired-token')$$, '42501', null,
  'an expired invite is refused');
select throws_ok($$select accept_invite('revoked-token')$$, '42501', null,
  'a revoked invite is refused');
select throws_ok($$select accept_invite('no-such-token')$$, '42501', null,
  'an unknown token is refused');

create temporary table joined as select accept_invite('good-token') as household_id;

select is((select household_id from joined), 'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'a valid invite returns the household it joined');

select is((select count(*) from member where household_id = 'aaaa1111-0000-0000-0000-000000000001'),
  2::bigint,
  'the partner is now a member, so both parents see one household');

select is((select count(*) from invite), 3::bigint,
  'having joined, the partner now sees the household''s invites');

select throws_ok($$select accept_invite('good-token')$$, '42501', null,
  'the same token cannot be redeemed twice');

-- ------------------------------------------------- household B is unaffected
reset role;
select is((select count(*) from member where household_id = 'bbbb2222-0000-0000-0000-000000000002'),
  1::bigint,
  'household B still has exactly its own member');

select * from finish();
rollback;
