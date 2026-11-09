# ADR-0001 — Record architecture decisions

- **Date:** 2026-11-07
- **Status:** accepted
- **Supersedes / superseded by:** none

## Context

Kenn is built one roadmap step per session, by an AI agent reading instructions
from the repository, over months. The people reviewing a decision six weeks from
now are the same two people who made it, with no memory of the alternatives they
rejected. Decisions recorded only in a chat log are lost; decisions recorded only
in a commit message are unfindable.

There is a second reason, specific to this project. Some decisions here are
deliberately _against_ the obvious choice — pinning an older TypeScript, not
encrypting end-to-end, not auto-applying government guidance. Without the
reasoning written down, a future session will "fix" them.

## Decision

Every decision with a non-obvious reason gets a file in `docs/adr/`, numbered
sequentially: `NNNN-<slug>.md`, with Context, Decision, Consequences and
Alternatives considered, plus a date and status.

- The `doc-keeper` agent drafts one when a step makes a decision; `/update-docs`
  prompts for it.
- A decision is "non-obvious" if a future reader would otherwise ask "why on
  earth": a version pinned against the latest, a library rejected, a security
  trade-off, a schema shape with a reason outside the schema.
- ADRs are immutable once accepted. A reversal is a **new** ADR that supersedes
  the old one; the old file stays, marked superseded.
- `docs/decisions.md` is the short per-session log (decided / open / next). An ADR
  is the long form for one decision. The log links to the ADR.
- **The hard rules in `CLAUDE.md` can only be relaxed by an ADR the user
  accepts** — never by a `/retro`. That is the main thing this mechanism protects.

## Consequences

- One more file to write at the end of some steps. Acceptable: there will be a few
  dozen of these over the project, not hundreds.
- A reversal costs a second ADR rather than an edit, which is the point: the
  history of a decision is as useful as the decision.
- If ADRs stop being written, the self-improving loop quietly loses its brake. The
  `update-docs` skill carries the check.

## Alternatives considered

- **Decision log only** (`docs/decisions.md`). Too compressed for anything with a
  real trade-off; a one-line entry cannot carry the evidence for the TypeScript
  pin.
- **Comments in code.** Invisible to anyone who is not already reading that file,
  and lost when the file is deleted.
- **The planning document.** It was mirrored to `docs/plan.md` at step 0 and is
  now a historical record; decisions made from here on would have nowhere to go.
