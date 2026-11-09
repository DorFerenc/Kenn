/**
 * WCAG 2.2 contrast ratio, from first principles.
 *
 * This exists so the contrast rule in packages/ui/CLAUDE.md ("contrast holds in
 * dark mode, which is the default at night") is a test rather than an intention.
 * It is thirty lines of arithmetic with a published spec, which is why the
 * colour tokens are hex: a dependency, or a wider colour space, would make the
 * gate harder to audit than the thing it guards.
 *
 * Spec: WCAG 2.2, "Contrast (Minimum)" and "Non-text Contrast".
 */

/** A `#rgb` or `#rrggbb` colour literal. */
export type Hex = string;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(value: unknown): value is Hex {
  return typeof value === 'string' && HEX.test(value);
}

/** The three sRGB channels of a hex literal, each 0–255. */
function channels(hex: Hex): [number, number, number] {
  const m = HEX.exec(hex);
  if (!m?.[1]) throw new TypeError(`not a hex colour: ${String(hex)}`);
  const digits = m[1];
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((c) => c + c)
          .join('')
      : digits;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** Relative luminance, WCAG 2.2 §relative-luminance. */
export function luminance(hex: Hex): number {
  const linear = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/**
 * Contrast ratio between two colours, from 1 (identical) to 21 (black on
 * white). Order does not matter.
 */
export function contrastRatio(a: Hex, b: Hex): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (lighter + 0.05) / (darker + 0.05);
}

/** The AA threshold for a given role. Large text is >=18.66px bold or >=24px. */
export const AA = {
  /** Body text and anything smaller than large. */
  text: 4.5,
  /** Large text. */
  largeText: 3,
  /** A UI component or graphical object that conveys state (WCAG 1.4.11). */
  nonText: 3,
} as const;
