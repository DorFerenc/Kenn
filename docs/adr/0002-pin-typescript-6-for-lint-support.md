# ADR-0002 — Pin TypeScript 6.0.3, not the latest 7.0.2

- **Date:** 2026-11-07
- **Status:** accepted
- **Supersedes / superseded by:** none

## Context

The engineering plan said: "Pin the latest stable version of each tool when you
scaffold it (the lockfile is the record)."

At scaffold time the latest stable TypeScript is **7.0.2** (published 2026-07-08).
TypeScript 7 is the Go-native rewrite of the compiler, and it **ships no
programmatic compiler API** — Microsoft's announcement defers that to 7.1.

Everything that lints TypeScript loads the compiler through that API. Verified
from the registry on 2026-11-07:

```
typescript-eslint@8.72.1
  peerDependencies:
    eslint:     ^8.57.0 || ^9.0.0 || ^10.0.0
    typescript: >=4.8.4 <6.1.0
```

A day-one request for TypeScript 7 support (typescript-eslint issue #12518) was
closed as _not planned_; support is tracked against the 7.1 API. ESLint's own
repositories are waiting on the same thing.

So "pin the latest" would have produced a project with:

- no working ESLint, therefore no `pnpm lint`, therefore a CI gate that cannot run
- no `review-code` skill worth running, since most of its checklist is lint-shaped
- no `format-changed.sh` hook, which runs `eslint --fix` on every edited file

The newest TypeScript the toolchain accepts is **6.0.3** (published 2026-04-16),
the last release of the 6.x line.

## Decision

Pin **TypeScript 6.0.3** in every workspace, and amend the project's own rule to:

> Pin the latest stable version **that the type and lint toolchain supports** —
> not simply the latest version.

The rule now lives in `CLAUDE.md` ("Hard rules", item 9) and in
`docs/architecture.md` ("Technology stack").

Revisit when **both** of these are true: TypeScript 7.1 has shipped a stable
compiler API, and `typescript-eslint` has published a release whose peer range
accepts it. Not before — a working linter is worth more than a faster compiler on
a codebase this size.

## Consequences

- Typecheck is the slower JavaScript compiler. Irrelevant at this scale; the
  10–12× speedup matters for a million-line codebase, not for five small packages.
- Dependabot will keep proposing TypeScript 7. Those PRs get closed with a link
  here until the revisit condition is met. Worth adding an ignore rule for the
  `typescript` major when `dependabot.yml` is written at step 1.
- Kenn does not benefit from TypeScript 7 features. None are needed.
- The alias workaround (install 7 as `@typescript/native` for the `tsc` binary,
  keep 6 under the `typescript` name for tools) stays available if typecheck ever
  becomes a real bottleneck. Rejected now as complexity with no payoff.

## Alternatives considered

- **TypeScript 7.0.2 with no lint.** Rejected: the quality gates are most of what
  makes an AI-built codebase reviewable. Trading them for compiler speed on a
  five-package repo is a bad trade.
- **TypeScript 7.0.2 plus Biome or oxlint instead of ESLint.** Rejected for now:
  it swaps a known toolchain for an unknown one, loses the `typescript-eslint`
  type-aware rules the review checklist leans on, and `eslint-config-next` arrives
  at step 5 anyway.
- **The dual-install alias.** Rejected as premature: real complexity in the
  resolver, for a speed gain nothing currently needs.
- **TypeScript 5.x.** No reason to go further back than the 6.x ceiling.
