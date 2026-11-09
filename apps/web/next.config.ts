import createNextIntlPlugin from 'next-intl/plugin';

/**
 * No custom webpack config, ever: Next.js 16 is Turbopack-only and fails the
 * build on one. See apps/web/CLAUDE.md and ADR-0004 — this is the constraint
 * Serwist has to be fitted around at roadmap step 6.
 */
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export default withNextIntl({
  reactStrictMode: true,

  // Free fingerprinting, off.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // The one that is a data leak rather than defence in depth: KB items
          // cite government source URLs, and a share page is a planned
          // feature. Without this, following a source link from
          // /share/<token> sends the whole URL, token included, to that site
          // in the Referer header. Outbound source links also carry
          // rel="noreferrer", because a header is one misconfiguration away
          // from gone.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  // Next.js 16 writes an AGENTS.md into the app on every `next dev` and
  // re-creates it when deleted. Kenn's AI instructions live in CLAUDE.md and
  // .claude/, reviewed and committed deliberately; a file a tool rewrites
  // behind the gate is not that. Off.
  agentRules: false,
});
