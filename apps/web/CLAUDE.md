# apps/web — rules for Claude

The Next.js 16 PWA: routes, server actions, the `/mcp` and `/ics` routes, and the
service layer. Placeholder until roadmap step 1.

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

## Validation

One zod schema per input, in a file shared by the UI, the server action, the API
route and the MCP tool. Validate on the server even when the client already did.

## i18n and RTL

- No hard-coded strings. ICU keys in `messages/he.json` and `messages/en.json`,
  both of them, every time.
- Hebrew addresses the reader by gender (`סמן` / `סמני`). Use ICU `select` on the
  user's `gender_form`, with a neutral plural as the third branch.
- **CSS logical properties only**: `margin-inline-start`, never `margin-left`.
- Numbers, phone numbers and timers stay LTR inside RTL text.
- Dates: `14/03/2027` for `he`, `March 14, 2027` for `en`.

## Accessibility

48 px tap targets. No confirmation dialogs — offer undo instead. Dark mode by
default at night. One primary action per item.

## Placeholder dependencies

`knip.json` lists dependencies that `apps/web` declares but does not import yet
(`next-intl`, `serwist`, `tailwindcss`, `zod`, `@supabase/supabase-js`, the
workspace packages). They are declared so the lockfile records the version matrix
from the first commit. **Remove each from `ignoreDependencies` as the step that
uses it lands** — step 2 for `next-intl` and Tailwind, step 1 for
`@supabase/supabase-js`, step 6 for Serwist. An entry still there at Gate A means
a dependency nothing uses.

`src/placeholder.ts` holds the two locales and nothing else. Delete it once
`app/[locale]` has real routes.
