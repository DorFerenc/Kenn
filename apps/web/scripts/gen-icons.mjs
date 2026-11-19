/**
 * Render the app icons from one SVG, with colours read from tokens.css.
 *
 * Run by hand when the mark or the palette changes, and commit the PNGs:
 *
 *     pnpm --filter @kenn/web icons
 *
 * Chromium rasterises, because it is already here for Playwright and it draws
 * an SVG exactly as a browser will. Four files, because the platforms disagree:
 * Android wants 192 and 512 plus a "maskable" one whose mark sits inside the
 * central 80% safe zone, and iOS ignores the manifest and reads a 180 px
 * apple-touch-icon with no transparency.
 */

import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const tokens = readFileSync(
  fileURLToPath(new URL('../../../packages/ui/src/tokens.css', import.meta.url)),
  'utf8',
);
const token = (name) => {
  const match = tokens.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`gen-icons: ${name} not found in tokens.css`);
  return match[1];
};
const accent = token('--color-accent');
const surface = token('--color-surface');

/** A nest: two eggs, and the bowl drawn in front of them so they sit in it. `pad` shrinks it for the safe zone. */
const svg = (size, pad, rounded) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${rounded ? 22 : 0}" fill="${accent}"/>
  <g transform="translate(${pad} ${pad}) scale(${(100 - 2 * pad) / 100})">
    <ellipse cx="40" cy="44" rx="11" ry="14" fill="${surface}" stroke="${accent}" stroke-width="2.5"/>
    <ellipse cx="59" cy="46" rx="10.5" ry="13" fill="${surface}" stroke="${accent}" stroke-width="2.5"/>
    <path d="M14 50 L86 50 Q82 84 50 86 Q18 84 14 50 Z" fill="${surface}"/>
    <path d="M20 58 Q50 66 80 56 M22 68 Q50 76 77 66 M30 77 Q50 82 70 76" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>
  </g>
</svg>`;

const outputs = [
  ['icon-192.png', 192, 4, true],
  ['icon-512.png', 512, 4, true],
  ['icon-maskable-512.png', 512, 14, false],
  ['apple-touch-icon.png', 180, 8, false],
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, size, pad, rounded] of outputs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(size, pad, rounded)}</body></html>`,
  );
  await page.locator('svg').screenshot({
    path: fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url)),
    omitBackground: rounded,
  });
  console.log(`gen-icons — public/icons/${name} (${size}px)`);
}
await browser.close();
