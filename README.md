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

**Roadmap step 5 of 17 is next.** There is a tested database schema, a validated
knowledge base, a working schedule engine, and — from step 2 — an app that
renders in Hebrew and English with the design system settled. There are **no
real screens yet**: onboarding and Today arrive at step 5.

| Step | What                                                | State                                                      |
| ---- | --------------------------------------------------- | ---------------------------------------------------------- |
| 0    | Monorepo, AI build system, CI                       | done                                                       |
| 1    | `household` · `member` · `invite` · RLS · pgTAP     | **schema done**; hosted project needs the Supabase account |
| 2    | i18n skeleton and design tokens                     | done                                                       |
| 3    | KB schema and pregnancy content                     | done — 21 items                                            |
| 4    | Schedule engine                                     | done                                                       |
| 5–8  | Onboarding, Today, reminders, safety centre, Things | blocked on accounts                                        |

206 tests: 30 pgTAP assertions against a real Postgres, 59 engine tests run
under a non-UTC timezone, 96 design-token, locale and date-format tests, and
the generator tests.

Full detail: [`docs/plans/roadmap.md`](docs/plans/roadmap.md) ·
[`docs/decisions.md`](docs/decisions.md)

---

## Quickstart

Five commands from a fresh clone to the app in a browser.

**1. Install Node 24 and enable pnpm.** The version is pinned in `.nvmrc`,
`engines` and CI, and `.npmrc` sets `engine-strict`, so Node 22 refuses to
install rather than failing later in a confusing way.

```bash
nvm install && nvm use
```

```bash
corepack enable
```

**2. Install the workspace.** This also points git at `.githooks`, so a commit
runs the quality gate first.

```bash
pnpm install
```

**3. Prove the clone is healthy.** The whole gate: privacy scan, lint,
typecheck, docs generation, formatting, tests, KB validation, dead-code
analysis. It is green on a fresh clone, and if it is not, stop here.

```bash
pnpm check
```

**4. Run the app.**

```bash
pnpm dev
```

Then open **http://localhost:3000/he** for Hebrew and **/en** for English. `/`
redirects to Hebrew.

**5. Start the database when you need it** — only for schema and RLS work;
steps 1–4 above do not need it. Docker must already be running.

```bash
pnpm db:start
```

<details>
<summary>If something does not work</summary>

| Symptom                                                     | Cause and fix                                                                                                                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Unsupported engine` on install                             | Node is not 24. `nvm use`, or install Node 24 LTS.                                                                                                                                     |
| `pnpm: command not found`                                   | `corepack enable`, then reopen the shell.                                                                                                                                              |
| A commit is refused                                         | The pre-commit hook ran `pnpm check` and it failed, or the gate regenerated a file you have not staged. Fix it, or `SKIP_CHECK=1 git commit` for a deliberate work-in-progress commit. |
| `core.hooksPath` is unset in an existing clone              | `pnpm install` had nothing to do, so `prepare` never ran. `pnpm hooks:install` once.                                                                                                   |
| `pnpm db:start` hangs or cannot pull images                 | Docker is not running, or the network blocks `public.ecr.aws`.                                                                                                                         |
| The app builds but a page 500s with "No intl context found" | A Client Component is using a message outside `NextIntlClientProvider`. The provider is in `app/[locale]/layout.tsx`.                                                                  |

</details>

### What you need

| Tool   | Version    | Why                                      |
| ------ | ---------- | ---------------------------------------- |
| Node   | **24 LTS** | `.nvmrc`; CI uses the same               |
| pnpm   | **12**     | via Corepack, pinned by `packageManager` |
| Docker | running    | only for the local Supabase stack        |
| Python | **3.13**   | only for the gov watcher                 |

### The database

Docker must be running first.

```bash
pnpm db:start     # local Postgres + Auth, migrations applied, seed loaded
```

```bash
pnpm db:test      # pgTAP: the RLS tests
```

```bash
pnpm db:types     # regenerate packages/db/types.ts from the schema
```

```bash
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

| Command                                  | Does                                                         |
| ---------------------------------------- | ------------------------------------------------------------ |
| `pnpm check`                             | Everything CI runs, in one go                                |
| `pnpm check:twice`                       | Runs the gate twice and proves the generators are idempotent |
| `pnpm check:private`                     | Refuses real names, real addresses and key material          |
| `pnpm lint` · `pnpm lint:fix`            | ESLint, flat config, zero warnings allowed                   |
| `pnpm typecheck`                         | `tsc --noEmit` in every workspace                            |
| `pnpm format` · `pnpm format:check`      | Prettier                                                     |
| `pnpm test` · `pnpm test:watch`          | Vitest                                                       |
| `pnpm kb:validate`                       | Validate every KB item: schema, locales, sources             |
| `pnpm docs:gen`                          | Regenerate the ER diagram, KB catalogue and i18n coverage    |
| `pnpm knip`                              | Dead code and unused dependencies                            |
| `pnpm db:start` · `db:stop` · `db:reset` | Local Supabase                                               |
| `pnpm db:new <name>`                     | New migration                                                |
| `pnpm db:test`                           | pgTAP RLS tests                                              |
| `pnpm dev`                               | Next.js against local Supabase                               |
| `pnpm e2e`                               | Playwright _(from step 5)_                                   |

