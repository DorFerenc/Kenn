import type { MetadataRoute } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import he from '@/messages/he.json';

/**
 * The web app manifest, served at `/manifest.webmanifest` (step 6a).
 *
 * One manifest for both languages, because the install prompt is shown once
 * per origin. Hebrew is the default locale, so the name, the direction and the
 * start page are Hebrew's; an English reader lands on `/` and is sent to their
 * own locale by the proxy like any other visit.
 *
 * The two colours are read out of `tokens.css` at build time rather than
 * written here, because a colour stated twice is two colours (packages/ui,
 * "Tokens before components").
 */
function token(name: string): string {
  const css = readFileSync(
    join(process.cwd(), '../../packages/ui/src/tokens.css'),
    'utf8',
  );
  const match = css.match(new RegExp(`${name}:\\s*(\\S+);`));
  if (!match?.[1]) throw new Error(`manifest: ${name} not found in tokens.css`);
  return match[1];
}

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: he.app.name,
    short_name: he.app.name,
    description: he.app.tagline,
    lang: 'he',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: token('--color-surface'),
    theme_color: token('--color-accent'),
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
