---
description: Regenerate and update the docs a change falsified, tick the roadmap step and draft an ADR if a decision was made. Run at the end of every step.
when_to_use: End of every roadmap step, before /retro. Also when a change touched migrations, the MCP route or the KB schema and CI's drift check failed.
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Agent
---

# Update the docs

Generated docs are regenerated. Hand-written docs are edited. "Docs updated" is
part of done, not a follow-up.

## 1. Generate

```bash
pnpm docs:gen
```

It regenerates, as each exists: the ER diagram from the migrations, the KB catalog
from `packages/kb/content`, the MCP tool list from the tool registry, and the i18n
coverage report. **Never hand-edit a generated file** — fix the generator.

## 2. Delegate the edits

Run the `doc-keeper` agent. It reads the diff, decides which hand-written
documents the change falsified, and edits them. It writes under `docs/` only.

## 3. Check the usual suspects

| The change touched…  | so check…                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| a migration          | `docs/diagrams/er.mmd` (generated), `docs/architecture.md` § Database                          |
| the MCP route        | `docs/mcp-tools.md` (generated), `docs/plan.md` § MCP server, `docs/diagrams/sequence-mcp.mmd` |
| the KB schema        | `docs/kb-authoring.md`, `docs/plan.md` § Data model                                            |
| the engine           | `docs/architecture.md` § Domain model, `docs/diagrams/domain-model.mmd`                        |
| auth or sharing      | `docs/plan.md` § Security, § Sharing and roles, `docs/diagrams/sequence-auth.mmd`              |
| the task lifecycle   | `docs/diagrams/task-lifecycle.mmd`                                                             |
| the scaffold         | `docs/architecture.md` § Repository scaffold                                                   |
| a dependency version | `docs/architecture.md` § Technology stack, `CLAUDE.md` § Versions                              |

A diagram that no longer matches the code is worse than no diagram, because it is
believed. If you cannot make one true, delete it and say so.

## 4. Tick the step

`docs/plans/roadmap.md` — tick the step just finished, and nothing else.

## 5. ADR, if a decision was made

A decision is anything a future reader would otherwise ask "why on earth" about: a
version pinned against the obvious choice, a library rejected, a security
trade-off, a schema shape with a non-obvious reason.

`docs/adr/NNNN-<slug>.md`:

```markdown
# ADR-NNNN — <title>

- **Date:** YYYY-MM-DD
- **Status:** accepted
- **Supersedes / superseded by:** ADR-NNNN, or none

## Context

What was true that forced a choice. Evidence, with versions and dates.

## Decision

What was chosen, stated so it can be checked.

## Consequences

What this costs, and what has to change if it is ever reversed.

## Alternatives considered

Each one, and why not.
```

Hard rules (RLS, no invented medical content, no AI delete powers) are only ever
relaxed by an ADR the user accepts — never by a retro.

## 6. Conclude

Append to `docs/decisions.md`, newest first: **decided / open / next**.

## 7. Drift check

CI fails a PR that touches `packages/db/supabase/migrations/`,
`apps/web/app/api/mcp/` or `packages/kb/schema.ts` without touching `docs/`, and
fails if `pnpm docs:gen` produces anything different from what is committed. If
you are here because of that rule, find the document the change actually
falsified — do not add a sentence to satisfy the check.
