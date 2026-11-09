---
description: Build the next unticked roadmap step — exactly one. Propose a plan, wait for approval, build, test, review, update docs, retro. Use when asked to do step N, to continue the roadmap, or to build the next thing.
when_to_use: The user asks to implement, build or do a roadmap step, or says "next session" / "continue the roadmap". This is the default skill for a Kenn build session.
argument-hint: <step number, or nothing for the next unticked step>
---

# Implement one roadmap step

One step per session. The loop below is the whole job: each phase has a gate, and
you do not pass a gate by deciding it is fine.

## Phase 1 — Read

Before proposing anything:

- `CLAUDE.md`, and the `CLAUDE.md` of every package the step will touch
- `docs/plans/roadmap.md` — identify **the next unticked step**. If the user named
  a number, confirm earlier steps are ticked; if they are not, say so and ask.
- `docs/decisions.md` — what is already decided, and what was deferred to here
- `docs/adr/` — decisions that constrain the approach
- the newest file in `docs/learnings/` — what went wrong last time
- `docs/plans/<feature>.md` if the step came from a plan

## Phase 2 — Propose, then stop

Write the plan into the conversation. Not into a file, not into code:

1. **The step**, restated in one sentence, and which roadmap item it is.
2. **Acceptance criteria** as a checklist a reviewer can tick without asking you
   a question.
3. **Files** you will add or change, with one line each.
4. **Database changes**, if any: the migration, its RLS policy, its pgTAP test.
5. **New dependencies**, with the exact version and why — and whether the type and
   lint toolchain supports it (see ADR-0002; "latest" is not the rule here).
6. **Tests** that will exist at the end, and what each one would catch.
7. **Risks**, and what you will do first to find out if one is real.
8. **What you are not doing**, including anything in the step you think should be
   split out.

Then **stop and wait**. Do not write code in the same turn as the proposal. If the
user's answer changes the shape, re-propose rather than improvising.

If something in the step looks wrong — a decision that contradicts an ADR, a
timing that contradicts the research blueprint, a step that cannot be done without
a credential nobody has — say so **here**, with the evidence, before building.

## Phase 3 — Build

Smallest working thing first, then widen. Keep the hard rules from `CLAUDE.md` in
front of you; the ones broken most often:

- a query outside `apps/web/lib/services`
- a new household table without RLS and a pgTAP test in the same change
- a date computed outside `packages/engine`
- a UI string added in one locale
- `margin-left` instead of `margin-inline-start`
- guidance content written without a source URL

Use `write-migration` for any schema change and `add-kb-item` for any guidance
content. They exist so the checklist is not re-remembered each time.

Commit as you go, in logical pieces. One commit that says "step 5" is not
reviewable.

## Phase 4 — Test

```
pnpm check
```

That is lint, typecheck, format, Vitest, `kb:validate` and knip. Plus, when they
apply to the step:

- `pnpm db:test` — pgTAP, for any schema change
- `pnpm e2e` — Playwright, for any user-visible flow
- `TZ=America/Los_Angeles pnpm test` — **always**, for any change in
  `packages/engine`. The engine is the one place a timezone bug hides.

A failing test is the result. Report it with its output; never describe a step as
done with a red check.

## Phase 5 — Review

Run the `reviewer` agent on the diff. Run `security-reviewer` as well if the diff
touches `packages/db/`, `apps/web/app/api/`, `apps/web/lib/services/` or
`apps/web/lib/coach/`.

Then either fix the finding, or record it in the step's conclusion as accepted
with a reason. Critical and High findings are not accepted — they are fixed.

## Phase 6 — Document

Run `/update-docs`. It regenerates what is generated, updates the diagrams the
diff falsified, ticks the roadmap step and drafts an ADR if the step made a
decision.

## Phase 7 — Retro

Run `/retro`. It writes `docs/learnings/<date>-step-<n>-<topic>.md` and proposes
rule changes in a **separate** `chore(ai):` commit for the user to approve.

## Phase 8 — Conclude

End the session with three short lists, appended to `docs/decisions.md`:

- **Decided** — what is now settled, and where it is written down
- **Open** — what still needs a human decision, and who or what it waits on
- **Next** — the next unticked step

Then stop. Do not start the next step.
