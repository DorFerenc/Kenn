import createNextIntlPlugin from 'next-intl/plugin';

/**
 * No custom webpack config, ever: Next.js 16 is Turbopack-only and fails the
 * build on one. See apps/web/CLAUDE.md and ADR-0004 — this is the constraint
 * Serwist has to be fitted around at roadmap step 6.
 */
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export default withNextIntl({
  reactStrictMode: true,

  // Next.js 16 writes an AGENTS.md into the app on every `next dev` and
  // re-creates it when deleted. Kenn's AI instructions live in CLAUDE.md and
  // .claude/, reviewed and committed deliberately; a file a tool rewrites
  // behind the gate is not that. Off.
  agentRules: false,
});
