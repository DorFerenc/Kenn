-- Two findings of the security review of step 6a.
--
-- 1. `anon` could execute every function in `public`.
--
--    Supabase's base schema runs `alter default privileges ... grant all on
--    functions to anon, authenticated, service_role`, by name. Every migration
--    here then said `revoke all on function ... from public`, which removes the
--    PUBLIC grant and leaves the named one standing. Verified against the local
--    stack: has_function_privilege('anon', ..., 'execute') was true for
--    create_household, accept_invite, create_calendar_feed and
--    revoke_calendar_feed. Each body refuses a null auth.uid(), so nothing was
--    reachable — but the only wall was one `if` per function, and the pgTAP
--    test "anon cannot mint a feed" passed on that `if`, not on a privilege.
--    A gate that passes for the wrong reason (Rules learned #1).
--
--    So: revoke from `anon` by name on every member-only function, and change
--    the default so a function created from now on starts with no execute
--    grant for `anon` or PUBLIC. A new function anon may call has to say so.
--
-- 2. calendar_feed_inputs() returned more than the calendar needs.
--
--    The function is reachable through PostgREST by anyone holding a feed
--    token, not only through the ICS route, so its result is what a leaked
--    token grants. It returned household_id, every decision with its state and
--    KB version, and all three dating columns. Now:
--
--      * no household_id — a per-feed `uid_salt` instead, so event UIDs no
--        longer tie both parents' calendars to one household;
--      * the ids of decided items only (done or skipped), not their state;
--      * only the one date the dating method uses, as the app already reduced
--        it to before handing it to the engine (`pregnancyInput()`);
--      * the profile stays whole, because `applies_if` can test any of it and
--        a narrower list kept in SQL would drift from the KB. ADR-0009 names
--        this as the residual exposure.
--
--    And a feed dies with its creator's membership: a parent who leaves a
--    household (step 15) must not keep a live window into it.

-- ------------------------------------------------------------------ 1
revoke execute on function create_household(text, text) from anon;
revoke execute on function accept_invite(text) from anon;
revoke execute on function create_calendar_feed(uuid, text) from anon;
revoke execute on function revoke_calendar_feed(uuid) from anon;

alter default privileges in schema public revoke execute on functions from public, anon;

-- ------------------------------------------------------------------ 2
create or replace function calendar_feed_inputs(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'uid_salt', f.id,
    'locale', f.locale,
    'pregnancy', (
      select jsonb_build_object(
        'dating_method', p.dating_method,
        'anchor', case p.dating_method
                    when 'lmp' then p.lmp
                    when 'ultrasound' then p.edd
                    when 'ivf_transfer' then p.transfer_date
                  end,
        'fetuses', p.fetuses)
      from pregnancy p where p.household_id = f.household_id),
    'profile', (
      select jsonb_build_object(
        'firstborn', hp.firstborn, 'customs', hp.customs,
        'health_fund', hp.health_fund, 'has_supplementary', hp.has_supplementary,
        'rh_negative', hp.rh_negative, 'sex', hp.sex,
        'feeding_intent', hp.feeding_intent)
      from household_profile hp where hp.household_id = f.household_id),
    'decided', coalesce((
      select jsonb_agg(t.kb_item_id order by t.kb_item_id)
      from task_state t
      where t.household_id = f.household_id and t.state in ('done', 'skipped')), '[]'::jsonb)
  )
  from calendar_feed f
  where f.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and f.revoked_at is null
    and f.expires_at > now()
    and exists (
      select 1 from member m
      where m.household_id = f.household_id and m.user_id = f.created_by);
$$;

comment on function calendar_feed_inputs(text) is
  'The engine inputs for one live feed token, and no more: a per-feed salt, the dating method and its one date, the profile, and the ids of decided items. Null otherwise. The only function anon may call.';
