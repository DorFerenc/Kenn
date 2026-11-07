# ADR-0004 — Next.js over SvelteKit

- **Date:** 2026-11-07
- **Status:** accepted
- **Supersedes / superseded by:** none

## Context

The plan left this open: "SvelteKit is a fine, lighter alternative to Next.js;
pick whichever you'll enjoy maintaining." The decision log listed "Next.js vs
SvelteKit" as unresolved while also recording "Next.js + Supabase" as decided.

Step 0 cannot stay neutral: the scaffold either has an `apps/web` with Next.js
pinned in its lockfile, or it does not. Deferring would mean a placeholder with no
dependency matrix, which defeats the main purpose of declaring those dependencies
at step 0 — proving they resolve together.

What actually bears on the choice for Kenn:

- The remote MCP server is a route of the same app, sharing its auth, its service
  layer and the schedule engine. Next.js route handlers and the official
  TypeScript MCP SDK are the well-trodden path here; the SvelteKit equivalent
  exists but has far fewer people on it.
- RTL and accessibility come from Radix via shadcn/ui, which is React.
- next-intl covers ICU messages, locale routing and the Hebrew gender forms
  (`select` messages) with a Next-specific integration.
- Vercel is already the chosen host.
- The same auth + MCP skeleton is wanted for a second project (the gym tracker),
  so building it once on the more widely documented stack has reuse value.

Against Next.js: version 16 is a genuinely disruptive release — Turbopack only, a
custom webpack config now fails the build, synchronous request APIs removed,
`middleware.ts` becoming `proxy.ts`, `next lint` removed. SvelteKit would be
lighter and the bundle smaller.

## Decision

**Next.js 16.4.5, App Router**, with React 19.3.1, Tailwind 4, shadcn/ui,
next-intl and Serwist.

The deciding factor is the MCP route sharing the app's auth and service layer,
followed by Radix for RTL. Bundle size is not a constraint for an app used by two
people on their own phones.

## Consequences

- The Next.js 16 breaking changes are now Kenn's problem, and they are written
  into `apps/web/CLAUDE.md` so each is handled once rather than rediscovered:
  async request APIs, `proxy.ts`, explicit `default.tsx` per parallel-route slot,
  opt-in caching, no custom webpack config, ESLint invoked directly.
- **The known risk is Serwist at step 6.** It integrates through a webpack plugin,
  and Next.js 16 fails the build on a custom webpack config. If that proves
  irreconcilable the fallback is a hand-written service worker for the offline
  emergency card, which is the only part of the PWA that must work offline in
  Release 1. Flagged on step 6 in the roadmap.
- Reversing this means rewriting `apps/web`. `packages/engine`, `packages/kb` and
  `packages/db` are framework-free by design and would survive unchanged — which
  is most of the value of that split.

## Alternatives considered

- **SvelteKit.** Lighter, smaller bundles, a stack that would have been pleasant
  to maintain. Rejected on the MCP and Radix integration surface, not on quality.
- **Next.js 15.5.x** to avoid the 16 breaking changes. Rejected: 15 is on backport
  maintenance, and starting a new project on the previous major means paying the
  migration anyway, later, with real code in the way.
- **Decide at step 5 and leave `apps/web` empty.** Rejected: it would leave the
  version matrix unverified until the step that depends on it.
