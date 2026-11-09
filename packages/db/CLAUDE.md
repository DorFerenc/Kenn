# packages/db — rules for Claude

Migrations, pgTAP tests, seed data and the generated types. The database is the
security boundary, so this package carries the strictest rules in the repo.

## Every household table, without exception

1. It carries `household_id`.
2. RLS is enabled, default deny.
3. It uses the one policy pattern below.
4. It ships with a pgTAP test in the **same PR**.

```sql
create function is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from member
    where household_id = h and user_id = auth.uid()
  );
$$;

alter table task_instance enable row level security;

create policy task_rw on task_instance
  for all
  using (is_member(household_id))
  with check (is_member(household_id));
```

The test signs in as a member of household A and asserts **zero rows** from
household B, for select, insert, update **and** delete. A new table without that
test fails CI. Use the `write-migration` skill; it does all four in order.

## Migrations

- One migration per change, named `<timestamp>_<verb>_<thing>.sql`. Create it with
  `pnpm db:new <name>`; never hand-name the timestamp.
- **Migrations apply before the new code deploys**, so every migration must be
  backward-compatible with the version still running: add a column now, drop it a
  release later. Never rename in one step — add, backfill, switch, drop.
- Changing the schema means regenerating types in the same commit:
  `pnpm db:types`. `types.ts` is generated; never edit it by hand.
- No data migration that cannot be re-run. Make them idempotent.

## Supabase CLI v3 — local by default

v3 changed the defaults, and the new ones match Kenn's threat model. Learn them:

- Database commands run against the **local** stack unless you pass `--remote`.
  One `--remote` replaces the old `--linked`, `--project-ref` and `--db-url`.
- Any command that changes a hosted project **asks first, defaulting to No**. In
  CI it fails with `HostedMutationConsentRequiredError` unless you pass `--yes`.
  Piping `y` no longer works.
- `config.toml` uses **`[local_smtp]`**. The old `[inbucket]` section is removed
  and makes `supabase start`, `stop`, `status` and the db commands fail.
- `pg-delta` is the default diff engine. For declarative schemas use
  `supabase db schema declarative sync`, not `db diff`.
- Flags and environment variables now override `config.toml`, including
  `[remotes.<name>]` blocks. Run `supabase config diff` before a first
  `config push`.

**Never run a `--remote` mutation from a build session.** Production migrations
run from CI on merge to `main`, which is the only thing holding the service-role
key. `.claude/settings.json` asks before any `--remote` command and denies
`db push --remote` and `db reset --remote` outright — treat that as a reminder,
not as protection.

## Seed data

`seed.sql` is loaded into local and every preview environment, and it is in git.
**Fake household only.** Never a real name, date or measurement.
