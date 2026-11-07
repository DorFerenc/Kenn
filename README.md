# Kenn (קֵן)

A Hebrew and English PWA that plans pregnancy, birth and the first year for
Israeli families. Two parents, one household, one checklist, dated from their own
anchors — with a reminder before every window closes.

> "The right thing, at the right time."

Private project. Not open for sign-up, and not a medical device. Every piece of
guidance cites its source and carries a review date; nothing in it replaces a
doctor or a Tipat Halav nurse.

## Status

**Roadmap step 0 of 17 — bootstrap.** The monorepo skeleton, the AI build system
and CI exist. There is no application yet. See
[`docs/plans/roadmap.md`](docs/plans/roadmap.md).

## Documentation

| Document                                         | What it covers                                                                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/plan.md`](docs/plan.md)                   | Product and architecture: users, modules, safety centre, security, sharing, MCP, coach, gov updates, UX                                 |
| [`docs/architecture.md`](docs/architecture.md)   | Stack with pinned versions, deployment, sequence and class diagrams, database and RLS, scaffold, build and release, the AI build system |
| [`docs/plans/roadmap.md`](docs/plans/roadmap.md) | Steps 0–17 and gates A–C                                                                                                                |
| [`docs/decisions.md`](docs/decisions.md)         | One conclusion per session: decided / open / next                                                                                       |
| [`docs/adr/`](docs/adr/)                         | One file per architecture decision, with the alternatives                                                                               |
| [`docs/kb-authoring.md`](docs/kb-authoring.md)   | How to write and review a guidance item                                                                                                 |
| [`CLAUDE.md`](CLAUDE.md)                         | How Claude Code builds this repo, and the rules it may not break                                                                        |

## Layout

```text
apps/web           Next.js PWA: routes, server actions, /mcp, /ics, the service layer
packages/engine    pure schedule engine: anchors, windows, rules
packages/kb        guidance as YAML in git, its schema and validator
packages/db        migrations, pgTAP RLS tests, seed, generated types
packages/ui        design tokens, components, RTL helpers
services/watcher   Python gov watcher — proposes only, never applies
docs/              plan, architecture, decisions, ADRs, diagrams, learnings
.claude/           agents, skills, hooks and settings for Claude Code
```

Two rules hold the shape together: **only `apps/web/lib/services` talks to the
database**, and **only `packages/engine` computes dates**.

## Getting started

Requires **Node 24 LTS**, **pnpm 12** (via corepack, from the `packageManager`
field), **Docker** for the local Supabase stack, and **Python 3.13** for the
watcher.

```bash
corepack enable
pnpm install
pnpm check
```

`pnpm check` runs everything CI runs: lint, typecheck, format, tests, KB
validation, docs drift and dead-code analysis. It is green on this skeleton.

| Command                     | Does                                              |
| --------------------------- | ------------------------------------------------- |
| `pnpm dev`                  | Next.js on localhost against local Supabase       |
| `pnpm db:start` / `db:stop` | Local Supabase in Docker                          |
| `pnpm db:new <name>`        | New empty migration                               |
| `pnpm db:types`             | Regenerate `packages/db/types.ts` from the schema |
| `pnpm db:test`              | pgTAP RLS tests                                   |
| `pnpm test`                 | Vitest                                            |
| `pnpm e2e`                  | Playwright (arrives at step 5)                    |
| `pnpm kb:validate`          | Validate every KB item                            |
| `pnpm docs:gen`             | Regenerate and verify the generated docs          |
| `pnpm check`                | All of the above that CI runs                     |

## Data and privacy

Household data lives in Supabase (Frankfurt) behind row-level security on every
table, with MFA required. Guidance lives in git, versioned, and changes only
through a pull request a human merged. The AI can read and propose; it cannot
delete, share or send anything. ID numbers, bank details and health-fund member
numbers are never stored.

See [`docs/plan.md`](docs/plan.md), section "Security".
