-- One household per person, for v1 — enforced, not assumed.
--
-- `apps/web` stated this invariant in a comment and nothing held it up:
-- `member`'s key is `(household_id, user_id)`, so a second membership was
-- always allowed, and `accept_invite()` added one happily. The review of
-- step 5a drove it in a browser: a parent who onboarded their own household
-- and then accepted a partner's invite saw the partner's pregnancy on Today,
-- their own record unreachable from any screen, and three members listed in a
-- two-person household. Not an RLS hole — that parent is a legitimate member
-- of both — but health data of one family on another family's screen.
--
-- The app is now scoped by an explicit household id, which is the half that
-- stays correct when step 15 adds a second household on purpose. This is the
-- other half: until there is a household switcher, joining a second household
-- is refused where it is attempted, in SQL.
--
-- Deliberately NOT a unique index on member(user_id): step 15 gives a
-- grandparent or a caregiver a role in more than one household, and a unique
-- index would have to be dropped against live data to allow it. A check inside
-- the one function that adds a membership is the same guarantee today and a
-- one-line change then.

create or replace function accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  inv invite;
begin
  if uid is null then
    raise exception 'accept_invite requires an authenticated user'
      using errcode = '42501';
  end if;

  select * into inv
  from invite
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if inv.id is null then
    raise exception 'invite not found' using errcode = '42501';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invite already accepted' using errcode = '42501';
  end if;
  if inv.revoked_at is not null then
    raise exception 'invite revoked' using errcode = '42501';
  end if;
  if inv.expires_at <= now() then
    raise exception 'invite expired' using errcode = '42501';
  end if;

  -- The new check, with a distinct errcode so the join page can tell it apart
  -- from a bad token: the reader needs "you already have a household", which is
  -- a fact about them, not "this link is not valid", which is a fact about
  -- someone else's household.
  if exists (
    select 1 from member
    where user_id = uid and household_id <> inv.household_id
  ) then
    raise exception 'already a member of another household'
      using errcode = '23505';
  end if;

  insert into member (household_id, user_id, role)
  values (inv.household_id, uid, inv.role)
  on conflict (household_id, user_id) do nothing;

  update invite set accepted_at = now() where id = inv.id;

  return inv.household_id;
end;
$$;

comment on function accept_invite(text) is
  'Redeems a raw invite token. Checks expiry, revocation, reuse and one-household-per-person in the database, not in the app.';
