# apps/web — rules for Claude

The Next.js 16 PWA: routes, server actions, the `/mcp` and `/ics` routes, and the
service layer. The i18n skeleton landed at roadmap step 2; the first real screens
(onboarding, Today) arrive at step 5.

## Boundaries

- **Only `lib/services` imports `@supabase/supabase-js`.** Everything else calls a
  service function. Enforced by `no-restricted-imports` in the root
  `eslint.config.mjs`.
- Services take an explicit context (`ctx`) carrying the actor — a signed-in user,
  an MCP client, or a cron job — and always use the user's JWT. The service-role
  key belongs to the watcher and CI, never to a request path.
- **Dates come from `@kenn/engine`.** Never compute a window in a component or a
  route handler.
- Every service write that changes household state also writes `audit_log`.

## React and Next.js 16

- Server Components by default. `'use client'` only for state, effects or event
  handlers, and as low in the tree as possible.
- **Request APIs are async.** `cookies()`, `headers()`, `draftMode()`, `params` and
  `searchParams` must be awaited; the synchronous forms were removed in 16.
- Middleware is `proxy.ts`, not `middleware.ts`.
- Every parallel-route slot needs an explicit `default.tsx`, or soft navigation
  breaks.
- Caching is opt-in now. Say what should be cached; assume nothing is.
- **Do not add a custom webpack config** — Next.js 16 fails the build on one.
  Turbopack is the only bundler. This is the thing most likely to bite when
  Serwist is wired up at step 6.
- Lint with `pnpm lint` from the root. `next lint` was removed in 16.

## A static shell must not become a static household

`app/[locale]/layout.tsx` exports `generateStaticParams`, so the locale shell
prerenders. That is correct for a public shell and **dangerous for anything
below it**: a route that reads a household's data and does not force itself
dynamic inherits a prerenderable parent, and Next will bake one family's health
data into a build artefact served to everyone. Next.js 16's caching being
opt-in lowers the odds; it does not remove them, because a page that reads only
through a service and never touches a request API is still analysable as
static.

So, from step 5: **every authenticated segment either reads a request API
(`cookies()`, `connection()`) or sets `export const dynamic = 'force-dynamic'`,
and `generateStaticParams` stays on the public shell.** Worth an assertion at
step 5 that no household route appears in `prerender-manifest.json`.

## Validation

One zod schema per input, in a file shared by the UI, the server action, the API
route and the MCP tool. Validate on the server even when the client already did.

## i18n and RTL

- No hard-coded strings. ICU keys in `messages/he.json` and `messages/en.json`,
  both of them, every time. `pnpm docs:gen` fails on a key in one locale only, an
  empty message, invalid ICU, or a placeholder one locale dropped.
- Hebrew addresses the reader by gender (`סמן` / `סמני`). Use ICU `select` on
  `genderForm` with `feminine`, `masculine` and `other` branches, where `other`
  is the neutral plural that `member.gender_form = 'neutral'` resolves to. The
  gate fails on a missing branch.
- **next-intl 4 removed `defaultTranslationValues`,** so a gendered message needs
  the value passed at the call. Use `genderValues()` from `i18n/gender.ts` rather
  than writing the argument out, or one call site will be the one that forgets.
- **A Server Component that is `async` cannot call `useTranslations`** — and
  every page is async now that `params` is a promise. Use `getTranslations`.
- **`NextIntlClientProvider` is not optional.** next-intl's own `<Link>` is a
  Client Component that reads the locale from context, so leaving the provider
  out builds cleanly and then fails at render with "No intl context found".
- Link with `Link` from `i18n/navigation.ts`, never `next/link`, or the locale
  prefix is dropped.
- **CSS logical properties only**: `margin-inline-start`, never `margin-left`.
- Numbers, phone numbers and timers stay LTR inside RTL text.
- Dates: `14/03/2027` for `he`, `March 14, 2027` for `en`.

## Accessibility

48 px tap targets. No confirmation dialogs — offer undo instead. Dark mode by
default at night. One primary action per item.

## Placeholder dependencies

`knip.json` lists dependencies that `apps/web` declares but does not import yet:
`zod`, `@supabase/supabase-js`, `serwist`, `@serwist/next`, `@kenn/db`,
`@kenn/engine` and `@kenn/kb`. They are declared so the lockfile records the
version matrix from the first commit. **Remove each from `ignoreDependencies` as
the step that uses it lands** — step 5 for Supabase, zod and the workspace
packages, step 6 for Serwist. An entry still there at Gate A means a dependency
nothing uses.

Step 2 took `next-intl`, `tailwindcss`, `@tailwindcss/postcss` and `@kenn/ui`
off that list. Deleting an entry is the point; adding one back is a promise to
return that nobody keeps. Run `/prune` rather than widening the ignore list.

## Next.js writes files

`next dev` generates `next-env.d.ts` (git-ignored; typecheck does not need it)
and would write an `AGENTS.md` into this directory on every run. `agentRules` is
off in `next.config.ts`: Kenn's AI instructions are `CLAUDE.md` and `.claude/`,
reviewed and committed deliberately, not a file a tool rewrites behind the gate.
