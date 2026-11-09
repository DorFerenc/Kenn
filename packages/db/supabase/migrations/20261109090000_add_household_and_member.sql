-- Household and member: the two tables every other household table hangs off.
--
-- The RLS pattern here is the one every later household table copies, so it is
-- worth reading once: is_member() is SECURITY DEFINER, which means it is not
-- itself subject to RLS on `member`. Without that, the policy on `member` would
-- call is_member(), which selects from `member`, which triggers the policy
-- again — infinite recursion. search_path is pinned so the function cannot be
-- hijacked by a schema earlier on someone else's path.
--
-- See packages/db/CLAUDE.md and docs/architecture.md, section "Database".

create table household (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  country text not null default 'IL' check (country ~ '^[A-Z]{2}$'),
  default_locale text not null default 'he' check (default_locale in ('he', 'en', 'ar', 'ru')),
  created_at timestamptz not null default now()
);

comment on table household is
  'One family. Every household table carries household_id and the same RLS policy.';

create table member (
  household_id uuid not null references household (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'family', 'caregiver')),
  locale text not null default 'he' check (locale in ('he', 'en', 'ar', 'ru')),
  gender_form text not null default 'neutral'
    check (gender_form in ('feminine', 'masculine', 'neutral')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

comment on column member.locale is
  'Per-user, not per-household: one parent can use Hebrew and the other English.';
comment on column member.gender_form is
  'Hebrew addresses the reader by gender. Asked once in onboarding.';

-- Look up membership without tripping over RLS on `member`.
create function is_member(h uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from member
    where household_id = h and user_id = auth.uid()
  );
$$;

comment on function is_member(uuid) is
  'The one RLS predicate. SECURITY DEFINER so the member policy cannot recurse.';

-- Creating a household is the one bootstrap hole: with `with check
-- (is_member(id))` nobody could ever insert the first row, because membership
-- does not exist yet. Rather than open an INSERT policy on `household` — which
-- would let any signed-in user create rows forever — there is no INSERT policy
-- at all, and this function does both inserts atomically as the owner.
create function create_household(p_name text, p_locale text default 'he')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'create_household requires an authenticated user'
      using errcode = '42501';
  end if;

  insert into household (name, default_locale)
  values (p_name, p_locale)
  returning id into new_id;

  insert into member (household_id, user_id, role, locale)
  values (new_id, uid, 'owner', p_locale);

  return new_id;
end;
$$;

comment on function create_household(text, text) is
  'Creates a household and makes the caller its owner, atomically. The only way a household row is born.';

revoke all on function create_household(text, text) from public;
grant execute on function create_household(text, text) to authenticated;

-- Row level security: default deny, then the one policy.
alter table household enable row level security;
alter table member enable row level security;

create policy household_rw on household
  for all
  using (is_member(id))
  with check (is_member(id));

create policy member_rw on member
  for all
  using (is_member(household_id))
  with check (is_member(household_id));

create index member_user_id_idx on member (user_id);
