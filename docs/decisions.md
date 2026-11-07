# Decision log

One entry per session, **newest first**. Each session ends with three lists:
decided, open, next. A decision with a real trade-off also gets an ADR in
[`docs/adr/`](adr/); this file is the short form and links to it.

Entries dated before 2026-11-07 were migrated from the decision log in the
planning document's "Plan" tab. That table continues in
[`plan.md`](plan.md#decision-log) as a historical record; **this file is the live
log from step 0 onward.**

---

## 2026-11-07 · step 0 · bootstrap

Learning file: [`learnings/2026-11-07-step-0-bootstrap.md`](learnings/2026-11-07-step-0-bootstrap.md)

### Decided

- **Scaffold exists and CI is green on it.** pnpm workspace with `apps/web`
  (placeholder), `packages/engine`, `kb`, `db`, `ui`, and `services/watcher`.
  `pnpm check` runs lint, typecheck, format, Vitest, `kb:validate`, `docs:gen` and
  knip; ruff and pytest cover the watcher. Verified on Node 24, the version CI
  uses.
- **TypeScript 6.0.3, not the latest 7.0.2** — TypeScript 7 ships no compiler API,
  so `typescript-eslint` cannot load it and "latest" would mean no linter at all.
  The project rule is now "the latest version the type and lint toolchain
  supports". [ADR-0002](adr/0002-pin-typescript-6-for-lint-support.md)
- **Supabase CLI v3, with its conventions written down now** — local by default,
  `--remote` for hosted, `--yes` for unattended, `[local_smtp]` not `[inbucket]`,
  `pg-delta` as the diff engine. The new defaults make it impossible for a build
  session to push to production by accident.
  [ADR-0003](adr/0003-supabase-cli-v3-conventions.md)
- **Next.js over SvelteKit**, settled rather than left open. The deciding factor is
  the MCP route sharing the app's auth and service layer, then Radix for RTL.
  [ADR-0004](adr/0004-nextjs-over-sveltekit.md)
- **ADRs are the only route by which a hard rule changes** — never a `/retro`.
  [ADR-0001](adr/0001-record-architecture-decisions.md)
- **`apps/web` declares its real dependencies** so the lockfile proves the whole
  version matrix resolves together from the first commit. The not-yet-imported
  ones are listed in `knip.json` and come off as each step uses them.
- **Supply-chain settings are explicit, not inherited**: `minimumReleaseAge: 1440`
  (nothing published in the last 24 hours is installable — this is why knip is
  pinned at 6.44.1, not 6.44.2), `allowBuilds` denying all three install-time
  build scripts, and GitHub Actions pinned by commit SHA.
- **`pnpm docs:gen` is a real gate, not a placeholder.** It verifies all 14
  diagram embeddings match their `.mmd` source byte for byte, and fails if a
  generator's source gains content while the generator is still unwritten.
- **`docs/plan.md` and `docs/architecture.md` are now the source of truth**; the
  planning document is a historical record. Corrections made at step 0 are listed
  in `architecture.md` → "Changes from the planning document".
- **Three workflows deliberately deferred.** `docs-drift.yml` (step 1),
  `deploy.yml` (step 1) and `watcher.yml` (step 13) each need something that does
  not exist yet; a workflow that can only pass vacuously reads as a gate it is
  not.
- **Guardrails are documented as guardrails.** The `deny` rules in
  `.claude/settings.json` stop accidents, not attackers — Claude Code's own docs
  are explicit that a `Bash` deny rule is not a boundary around the program. Said
  plainly in `CLAUDE.md` and `.claude/README.md` so nobody mistakes them for
  protection.

### Open

- **The current week and the ultrasound-corrected EDD.** This dates every window
  and decides how much of steps 1–6 fits before the next test. **Blocks step 1.**
  Put the next test window in a shared note today regardless — the app is not on
  the critical path.
- **Supabase account** (Frankfurt region), Vercel, and the Anthropic Console with
  a monthly spend cap. **Blocks step 1.**
- **Which OAuth 2.1 authorization server for MCP.** The plan's fallback — "your
  auth provider's, if it supports MCP clients" — probably does not apply:
  Supabase Auth is an identity provider for Kenn's own users, not an authorization
  server with dynamic client registration, which the MCP authorization spec
  requires. Do not hand-write it. **Needed by step 9.**
- **Serwist on Next.js 16.** Serwist integrates through a webpack plugin and
  Next.js 16 fails the build on a custom webpack config. `@serwist/next@9.5.13`
  claims `next >=14` but that is untested here. **Risk on step 6**; fallback is a
  hand-written service worker for the offline emergency card.
- **The shopping-list CSV is still unusable.** The uploaded file is ASCII with
  2,148 literal `?` bytes and zero Hebrew characters — the characters were
  destroyed at export, so no decoding recovers them. Only 8 of 62 rows retain any
  Latin or numeric data. Needs a Google Sheets → Download → CSV, not an Excel
  export. **Blocks step 8.**
- **Yarden's role**: co-builder, or content and UX review?
- Unchanged from before: store medical documents at all; whether to open it to
  other families; monthly budget ceiling; the name checks (trademark, stores,
  domain); the first five test families; which pediatrician and midwife review the
  KB; Israel-only or country packs from day one.

### Next

**Step 1** — Supabase project, auth with MFA, `household` + `member`, RLS and the
first pgTAP test; plus `deploy.yml` and `docs-drift.yml`, which need a schema to
be meaningful.

The `reviewer` and `security-reviewer` agents were written this session but never
run — there was no application code to review. Step 1 is their first real
exercise, and that run tests the agent definitions as much as the code.

---

## 2026-11-06 · planning review

**Decided:** Step 0 bootstrap added before step 1; the build order became the
roadmap with gates A–C; KB items carry `locales` and `applies_if`; `invite` and
`push_subscription` tables added; use a maintained OAuth server for MCP, never
hand-written; a session prompt template for every build session.

**Open:** as below.

**Next:** the Week 0 checklist, then step 0 in a new chat.

---

## 2026-11-06 · initial plan

**Decided:** the name Kenn. Next.js + Supabase, TypeScript monorepo, Python
watcher. KB in git, human-approved. No end-to-end encryption in v1. Hebrew and
English at launch. The safety centre as fixed, reviewed content. AI instructions,
agents and skills live in the repo and improve only through approved retros.

**Open:** current week and EDD; Next.js vs SvelteKit; Yarden's role; trademark
check.

**Next:** step 1 — scaffold the repo, auth and RLS.
