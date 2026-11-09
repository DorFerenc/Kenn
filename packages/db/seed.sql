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
