import { describe, expect, it } from 'vitest';
import { AA, contrastRatio, isHex, luminance } from './contrast.ts';

describe('isHex', () => {
  it.each(['#000', '#ffffff', '#A4451C', '#a4451c'])('accepts %s', (value) => {
    expect(isHex(value)).toBe(true);
  });

  it.each(['a4451c', '#a4451', '#gggggg', 'rgb(0 0 0)', '', null, 12])(
    'rejects %s',
    (value) => {
      expect(isHex(value)).toBe(false);
    },
  );
});

describe('luminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1, 10);
  });

  it('expands a three-digit literal', () => {
    expect(luminance('#fff')).toBe(luminance('#ffffff'));
  });

  it('throws on a value that is not a colour', () => {
    expect(() => luminance('tomato')).toThrow(TypeError);
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white, the spec maximum', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
  });

  it('is 1:1 for a colour on itself', () => {
    expect(contrastRatio('#a4451c', '#a4451c')).toBeCloseTo(1, 10);
  });

  it('does not depend on the order of the arguments', () => {
    expect(contrastRatio('#1f1a15', '#fbf8f4')).toBeCloseTo(
      contrastRatio('#fbf8f4', '#1f1a15'),
      10,
    );
  });

  it('agrees with a published value', () => {
    // WCAG's own worked example: #777 on #fff is 4.48:1 — just under AA, which
    // is why it is the example. A rounding error here would silently pass a
    // token that fails.
    const ratio = contrastRatio('#777777', '#ffffff');
    expect(ratio).toBeCloseTo(4.48, 2);
    expect(ratio).toBeLessThan(AA.text);
  });
});
