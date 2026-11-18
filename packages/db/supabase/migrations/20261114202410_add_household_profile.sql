-- The answers onboarding collects that are not dates: one row per household.
--
-- Every column is nullable on purpose. `appliesTo()` in @kenn/engine treats a
-- condition the profile cannot answer as NOT matching, because showing an
-- anti-D item to someone whose Rh is unknown trains them to ignore the list
-- (decided at step 4). A default would be a guess wearing an answer's clothes,
-- so "not asked yet" is null and stays null.
--
-- This table is also where roadmap step 8a adds its Things hints (baby room,
-- car, lift, budget). It carries the pregnancy-phase answers only.

create table household_profile (
  household_id uuid primary key references household (id) on delete cascade,
  firstborn boolean,
  customs text check (customs in ('jewish', 'muslim', 'christian', 'druze', 'none')),
  health_fund text check (health_fund in ('clalit', 'maccabi', 'meuhedet', 'leumit')),
  has_supplementary boolean,
  rh_negative boolean,
  sex text check (sex in ('male', 'female')),
  feeding_intent text
    check (feeding_intent in ('breast', 'formula', 'mixed', 'undecided')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table household_profile is
  'The applies_if answers for one household. Null means "not asked", which never matches a condition.';
comment on column household_profile.sex is
  'Fetal sex, where the family knows it and wants it used. Only pidyon haben needs it.';

alter table household_profile enable row level security;

create policy household_profile_rw on household_profile
  for all
  using (is_member(household_id))
  with check (is_member(household_id));
