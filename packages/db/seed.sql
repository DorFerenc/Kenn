-- Seed data for local development and Vercel preview deployments.
--
-- FAKE HOUSEHOLD ONLY. This file is committed to git and loaded into every
-- preview environment. Never a real name, date, measurement or email.
--
-- Loaded by `supabase db reset`. See packages/db/CLAUDE.md.

insert into auth.users (id, email, instance_id, aud, role, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-00000000da01', 'dev-one@kenn.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   '{"full_name":"Dev One"}'),
  ('00000000-0000-4000-8000-00000000da02', 'dev-two@kenn.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   '{"full_name":"Dev Two"}')
on conflict (id) do nothing;

insert into household (id, name, country, default_locale)
values ('00000000-0000-4000-8000-0000000d0001', 'Dev household', 'IL', 'he')
on conflict (id) do nothing;

-- One Hebrew reader and one English reader in the same household, which is the
-- case the UI must get right and the easiest one to forget to test.
insert into member (household_id, user_id, role, locale, gender_form)
values
  ('00000000-0000-4000-8000-0000000d0001', '00000000-0000-4000-8000-00000000da01',
   'owner', 'he', 'feminine'),
  ('00000000-0000-4000-8000-0000000d0001', '00000000-0000-4000-8000-00000000da02',
   'owner', 'en', 'masculine')
on conflict (household_id, user_id) do nothing;

-- A pregnancy for the fake household, so `pnpm dev` has a Today screen without
-- anyone having to run the wizard first.
--
-- The LMP is a PLACEHOLDER and deliberately a round, obviously-invented date.
-- The real anchor — the ultrasound-corrected EDD — is household health data and
-- is collected by onboarding, never committed here. Because the date is fixed
-- while today is not, the gestational age this produces drifts: that is fine for
-- browsing and is why the Playwright suite onboards its own household with an
-- LMP computed from the day the test runs, rather than asserting against this.
insert into pregnancy (household_id, dating_method, lmp, edd, fetuses)
values ('00000000-0000-4000-8000-0000000d0001', 'lmp', '2026-06-01', '2027-03-08', 1)
on conflict (household_id) do nothing;

insert into household_profile (household_id, firstborn, customs, health_fund, has_supplementary)
values ('00000000-0000-4000-8000-0000000d0001', true, 'jewish', 'clalit', true)
on conflict (household_id) do nothing;