**Always run the engine tests outside UTC too.** A date bug west of Greenwich is
the one this project cannot afford, and CI runs it this way:

```bash
TZ=America/Los_Angeles pnpm test
```

### The watcher

```bash
cd services/watcher && python -m venv .venv && . .venv/bin/activate && pip install -e '.[dev]'
```

```bash
ruff check . && ruff format --check . && pytest -q
```

---

## How the pieces fit

```text
apps/web           Next.js 16 PWA: app/[locale] routes, /mcp, /ics, the service layer
  messages/        he.json and en.json — every UI string, ICU, both locales
  i18n/            next-intl routing, per-request config, gendered messages
packages/engine    pure schedule engine: anchors, windows, rules. No framework.
packages/kb        guidance as YAML in git, its zod schema and validator
packages/db        migrations, pgTAP RLS tests, seed, generated types
packages/ui        design tokens (tokens.css), locale vocabulary, date formatting
services/watcher   Python gov watcher — proposes only, never applies
docs/              plan, architecture, decisions, ADRs, diagrams, learnings
.claude/           agents, skills, hooks and settings for Claude Code
```

**The shape in one paragraph.** Guidance lives in git as YAML and says what
should happen and when, as a day offset from an anchor rather than a date.
`packages/engine` is a pure function — guidance, plus a household's anchors,
plus today, gives a list of task instances with real dates — so the same
arithmetic runs in the UI, the API and the MCP server and cannot disagree with
itself. Household data lives in Postgres with row-level security on every
table, and only `apps/web/lib/services` touches it, always with the signed-in
user's token. The UI, the share pages, the MCP route and the AI coach all call
that one service layer, which is what makes RLS guard the AI exactly as it
guards a parent. Nothing scraped is ever applied automatically: the watcher
opens a pull request and a human merges it.

**Five rules hold the shape together.** Lint enforces the first two, a test the
third and fourth, CI the fifth:

1. **Only `apps/web/lib/services` talks to the database**, always with the
   signed-in user's JWT — never the service-role key.
2. **`packages/engine` and `packages/kb` import no framework and no database.**
3. **Only `packages/engine` computes dates** — ISO strings in UTC, never a
   `Date` with a time.
4. **Colour and spacing come from `packages/ui/src/tokens.css`**, and layout
   uses CSS logical properties, never `margin-left`.
5. **Every new household table ships with RLS and a pgTAP test in the same PR**,
   and every UI string ships in both locales.

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

## What to read

Start here, in this order. The first three are enough to understand the project;
the rest are reference you reach for when you touch that area.

**1. [`docs/plan.md`](docs/plan.md) — what Kenn is.** Who it is for, the product
shape, the safety centre, languages, sharing, MCP, the coach, Things, and the
security threat model. Product decisions only; it no longer carries a stack
table, a roadmap or a decision log, because each of those has one real home.

**2. [`docs/architecture.md`](docs/architecture.md) — how it is built.** The
stack with every version pinned and the reason it is that version, the
deployment, the sequence and domain diagrams, the database and RLS design, the
repository scaffold, the build and release gates, and the AI build system. The
ER diagram in it is generated from the migrations, so it cannot drift.

**3. [`docs/plans/roadmap.md`](docs/plans/roadmap.md) — what is done and what is
next.** Steps 0–17 in three releases, with gates A–C. `[x]` done, `[~]` partly
done with the remainder named on the step.

Then, as you need them:

| Document                                                                                                                           | Read it when                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/decisions.md`](docs/decisions.md)                                                                                           | You want the newest state: decided / open / next, one entry per session, newest first. The **Open** list of the top entry is the current set of blockers.                                                 |
| [`docs/adr/`](docs/adr/)                                                                                                           | You are about to change something and want to know why it is the way it is. Six so far, each short, each with the alternatives that were rejected. These are the only route by which a hard rule changes. |
| [`CLAUDE.md`](CLAUDE.md)                                                                                                           | You are working with Claude Code on this repository, or you want the twelve rules a pull request may not break.                                                                                           |
| [`docs/kb-authoring.md`](docs/kb-authoring.md)                                                                                     | You are writing or reviewing a piece of guidance.                                                                                                                                                         |
| [`docs/kb-catalog.md`](docs/kb-catalog.md)                                                                                         | Generated. Every KB item with its window, sources and review date — what a clinical reviewer reads.                                                                                                       |
| [`docs/i18n-coverage.md`](docs/i18n-coverage.md)                                                                                   | Generated. Every message key, which are gendered, which take placeholders.                                                                                                                                |
| [`docs/plans/recommended-lists.md`](docs/plans/recommended-lists.md) and [`things-csv-import.md`](docs/plans/things-csv-import.md) | You are working on Things (steps 8a and 8b): the catalogue and the safety veto, then the import contract.                                                                                                 |
| [`docs/learnings/`](docs/learnings/)                                                                                               | One file per session: what went wrong and what became a tool because of it. The newest is the most useful.                                                                                                |
| The `CLAUDE.md` in each package                                                                                                    | You are about to edit that package. Each carries the rules specific to it.                                                                                                                                |

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
