---
description: Turn a feature, an idea or an issue into a written plan in docs/plans/, with steps sized to one session each. Use before any code is written.
when_to_use: The user describes something new and asks to plan it, break it down, or scope it — or pastes an issue and wants a roadmap for it. Not for executing a step; that is implement-step.
argument-hint: <feature name or a short description>
allowed-tools: Read, Glob, Grep, Write, Agent
---

# Plan a feature

## 1. Understand before planning

Read `CLAUDE.md`, `docs/plans/roadmap.md`, `docs/decisions.md`, `docs/adr/` and the
newest learning file. Then ask yourself, in this order:

- Is this already on the roadmap? If so, this is a refinement, not a new plan.
- Does it contradict a recorded decision? Say so before planning around it.
- Does it belong before or after a gate? Release 1 is "the two of you use it
  daily"; a feature that does not serve that waits.
- Does it need guidance content? Then it needs source pages and a clinical review
  path, which is work in its own right.

Ask the user anything that would change the shape of the plan. One round of
questions, not an interrogation.

## 2. Delegate the draft

Run the `planner` agent. It reads the same context with a fresh head and returns
the plan text. Read it critically — it is a draft, not a verdict.

## 3. Size the steps

A step is one session. Tests:

- Can it be verified at its end without asking a question? If not, split it.
- Does its title contain "and"? Probably two steps.
- Does it leave `main` deployable? If not, reorder.
- Is it bigger than roughly one coherent change plus tests plus docs? Split it.

## 4. Write the file

`docs/plans/<feature>.md`, with: Goal · Not in scope · Steps (each with acceptance
criteria and tests) · Risks · Affected documents and diagrams · Open questions.

Then add the steps to `docs/plans/roadmap.md` in the right release, unticked.

## 5. Kenn-specific gates

Before calling a plan done, check every step against these:

| If a step…               | then it also…                                                                |
| ------------------------ | ---------------------------------------------------------------------------- |
| adds a household table   | adds RLS and a pgTAP test, in the same step                                  |
| adds guidance content    | names its source pages, and has both locales in its acceptance criteria      |
| touches MCP or the coach | states the scopes, and confirms no delete, share or outbound powers          |
| adds a UI string         | has `he` and `en` in its acceptance criteria                                 |
| computes a date          | does it in `packages/engine`, not in the app                                 |
| adds a dependency        | names the exact version and confirms the lint and type toolchain supports it |
| changes the schema       | is backward-compatible with the running version                              |

## 6. Stop

Hand the plan back and **wait for approval**. Do not implement the first step in
the same session — that is a separate session, with `/implement-step`.
