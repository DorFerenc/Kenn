-- Inviting your partner. The second half of what makes v1 useful: two people,
-- one household, one checklist.
--
-- The invite link carries a random token. Only its SHA-256 hash is stored, so a
-- leaked database row cannot be turned back into a working link, and the token
-- itself exists only in the email. Same rule as share_grant and the calendar
-- feed later: secret URLs are stored hashed, expire, and can be revoked.

create extension if not exists pgcrypto with schema extensions;

create table invite (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  role text not null default 'owner' check (role in ('owner', 'family', 'caregiver')),
  invited_by uuid not null references auth.users (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table invite is
  'Pending household invitations. Only the token hash is stored; the token lives in the email.';
comment on column invite.token_hash is
  'SHA-256 of the invite token, hex. A leaked row cannot be turned into a link.';

create index invite_household_idx on invite (household_id);

alter table invite enable row level security;

-- Members manage their own household's invites. The invitee is deliberately
-- NOT covered: they are not a member yet, so they cannot read the row at all.
-- Acceptance goes through accept_invite() instead.
create policy invite_rw on invite
  for all
  using (is_member(household_id))
  with check (is_member(household_id));

-- Accepting an invite. SECURITY DEFINER because the caller is by definition not
-- yet a member and so cannot see the invite row under RLS.
--
-- Takes the raw token, never the id: the caller proves they hold the secret.
-- Expiry, revocation and prior acceptance are all checked here rather than in
-- the service layer, so a bug in the app cannot widen the window.
create function accept_invite(p_token text)
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

  insert into member (household_id, user_id, role)
  values (inv.household_id, uid, inv.role)
  on conflict (household_id, user_id) do nothing;

  update invite set accepted_at = now() where id = inv.id;

  return inv.household_id;
end;
$$;

comment on function accept_invite(text) is
  'Redeems a raw invite token. Checks expiry, revocation and reuse in the database, not in the app.';

revoke all on function accept_invite(text) from public;
grant execute on function accept_invite(text) to authenticated;
