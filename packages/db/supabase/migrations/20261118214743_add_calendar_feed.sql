-- The private calendar feed (roadmap step 6a, ADR-0009).
--
-- A parent subscribes Google or Apple Calendar to a secret URL, and every
-- window appears there. The calendar's servers fetch that URL with no session,
-- so this is the first read in Kenn made without a signed-in user. It is shaped
-- so that the database, not the app, holds every rule:
--
--   * The token is generated here and only its SHA-256 hash is stored, as for
--     invites. A leaked row cannot be turned back into a working link.
--   * **Nobody writes this table directly.** No insert, update or delete
--     privilege for `authenticated` or `anon`; three SECURITY DEFINER functions
--     do everything, and each writes its `audit_log` row in the same
--     transaction as the change. That is the shape ADR-0008 prescribes for
--     every household write at step 9, applied to a new table from birth
--     rather than retrofitted.
--   * A member can see that a feed exists, when it was made and whether it is
--     revoked — never its hash.
--   * `calendar_feed_inputs()` is the one thing `anon` may call. It takes the
--     raw token, and returns one household's anchors, profile and decisions:
--     exactly what the engine needs to derive the windows, and nothing else.

create table calendar_feed (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- The language the event titles are written in: the creator's, at creation.
  locale text not null check (locale in ('he', 'en')),
  created_at timestamptz not null default now(),
  -- plan.md: secret URLs expire and rotate in one tap. A year, shown in the UI,
  -- so a forgotten subscription does not leak forever.
  expires_at timestamptz not null default now() + interval '365 days',
  revoked_at timestamptz
);

comment on table calendar_feed is
  'Private ICS links. Token hash only; written exclusively through SECURITY DEFINER functions that audit in the same transaction.';
comment on column calendar_feed.token_hash is
  'SHA-256 of the feed token, hex. Not selectable by members; a leaked row cannot be turned into a link.';

create index calendar_feed_household_idx on calendar_feed (household_id);

alter table calendar_feed enable row level security;

-- Read: members, of their own household, and not the hash.
create policy calendar_feed_select on calendar_feed
  for select using (is_member(household_id));

revoke all on calendar_feed from authenticated, anon;
grant select (id, household_id, created_by, locale, created_at, expires_at, revoked_at)
  on calendar_feed to authenticated;

-- Writes: none, twice over. The revoke above is the first wall. These
-- restrictive policies are the second, so a later `grant all` — the most
-- common way a privilege comes back — still cannot open a direct write path
-- around the auditing functions below. A restrictive policy is ANDed with
-- every permissive one, so `false` here wins whatever is added later.
create policy calendar_feed_no_direct_insert on calendar_feed
  as restrictive for insert with check (false);

create policy calendar_feed_no_direct_update on calendar_feed
  as restrictive for update using (false) with check (false);

create policy calendar_feed_no_direct_delete on calendar_feed
  as restrictive for delete using (false);

-- ------------------------------------------------------------------ create
-- Rotates: the caller's previous live feed in this household is revoked in the
-- same transaction, so "make a new link" is also "kill the old one".
create function create_calendar_feed(p_household uuid, p_locale text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  raw text := encode(extensions.gen_random_bytes(32), 'hex');
  feed_id uuid;
  rotated uuid[];
begin
  if uid is null or not is_member(p_household) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;
  if p_locale not in ('he', 'en') then
    raise exception 'unsupported locale' using errcode = '22023';
  end if;

  with r as (
    update calendar_feed set revoked_at = now()
    where household_id = p_household and created_by = uid and revoked_at is null
    returning id
  ) select coalesce(array_agg(id), '{}') into rotated from r;

  insert into calendar_feed (household_id, created_by, token_hash, locale)
  values (p_household, uid, encode(extensions.digest(raw, 'sha256'), 'hex'), p_locale)
  returning id into feed_id;

  -- The locale and what was rotated, never the token: an audit row is readable
  -- by the household, and a token in it would be a second copy of the secret.
  insert into audit_log (household_id, actor_kind, actor_user_id, action, entity,
                         entity_id, after)
  values (p_household, 'user', uid, 'calendar_feed.create', 'calendar_feed',
          feed_id::text,
          jsonb_build_object('locale', p_locale, 'rotated', to_jsonb(rotated)));

  return raw;
end;
$$;

comment on function create_calendar_feed(uuid, text) is
  'Mints a calendar feed token, stores its hash, revokes the caller''s previous feed, and audits — one transaction. Returns the raw token once.';

-- ------------------------------------------------------------------ revoke
create function revoke_calendar_feed(p_feed uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hh uuid;
begin
  select household_id into hh from calendar_feed where id = p_feed for update;

  -- One error for "no such feed" and "not yours", so the id space cannot be
  -- probed for other households' feeds.
  if uid is null or hh is null or not is_member(hh) then
    raise exception 'feed not found' using errcode = '42501';
  end if;

  update calendar_feed set revoked_at = now()
  where id = p_feed and revoked_at is null;

  if found then
    insert into audit_log (household_id, actor_kind, actor_user_id, action, entity,
                           entity_id)
    values (hh, 'user', uid, 'calendar_feed.revoke', 'calendar_feed', p_feed::text);
  end if;
end;
$$;

comment on function revoke_calendar_feed(uuid) is
  'Revokes a calendar feed of the caller''s household and audits it in the same transaction. Idempotent.';

-- ------------------------------------------------------------------ read
-- The whole of what an anonymous caller holding a live token may learn. Null
-- for an unknown, revoked or expired token alike, so the response cannot tell
-- an attacker which of the three they hit.
create function calendar_feed_inputs(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'household_id', f.household_id,
    'locale', f.locale,
    'pregnancy', (
      select jsonb_build_object(
        'dating_method', p.dating_method, 'lmp', p.lmp, 'edd', p.edd,
        'transfer_date', p.transfer_date, 'fetuses', p.fetuses)
      from pregnancy p where p.household_id = f.household_id),
    'profile', (
      select jsonb_build_object(
        'firstborn', hp.firstborn, 'customs', hp.customs,
        'health_fund', hp.health_fund, 'has_supplementary', hp.has_supplementary,
        'rh_negative', hp.rh_negative, 'sex', hp.sex,
        'feeding_intent', hp.feeding_intent)
      from household_profile hp where hp.household_id = f.household_id),
    'decisions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kb_item_id', t.kb_item_id, 'kb_version', t.kb_version, 'state', t.state))
      from task_state t where t.household_id = f.household_id), '[]'::jsonb)
  )
  from calendar_feed f
  where f.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and f.revoked_at is null
    and f.expires_at > now();
$$;

comment on function calendar_feed_inputs(text) is
  'Everything the engine needs to derive one household''s windows, for a live feed token. Null otherwise. The only function anon may call.';

revoke all on function create_calendar_feed(uuid, text) from public;
revoke all on function revoke_calendar_feed(uuid) from public;
revoke all on function calendar_feed_inputs(text) from public;
grant execute on function create_calendar_feed(uuid, text) to authenticated;
grant execute on function revoke_calendar_feed(uuid) to authenticated;
grant execute on function calendar_feed_inputs(text) to anon, authenticated;
