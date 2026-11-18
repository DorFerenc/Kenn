-- Default deny per operation, not only per household.
--
-- Found by the security review of step 5a, and the reasoning is worth keeping
-- because it invalidated several sentences this project had written about
-- itself. The publishable key is public by design and `[api] schemas =
-- ["public"]` exposes every table through PostgREST, so **a signed-in member
-- holds a general-purpose SQL client against their own household**. One
-- authenticated request is as much a request path as a server action is:
--
--   curl -X DELETE "$URL/rest/v1/household?id=eq.<id>" \
--        -H "apikey: <publishable>" -H "Authorization: Bearer <their JWT>"
--
-- Every policy written so far was `for all`, which is correct about *which
-- household* and silent about *which operation*. Three claims were therefore
-- true of `apps/web` and false of the database, which is the boundary:
--
--   1. "audit_log is append-only." The command above deletes the household row,
--      and the cascade takes every audit_log row with it — a cascade is not
--      subject to the referencing table's RLS. Verified against the local
--      stack: one DELETE, zero audit rows left, no record of who did it.
--   2. "No request path can delete a task_state row" (ADR-0008, "structural
--      rather than conventional"). `DELETE /rest/v1/task_state?...` erased the
--      decision, who made it and when, leaving the 7-day undo nothing to undo.
--   3. "Two parents, one household." `DELETE /rest/v1/member?user_id=eq.<the
--      other parent>` evicted the other parent from their own pregnancy,
--      silently and permanently.
--
-- So each table now carries policies for exactly the operations the app
-- performs, and **no table has a delete policy** — deleting a household, a
-- member, a decision or an invite is not something Kenn does. Removal is
-- archival (hard rule 5): a reopen writes `state = 'open'`, a revoke writes
-- `revoked_at`.
--
-- Column privileges carry the two cases RLS cannot express, because RLS filters
-- rows and these are about columns: a member may edit their own preferences and
-- nothing else about their membership, and an invite may be revoked but not
-- resurrected.

-- ---------------------------------------------------------------- household
-- Insert is already impossible by design: create_household() is the only way a
-- household row is born, and it is SECURITY DEFINER. Update stays, because the
-- name and the default locale are editable. Delete goes.
drop policy household_rw on household;

create policy household_select on household
  for select using (is_member(id));

create policy household_update on household
  for update using (is_member(id)) with check (is_member(id));

-- ---------------------------------------------------------------- member
-- No insert policy: both ways a membership is created — create_household() and
-- accept_invite() — are SECURITY DEFINER, so the app never inserts here.
-- Update is restricted to the caller's own row, so one parent cannot change the
-- other's role or language; the column grant below narrows it further to the
-- two preference columns.
drop policy member_rw on member;

create policy member_select on member
  for select using (is_member(household_id));

create policy member_update_self on member
  for update
  using (is_member(household_id) and user_id = auth.uid())
  with check (is_member(household_id) and user_id = auth.uid());

revoke update on member from authenticated, anon;
grant update (locale, gender_form) on member to authenticated;

-- ---------------------------------------------------------------- invite
-- Revocation is an update of one column. Without the column grant, the same
-- update privilege lets a member clear `accepted_at` and extend `expires_at`,
-- making a redeemed token redeemable again — which defeats the reuse check
-- accept_invite() performs in SQL precisely so an app bug cannot widen it.
drop policy invite_rw on invite;

create policy invite_select on invite
  for select using (is_member(household_id));

create policy invite_insert on invite
  for insert with check (is_member(household_id));

create policy invite_update on invite
  for update using (is_member(household_id)) with check (is_member(household_id));

revoke update on invite from authenticated, anon;
grant update (revoked_at) on invite to authenticated;

-- ---------------------------------------------------------------- pregnancy
drop policy pregnancy_rw on pregnancy;

create policy pregnancy_select on pregnancy
  for select using (is_member(household_id));

create policy pregnancy_insert on pregnancy
  for insert with check (is_member(household_id));

create policy pregnancy_update on pregnancy
  for update using (is_member(household_id)) with check (is_member(household_id));

-- ------------------------------------------------------- household_profile
drop policy household_profile_rw on household_profile;

create policy household_profile_select on household_profile
  for select using (is_member(household_id));

create policy household_profile_insert on household_profile
  for insert with check (is_member(household_id));

create policy household_profile_update on household_profile
  for update using (is_member(household_id)) with check (is_member(household_id));

-- ---------------------------------------------------------------- task_state
-- `acted_by = auth.uid()` is new: the column says who ticked an item, and
-- without it a member could write the other parent's id into their own
-- household's row. "Parent B completed 2 items" has to be a fact, not a claim
-- by whoever sent the request.
drop policy task_state_rw on task_state;

create policy task_state_select on task_state
  for select using (is_member(household_id));

create policy task_state_insert on task_state
  for insert with check (is_member(household_id) and acted_by = auth.uid());

create policy task_state_update on task_state
  for update
  using (is_member(household_id))
  with check (is_member(household_id) and acted_by = auth.uid());

-- ---------------------------------------------------------------- audit_log
-- Already select + insert only. Two changes:
--
-- 1. The actor can no longer lie about itself. `actor_user_id` had to be filled
--    by the writer, so a member could write history naming their partner for
--    something they did.
-- 2. The cascade goes. With no delete policy on `household` a member can no
--    longer reach it, but a cascade is the one way an append-only table loses
--    rows without anybody updating or deleting it, so the foreign key refuses
--    instead. Deleting a household is now a deliberate act that has to deal
--    with its history first — which is the right friction for an erasure
--    request under Amendment 13, and exactly the "migration or service-role job
--    in CI, never a request path" that ADR-0008 already called for.
drop policy audit_log_insert on audit_log;

create policy audit_log_insert on audit_log
  for insert
  with check (
    is_member(household_id)
    and (actor_kind <> 'user' or actor_user_id = auth.uid())
  );

alter table audit_log
  drop constraint audit_log_household_id_fkey,
  add constraint audit_log_household_id_fkey
    foreign key (household_id) references household (id) on delete restrict;

comment on table audit_log is
  'Append-only history of household writes. Select and insert only; no update, no delete, and no cascade that could remove a row from behind.';
