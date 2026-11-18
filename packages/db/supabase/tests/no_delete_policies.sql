-- What a member may NOT do to their own household.
--
-- Every other pgTAP file here asks "can household A reach household B?". This
-- one asks the question the security review of step 5a found unasked: **what
-- can a member do to their own household's rows through the Data API?** The
-- publishable key is public and every table is exposed through PostgREST, so
-- one authenticated request is a request path — and `for all` policies, which
-- is what every table had, are silent about which operation.
--
-- Each assertion below corresponds to a sentence this project had written about
-- itself and which was false of the database until the policies were split:
--
--   * "audit_log is append-only"            — a household delete cascaded it away
--   * "no request path deletes a task_state row" (ADR-0008, "structural")
--   * "two parents, one household"          — either could evict the other
--   * "a revoked invite stops working"      — an update could resurrect it
--
-- A zero-row refusal is silent: an UPDATE or DELETE with no matching policy
-- reports zero rows rather than raising. So these are counted, not caught.

begin;

select plan(15);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email, instance_id, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'parent-a@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'parent-b@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into household (id, name) values ('11111111-0000-0000-0000-000000000001', 'Household A');

insert into member (household_id, user_id, role, locale)
values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner', 'he'),
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', 'owner', 'en');

insert into pregnancy (household_id, dating_method, lmp)
values ('11111111-0000-0000-0000-000000000001', 'lmp', '2026-06-01');

insert into household_profile (household_id, firstborn)
values ('11111111-0000-0000-0000-000000000001', true);

insert into task_state (household_id, kb_item_id, kb_version, state, acted_by)
values ('11111111-0000-0000-0000-000000000001', 'preg.nt-scan', 1, 'done',
        'aaaaaaaa-0000-0000-0000-000000000001');

insert into audit_log (household_id, actor_kind, actor_user_id, action, entity)
values ('11111111-0000-0000-0000-000000000001', 'user',
        'aaaaaaaa-0000-0000-0000-000000000001', 'task.done', 'task_state');

insert into invite (id, household_id, email, token_hash, invited_by, expires_at, accepted_at)
values ('eeeeeeee-0000-0000-0000-00000000000e', '11111111-0000-0000-0000-000000000001',
        'partner@example.test', repeat('a', 64), 'aaaaaaaa-0000-0000-0000-000000000001',
        now() + interval '7 days', now());

-- ------------------------------------------------- signed in as parent A of A
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'aaaaaaaa-0000-0000-0000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);

-- ------------------------------------------- the household itself is not deletable
create temporary table del_household as
with d as (delete from household where id = '11111111-0000-0000-0000-000000000001' returning 1)
select * from d;

select is(
  (select count(*) from del_household), 0::bigint,
  'a member cannot delete their own household, so nothing can cascade'
);

reset role;
select is(
  (select count(*) from audit_log where household_id = '11111111-0000-0000-0000-000000000001'),
  1::bigint,
  'the audit log survives the attempt, which is what append-only has to mean'
);

-- The cascade is gone as well as the policy: belt and braces, because a cascade
-- is not subject to the referencing table's RLS and would therefore ignore
-- every assertion above.
select is(
  (select confdeltype from pg_constraint where conname = 'audit_log_household_id_fkey'),
  'r'::"char",
  'audit_log''s foreign key refuses a household delete rather than cascading'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);

-- ------------------------------------------- nothing of their own is deletable
create temporary table del_task as
with d as (delete from task_state where household_id = '11111111-0000-0000-0000-000000000001' returning 1)
select * from d;
select is((select count(*) from del_task), 0::bigint,
  'a member cannot delete their own task_state row: a reopen is an update (ADR-0008)');

create temporary table del_pregnancy as
with d as (delete from pregnancy where household_id = '11111111-0000-0000-0000-000000000001' returning 1)
select * from d;
select is((select count(*) from del_pregnancy), 0::bigint,
  'a member cannot delete their own pregnancy');

create temporary table del_profile as
with d as (delete from household_profile where household_id = '11111111-0000-0000-0000-000000000001' returning 1)
select * from d;
select is((select count(*) from del_profile), 0::bigint,
  'a member cannot delete their own profile');

create temporary table del_invite as
with d as (delete from invite where id = 'eeeeeeee-0000-0000-0000-00000000000e' returning 1)
select * from d;
select is((select count(*) from del_invite), 0::bigint,
  'a member cannot delete an invite: revoking is an update');

create temporary table del_audit as
with d as (delete from audit_log where household_id = '11111111-0000-0000-0000-000000000001' returning 1)
select * from d;
select is((select count(*) from del_audit), 0::bigint,
  'a member cannot delete their own history');

-- --------------------------------------- one parent cannot act on the other
create temporary table del_member as
with d as (delete from member where user_id = 'aaaaaaaa-0000-0000-0000-000000000011' returning 1)
select * from d;
select is((select count(*) from del_member), 0::bigint,
  'one parent cannot evict the other from their own household');

select throws_ok(
  $$update member set role = 'caregiver'
    where user_id = 'aaaaaaaa-0000-0000-0000-000000000011'$$,
  '42501',
  null,
  'one parent cannot change the other''s role: role is not a grantable column'
);

select throws_ok(
  $$update member set role = 'owner' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'a member cannot promote themselves either: only locale and gender_form are grantable'
);

create temporary table upd_own_prefs as
with u as (
  update member set locale = 'en', gender_form = 'feminine'
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  returning 1
) select * from u;
select is((select count(*) from upd_own_prefs), 1::bigint,
  'a member can still change their own language and gender form');

-- --------------------------------- a redeemed invite cannot be resurrected
select throws_ok(
  $$update invite set accepted_at = null, expires_at = now() + interval '7 days'
    where id = 'eeeeeeee-0000-0000-0000-00000000000e'$$,
  '42501',
  null,
  'a used invite cannot be made redeemable again: only revoked_at is grantable'
);

create temporary table upd_revoke as
with u as (
  update invite set revoked_at = now() where id = 'eeeeeeee-0000-0000-0000-00000000000e' returning 1
) select * from u;
select is((select count(*) from upd_revoke), 1::bigint,
  'revoking an invite still works, because that is the one column granted');

-- ------------------------------------ the actor of a write cannot be forged
select throws_ok(
  $$insert into audit_log (household_id, actor_kind, actor_user_id, action, entity)
    values ('11111111-0000-0000-0000-000000000001', 'user',
            'aaaaaaaa-0000-0000-0000-000000000011', 'task.done', 'task_state')$$,
  '42501',
  null,
  'a member cannot write history naming the other parent as the actor'
);

select * from finish();
rollback;
