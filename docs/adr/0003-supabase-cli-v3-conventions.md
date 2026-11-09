# ADR-0003 — Adopt Supabase CLI v3 and its local-by-default conventions

- **Date:** 2026-11-07
- **Status:** accepted
- **Supersedes / superseded by:** none

## Context

Supabase CLI **v3.0.0** was released on 2026-11-02, five days before this
scaffold. Every install channel — npm, Homebrew, Scoop, the Linux packages and
`supabase/setup-cli` — now installs it by default, so an unpinned CI job already
runs v3.

What changed, from the migration guide and changelog:

- **Database commands target the local stack by default.** `db push`, `db pull`,
  `db dump`, `migration fetch/list/repair`, `inspect db *`, `gen types` and the
  storage commands all run locally unless given `--remote`. One `--remote` flag
  replaces `--linked`, `--project-ref` and `--db-url`, which are deprecated.
- **Every hosted mutation asks first, defaulting to No.** Where the CLI cannot
  ask, as in CI, the command fails with `HostedMutationConsentRequiredError`
  unless given `--yes`. Piping `y` no longer works.
- **`[inbucket]` is removed** from `config.toml`, replaced by `[local_smtp]`. A
  config still carrying it makes `supabase start`, `stop`, `status` and the db
  commands fail.
- **`pg-delta` is the default schema diff engine**, so the SQL that `db diff` and
  `db pull` generate can differ. Declarative schemas use
  `supabase db schema declarative sync` instead of `db diff`.
- Flags and environment variables now override `config.toml`, including
  `[remotes.<name>]` blocks.

Some projects are pinning `v2.stable` (2.122.1) to upgrade on their own schedule,
usually because an existing `config.toml` or CI pipeline breaks.

Kenn has neither. At step 0 there are no migrations, no `config.toml` and no
deploy workflow, so the migration cost is zero and will only grow.

## Decision

Pin **`supabase@3.0.0`** as a devDependency of `packages/db`, and write the v3
conventions into `packages/db/CLAUDE.md` and the `write-migration` skill now:

- Local is the default. Reaching the hosted project is always an explicit
  `--remote`.
- CI passes `--remote --yes` on the deploy path, and nowhere else.
- `config.toml` uses `[local_smtp]` from the first line it is written.
- Declarative schema work uses `supabase db schema declarative sync`.
- `.claude/settings.json` **denies** `supabase db push --remote *` and
  `supabase db reset --remote *` and **asks** before any other `--remote`
  command.

The v3 defaults align with a rule the project already had: only the watcher and
CI hold the service-role key, and a build session must not be able to touch
production. Under v2, a `db push` with a stale `--linked` could reach the hosted
project; under v3 a bare `db push` cannot, and an unattended one cannot without
`--yes`. This is a security improvement, not just a version bump.

## Consequences

- Anyone who learned the v2 flags has to relearn four of them. The `write-migration`
  skill and `packages/db/CLAUDE.md` carry the mapping, so it is written down
  rather than remembered.
- When `deploy.yml` is written at step 1 it must use `--remote --yes`, or the job
  will hang and then fail. Noted on step 1 in the roadmap.
- `supabase/setup-cli` in CI will be pinned by the lockfile rather than by a
  `version:` input, since `packages/db` declares the dependency.
- The `pg-delta` diff output may differ from anything written against v2 examples.
  No existing migrations to re-check, which is the point of doing this now.

## Alternatives considered

- **Pin `v2.stable` (2.122.1) and defer.** Rejected: it buys nothing — there is no
  existing config or pipeline to protect — and the migration only gets more
  expensive once migrations and a deploy workflow exist. v2 also receives no new
  features.
- **Leave the CLI unpinned.** Rejected outright. An unpinned CLI is how a pipeline
  silently changes which database it writes to.
- **Install the CLI outside the workspace** (Homebrew or the setup-cli action
  only). Rejected: the version would then live in two places and could disagree
  between a laptop and CI.
