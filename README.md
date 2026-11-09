# Kenn (קֵן)

A Hebrew and English PWA that plans pregnancy, birth and the first year for
Israeli families. Two parents, one household, one checklist, dated from their own
anchors — with a reminder before every window closes.

> "The right thing, at the right time."

Private project. **Not a medical device.** Every piece of guidance cites its
source and carries a review date, and nothing in it replaces a doctor or a Tipat
Halav nurse.

---

## Status

**Roadmap step 4 of 17.** There is a tested database schema, a validated
knowledge base and a working schedule engine. **There is no application yet** —
`apps/web` is still a placeholder.

| Step | What                                                | State                                                      |
| ---- | --------------------------------------------------- | ---------------------------------------------------------- |
| 0    | Monorepo, AI build system, CI                       | done                                                       |
| 1    | `household` · `member` · `invite` · RLS · pgTAP     | **schema done**; hosted project needs the Supabase account |
| 2    | i18n skeleton and design tokens                     | next — needs nothing external                              |
| 3    | KB schema and pregnancy content                     | done — 21 items                                            |
| 4    | Schedule engine                                     | done                                                       |
| 5–8  | Onboarding, Today, reminders, safety centre, Things | blocked on accounts                                        |

88 tests: 30 pgTAP assertions against a real Postgres, 59 engine tests run under
a non-UTC timezone, plus schema and generator tests.

Full detail: [`docs/plans/roadmap.md`](docs/plans/roadmap.md) ·
[`docs/decisions.md`](docs/decisions.md)

---

## Running it

### What you need

| Tool   | Version    | Why                                       |
| ------ | ---------- | ----------------------------------------- |
| Node   | **24 LTS** | `.nvmrc`; CI uses the same                |
| pnpm   | **12**     | via Corepack, pinned by `packageManager`  |
| Docker | running    | the local Supabase stack (Postgres, Auth) |
| Python | **3.13**   | the gov watcher only                      |

### First run

```bash
corepack enable
pnpm install
```

`pnpm install` also points git at `.githooks`, so a commit runs the gate first.

```bash
pnpm check
```

That is the whole quality gate and it should be green on a fresh clone: privacy
scan, lint, typecheck, docs generation, formatting, tests, KB validation and
dead-code analysis.

### The database

Docker must be running first.

```bash
pnpm db:start     # local Postgres + Auth, migrations applied, seed loaded
pnpm db:test      # pgTAP: the RLS tests
pnpm db:types     # regenerate packages/db/types.ts from the schema
pnpm db:stop
```

`pnpm db:start` prints local URLs and keys. They are the Supabase CLI's
well-known development defaults, not secrets — but they belong to the local
stack only, and nothing in this repository connects to a hosted project.

**Supabase CLI v3 is local by default.** Reaching a hosted project needs an
explicit `--remote`, and an unattended hosted change needs `--yes`. A bare
`db push` cannot touch production. See
[ADR-0003](docs/adr/0003-supabase-cli-v3-conventions.md).

### Every command

| Command                                  | Does                                                                |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `pnpm check`                             | Everything CI runs, in one go                                       |
| `pnpm check:twice`                       | Runs the gate twice and proves the generators are idempotent        |
| `pnpm check:private`                     | Refuses real names, real email addresses and key material           |
| `pnpm lint` · `pnpm lint:fix`            | ESLint, flat config, zero warnings allowed                          |
| `pnpm typecheck`                         | `tsc --noEmit` in every workspace                                   |
| `pnpm format` · `pnpm format:check`      | Prettier                                                            |
| `pnpm test` · `pnpm test:watch`          | Vitest                                                              |
| `pnpm kb:validate`                       | Validate every KB item: schema, locales, sources                    |
| `pnpm docs:gen`                          | Regenerate the ER diagram and KB catalogue, and verify the diagrams |
| `pnpm knip`                              | Dead code and unused dependencies                                   |
| `pnpm db:start` · `db:stop` · `db:reset` | Local Supabase                                                      |
| `pnpm db:new <name>`                     | New migration                                                       |
| `pnpm db:test`                           | pgTAP RLS tests                                                     |
| `pnpm dev`                               | Next.js against local Supabase _(from step 5)_                      |
| `pnpm e2e`                               | Playwright _(from step 5)_                                          |

**Always run the engine tests outside UTC too.** A date bug west of Greenwich is
the one this project cannot afford, and CI runs it this way:

