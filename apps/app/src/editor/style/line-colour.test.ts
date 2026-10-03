import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { contrastRatio } from '@sododeck/ui/lib/contrast';
import { describe, expect, it } from 'vitest';

import { CARD_COLORS } from './card-style';
import { CANVAS_HEX, lineCap, lineColour, lineDash } from './line-colour';

const tokensCss = readFileSync(
  resolve(import.meta.dirname, '../../../../../packages/ui/src/styles/tokens.css'),
  'utf8',
);

describe('canvas colours used for the contrast adjustment', () => {
  it('match --sd-canvas in tokens.css, light and dark', () => {
    const light = /:root\s*\{[^}]*--sd-canvas:\s*(#[0-9a-f]{6})/i.exec(tokensCss)?.[1];
    const dark = /\.dark\s*\{[^}]*--sd-canvas:\s*(#[0-9a-f]{6})/i.exec(tokensCss)?.[1];
    expect(CANVAS_HEX.light).toBe(light);
    expect(CANVAS_HEX.dark).toBe(dark);
  });
});

describe('lineColour', () => {
  it('uses the default edge token for no colour', () => {
    expect(lineColour(null, 'light')).toBe('var(--color-deck-edge)');
    expect(lineColour(null, 'dark')).toBe('var(--color-deck-edge)');
  });

  it.each(CARD_COLORS)('uses the %s stroke token for the named colour', (name) => {
    expect(lineColour(name, 'light')).toBe(`var(--color-card-${name}-stroke)`);
    expect(lineColour(name, 'dark')).toBe(`var(--color-card-${name}-stroke)`);
  });

  it('keeps a custom hex that already reaches 3:1', () => {
    expect(lineColour('#7a3cff', 'light')).toBe('#7a3cff');
    expect(lineColour('#1f2a44', 'light')).toBe('#1f2a44');
    expect(lineColour('#bbbbbb', 'dark')).toBe('#bbbbbb');
  });

  it.each([
    ['light', ['#ffffff', '#fff59d', '#e3d7ff', '#ffff00', '#cccccc', '#fafafa']],
    ['dark', ['#000000', '#050505', '#1c1c1a', '#1f2a44', '#8b0000', '#0b6e4f']],
  ] as const)('mixes a hard-to-see custom hex toward the text colour (%s)', (theme, samples) => {
    for (const hex of samples) {
      const out = lineColour(hex, theme);
      expect(out).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrastRatio(out, CANVAS_HEX[theme])).toBeGreaterThanOrEqual(3);
      expect(out).not.toBe(hex);
    }
  });

  it('moves a light colour toward black in the light theme and a dark one toward white in dark', () => {
    expect(lineColour('#ffff00', 'light')).not.toBe('#ffff00');
    const lightOut = lineColour('#ffff00', 'light');
    expect(contrastRatio(lightOut, '#000000')).toBeLessThan(contrastRatio('#ffff00', '#000000'));
    const darkOut = lineColour('#000000', 'dark');
    expect(contrastRatio(darkOut, '#ffffff')).toBeLessThan(contrastRatio('#000000', '#ffffff'));
  });

  it('is a pure function of its input (the stored value is never touched)', () => {
    const ref = '#fff59d';
    lineColour(ref, 'light');
    expect(ref).toBe('#fff59d');
    expect(lineColour(ref, 'light')).toBe(lineColour(ref, 'light'));
  });
});

describe('lineDash', () => {
  it('is undefined for solid', () => {
    expect(lineDash('solid', 2)).toBeUndefined();
  });

  it('dashed is 4w 3.5w and dotted is 0 3w', () => {
    expect(lineDash('dashed', 2)).toBe('8 7');
    expect(lineDash('dashed', 1)).toBe('4 3.5');
    expect(lineDash('dashed', 1.5)).toBe('6 5.25');
    expect(lineDash('dotted', 2)).toBe('0 6');
    expect(lineDash('dotted', 4)).toBe('0 12');
  });

  it('dotted needs round caps', () => {
    expect(lineCap('dotted')).toBe('round');
    expect(lineCap('dashed')).toBeUndefined();
    expect(lineCap('solid')).toBeUndefined();
  });
});
