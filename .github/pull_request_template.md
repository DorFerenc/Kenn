## What this changes

<!-- One or two sentences. The reason, not the diff. -->

## Roadmap step

<!-- e.g. "Step 8a" / "follow-up to step 0" / "not a roadmap step". -->

## Checks

- [ ] `pnpm check` green locally (lint, typecheck, format, Vitest, `kb:validate`, `docs:gen`, knip)
- [ ] `reviewer` agent run; findings fixed or recorded as accepted with a reason
- [ ] `/update-docs` run — diagrams and docs the diff falsified are updated
- [ ] `/retro` written in `docs/learnings/`, conclusion appended to `docs/decisions.md`
- [ ] Roadmap step ticked, if this finishes one

## If this touches the database

- [ ] Every new household table carries `household_id`, has RLS enabled, and a policy with **both** `using` and `with check`
- [ ] A pgTAP test in **this same PR** asserts zero cross-household rows for select, insert, update and delete, plus one positive case
- [ ] Backward-compatible with the deployed version (add now, drop a release later)
- [ ] `pnpm db:types` run and `types.ts` committed
- [ ] `security-reviewer` agent run

## If this touches guidance content

- [ ] Every value traces to a source URL; nothing from memory
- [ ] Both `he` and `en` present on every published item
- [ ] `review_by` set
- [ ] `version` bumped if the meaning changed
- [ ] Any `necessity: unsafe` / `discouraged` item cites a named authority (ADR-0005)
- [ ] Community or family lists are in `lists` (provenance), not in `sources`

## If this touches the AI-facing surface

- [ ] No delete, share, document-read or outbound-message capability added
- [ ] Fetched, shared and user-written text is passed as data, never as instruction
- [ ] Every AI write lands in `audit_log` with the client name
- [ ] MCP tools check scope **and** household server-side, not from the request body

## Decisions

<!-- Anything a future reader would ask "why on earth" about needs an ADR in
     docs/adr/. Link it here, or say "none". -->
