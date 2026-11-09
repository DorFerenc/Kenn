---
description: Create a database migration with its RLS policy, its pgTAP test and regenerated types — all four, in one change. Use for any schema change.
when_to_use: Any change to the database schema: a new table, column, index, policy or function. Never hand-write a migration file without this.
argument-hint: <short migration name, e.g. add_task_instance>
allowed-tools: Read, Glob, Grep, Edit, Write, Bash
---

# Write a migration

Four artefacts, one change, one PR. A migration without its test does not merge.

Read `packages/db/CLAUDE.md` first.

## 1. Create the file

```bash
pnpm db:new <name>
```

Never hand-name the timestamp. The name is a verb and a thing:
`add_task_instance`, `add_locale_to_member`.

## 2. Write the SQL

**Backward compatibility is not optional.** Migrations apply _before_ the new code
deploys, so the schema must work with the version still running:

- Add a column as nullable, or with a default. Never `not null` without a default
  on a populated table.
- Never rename or drop in the same release as the code change. The sequence is
  add → backfill → switch the code → drop a release later.
- Never drop a column still read by the deployed version.
- An index on a populated table goes up `concurrently`.

Every household table carries `household_id uuid not null references household(id)`.

## 3. RLS — in this same file

```sql
alter table <table> enable row level security;

create policy <table>_rw on <table>
  for all
  using (is_member(household_id))
  with check (is_member(household_id));
```

Both `using` and `with check`. `using` alone lets a member write a row into
another household.

For a table reachable through a parent (a `child` row, say), the policy checks
membership of the parent's household, not the child id from the request.

Any new `security definer` function sets `search_path = public`. Without it, the
function is a privilege-escalation path.

## 4. The pgTAP test — in this same change

`packages/db/supabase/tests/<table>.sql`. It signs in as a member of household A
and asserts **zero rows** from household B, for all four operations:

```sql
begin;
select plan(5);

-- fixtures: household A with a member, household B with a row
-- ... set up ...

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :user_a)::text, true);

select is_empty(
  'select 1 from <table> where household_id = ' || quote_literal(:household_b),
  'member of A cannot select household B rows'
);

select throws_ok(
  'insert into <table> (household_id, ...) values (' || quote_literal(:household_b) || ', ...)',
  '42501',
  null,
  'member of A cannot insert into household B'
);

-- the same for update and delete, plus one positive case:
-- a member of A *can* read their own household's rows.

select * from finish();
rollback;
```

The positive case matters: a policy that denies everything passes the first four
assertions and breaks the app.

Run it:

```bash
pnpm db:test
```

## 5. Regenerate types

```bash
pnpm db:types
```

`packages/db/types.ts` is generated. Never edit it. Commit it with the migration,
so the types can never describe a schema that is not deployed.

## 6. Supabase CLI v3

Every command above is local. v3 is local by default, which is what we want.

- Reaching the hosted project needs `--remote`; an unattended hosted change needs
  `--yes`.
- **Do not run a `--remote` mutation from a build session.** Production migrations
  run from CI on merge to `main`. `.claude/settings.json` denies
  `db push --remote` and `db reset --remote`, and asks before any other `--remote`
  command.
- `config.toml` uses `[local_smtp]`; `[inbucket]` was removed and breaks
  `supabase start`.

## 7. Before you call it done

- [ ] migration created with `pnpm db:new`
- [ ] backward-compatible with the deployed version
- [ ] `household_id` on every household table
- [ ] RLS enabled, policy with `using` **and** `with check`
- [ ] pgTAP test: 4 negative assertions + 1 positive, `pnpm db:test` green
- [ ] `pnpm db:types` run, `types.ts` committed
- [ ] ER diagram regenerated via `pnpm docs:gen`
- [ ] `docs/` touched — CI fails a migration PR that leaves docs alone