```bash
TZ=America/Los_Angeles pnpm test
```

### The watcher

```bash
cd services/watcher
python -m venv .venv && . .venv/bin/activate
pip install -e '.[dev]'
ruff check . && ruff format --check . && pytest -q
```

---

## How the pieces fit

```text
apps/web           Next.js PWA: routes, server actions, /mcp, /ics, the service layer
packages/engine    pure schedule engine: anchors, windows, rules
packages/kb        guidance as YAML in git, its zod schema and validator
packages/db        migrations, pgTAP RLS tests, seed, generated types
packages/ui        design tokens, components, RTL helpers
services/watcher   Python gov watcher — proposes only, never applies
docs/              plan, architecture, decisions, ADRs, diagrams, learnings
.claude/           agents, skills, hooks and settings for Claude Code
```

Four rules hold the shape together, and lint enforces the first two:

1. **Only `apps/web/lib/services` talks to the database**, always with the
   signed-in user's JWT.
2. **`packages/engine` and `packages/kb` import no framework and no database.**
3. **Only `packages/engine` computes dates** — ISO strings in UTC, never a
   `Date` with a time.
4. **Every new household table ships with RLS and a pgTAP test in the same PR.**

---

## Contributing

`main` is protected: changes arrive by pull request with all three CI jobs green.
Zero approvals are required for now, so whoever opens a PR can merge it.

```bash
git switch -c my-change
# ... work ...
pnpm check
git commit        # the pre-commit hook runs the gate; SKIP_CHECK=1 to bypass
```

A session with Claude Code follows the loop in [`CLAUDE.md`](CLAUDE.md): one
roadmap step, plan first, wait for approval, build, test, review, update docs,
retro. The repository carries its own agents and skills under `.claude/`.

**Setting up branch protection** (once, from your own machine — a cloud session
cannot reach the GitHub administration API):

```bash
./scripts/setup-branch-protection.sh
```

---

## Documentation

| Document                                                             | What it covers                                                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/plan.md`](docs/plan.md)                                       | Product and architecture: users, modules, safety centre, security, sharing, MCP, coach, gov updates, UX                               |
| [`docs/architecture.md`](docs/architecture.md)                       | Stack with pinned versions, deployment, sequence and class diagrams, database and RLS, scaffold, build and release, branch protection |
| [`docs/plans/roadmap.md`](docs/plans/roadmap.md)                     | Steps 0–17 and gates A–C                                                                                                              |
| [`docs/decisions.md`](docs/decisions.md)                             | One conclusion per session: decided / open / next                                                                                     |
| [`docs/adr/`](docs/adr/)                                             | One file per architecture decision, with the alternatives                                                                             |
| [`docs/kb-catalog.md`](docs/kb-catalog.md)                           | Generated: every KB item, window, source and review date                                                                              |
| [`docs/kb-authoring.md`](docs/kb-authoring.md)                       | How to write and review a guidance item                                                                                               |
| [`docs/plans/recommended-lists.md`](docs/plans/recommended-lists.md) | The Things catalogue and the safety veto                                                                                              |
| [`CLAUDE.md`](CLAUDE.md)                                             | How Claude Code builds this repo, and the rules it may not break                                                                      |

---

## Privacy and security

- **Household data lives in Postgres behind row-level security on every table**,
  in Frankfurt, with MFA required. Never in git.
- **`seed.sql` is a fake household only.** It loads into every preview
  environment.
- **Guidance lives in git**, versioned, and changes only through a pull request a
  human merged. Nothing scraped is auto-applied.
- **The AI can read and propose; it cannot delete, share or send.** There is no
  delete tool — "remove" archives, and the UI offers undo for 7 days. Every AI
  write is audited with the client name.
- **Safety vetoes popularity.** A Things item marked `unsafe` needs a named
  authority and a source, and no popularity signal can raise it
  ([ADR-0005](docs/adr/0005-recommendation-catalogue-in-kb-with-safety-veto.md)).
- **No ID numbers (תעודת זהות), bank details or health-fund member numbers**, ever.
- `pnpm check:private` keeps real names, real addresses and key material out of
  the repository, and runs in CI.

Before anyone outside the family uses Kenn: clinical review of the KB by a
pediatrician and a midwife, a privacy policy and legal review, per-household
encryption, Arabic, and an external security review. See Gate C in the roadmap.
