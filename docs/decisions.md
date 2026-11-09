# Decision log

One entry per session, **newest first**. Each session ends with three lists:
decided, open, next. A decision with a real trade-off also gets an ADR in
[`docs/adr/`](adr/); this file is the short form and links to it.

Entries dated before 2026-11-07 were migrated from the decision log in the
planning document's "Plan" tab. That table continues in
[`plan.md`](plan.md#decision-log) as a historical record; **this file is the live
log from step 0 onward.**

---

## 2026-11-09 · Things re-scoped, and the repo gated

Product change plus repo governance. Still no application code.

### Decided

- **Things is recommendation-first, not CSV-first.** A family gets a curated
  catalogue filtered to their profile and ticks what they want. CSV import is a
  convenience for people who already keep a spreadsheet. Design:
  [`plans/recommended-lists.md`](plans/recommended-lists.md).
- **The catalogue is KB content** (`kind: thing`, under
  `packages/kb/content/things/`): versioned in git, both locales, sources
  required, `review_by` required, changed only by a merged PR. A recommendation
  to buy something is guidance.
  [ADR-0005](adr/0005-recommendation-catalogue-in-kb-with-safety-veto.md)
- **Safety vetoes popularity — now hard rule 11 in `CLAUDE.md`.** Four real
  family lists were used as the seed corpus. Between them they mark a cot bumper
  (`נחשוש`) as **mandatory**, a head guard (`מגן ראש`) as medium priority, and a
  side-sleeping positioning pillow as available at a grandparent's. The MoH's
  room-preparation page directs that the cot hold a fitted sheet and a blanket
  only — no pillows, toys, dolls, `נחשוש`, `מגן ראש` or `מגן מיטה` — and the AAP
  has advised against positioners since 2011, with the US banning bumpers and
  inclined sleepers outright in 2022. **A catalogue merged by popularity would
  recommend a cot bumper as mandatory.** So `necessity: unsafe` requires a named
  authority and a source, a zod refinement fails CI without one, and no
  popularity signal can raise it.
- **Community lists are provenance, never sources.** A family spreadsheet or a
  forum list goes in `lists` with the tier it assigned; only an authority goes in
  `sources`. This is what stops a spreadsheet becoming a citation.
- **Necessity is three axes**, because one field loses the answer: how necessary,
  when it is needed, and how it is acquired. The real lists are full of "comes in
  the birth package", "we got it as a gift" and "take from mum".
- **Decision hints** reuse the existing `applies_if` mechanism: baby room, home
  size and floor and lift, budget, season at birth (derived from the EDD, never
  asked), car, feeding intent, family who can lend, firstborn, customs.
- **Live updates: three source classes.**
  [ADR-0006](adr/0006-source-policy-for-live-recommendation-updates.md).
  **A, authoritative** (MoH, Beterem, recalls, CPSC, EU Safety Gate, Bituach
  Leumi) — watched weekly, may set a safety verdict. **B, editorial** (parenting
  portals, health-fund guides) — watched weekly, may only propose. **C, retailers
  and parent forums — read by a human, never scraped**, for three reasons:
  retailer terms and `robots.txt` forbid it, a weekly diff against a shop is
  almost all price churn that would bury the Class A changes, and forum content
  is anecdotal and demonstrably recommends unsafe products. **This narrows the
  original ask**, which named baby shops and mother forums as live sources.
- **Step 8 splits into 8a** (mechanism: schema, profile hints, filtering, picker,
  budget) **and 8b** (content: seed the catalogue, safety overrides first, then
  the importer and the registry). Numbered 8a/8b so steps 9–17 keep their
  numbers.
- **`main` is gated.** A GitHub ruleset requires a PR and both CI jobs, blocks
  force pushes and deletion, and requires thread resolution — with **zero
  required approvals for now**, so a PR can be merged by whoever opened it once
  CI is green. Configured by `scripts/setup-branch-protection.sh`, in git rather
  than remembered from a settings page; `--approvals 1` flips it when code review
  starts. Plus `.github/pull_request_template.md` with conditional checklists and
  `.github/dependabot.yml`, which ignores major TypeScript upgrades per ADR-0002.

### Open

- **Three repository settings a script cannot reach**, worth turning on: secret
  scanning with push protection, Dependabot alerts, auto-delete head branches.
- **`scripts/setup-branch-protection.sh` has not been run.** This session's
  GitHub access is read/write for content but not for repository administration,
  so a repo admin runs it once.
- **Which editorial sources are Class B**, by name, with their URLs. Needed
  before step 13, not before 8a.
- **The birth-grant wording.** Israel's `מענק לידה` is money (₪2,103 for a first
  child from 01.01.2026), not a box of goods; the "birth package" the lists refer
  to is a commercial or health-fund starter kit whose contents vary. What the
  catalogue says about `how_acquired: starter_kit` needs a source before it ships.
- The two `inventory_item` gaps from the follow-up entry below: a sourcing note,
  and a required flag separate from `status`. ADR-0005 settles the second as part
  of `necessity`; the first is still open.
- Unchanged: the current week and EDD, and the Supabase, Vercel and Anthropic
  accounts, still block step 1. Yarden's role.

### Next

**Step 1**, unchanged. Things 8a/8b remain in Release 1 after it.

---

## 2026-11-09 · step 0 follow-up

Two items that step 0 left open are now closed. No code changed.

### Decided

- **`main` is the default branch.** CI's `push: branches: [main]` trigger and
  future PR bases now point at the right place.
- **The shopping-list CSV is usable.** The re-export is UTF-8 with BOM, 61 items
  in 9 consistent columns, Hebrew intact (2,113 Hebrew characters, and the only
  5 remaining `?` are the two header names `חובה?` and `נקנה?` plus three inside
  URLs). **Step 8 is unblocked.**
- **The file stays out of the repository.** It is household data, and
  `docs/architecture.md` puts household data in Postgres behind RLS, not in git —
  `seed.sql` is fake-household-only for exactly this reason, since it loads into
  every preview environment. Its _structure_ is recorded in
  [`plans/things-csv-import.md`](plans/things-csv-import.md) so step 8 can build
  the importer without the data: the column contract, the value vocabularies, the
  tracking parameters to strip and the one (`variant`) that must be kept, the
  check that refuses a destroyed export, and the test fixtures to carry.

### Open

- **Two gaps in the `inventory_item` model**, found in the real list and needing a
  decision before step 8: a **sourcing note** ("where to look" — 4 rows use the
  link column for this, not for a URL), and a **required flag** separate from
  `status`, because `חובה?` and `נקנה?` are independent axes and collapsing them
  makes "optional, not bought" indistinguishable from "mandatory, not bought".
- Everything else from the step 0 entry below, unchanged. The current week and
  EDD, and the Supabase, Vercel and Anthropic accounts, still block step 1.

### Next

Unchanged: **step 1**. PR #1 is open, green and awaiting review.

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
