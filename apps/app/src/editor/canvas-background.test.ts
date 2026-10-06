import { contrastRatio } from '@sododeck/ui/lib/contrast';
import { BackgroundVariant } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import {
  backgroundVariant,
  canvasBackgroundVars,
  mixHex,
  patternColour,
} from './canvas-background';

describe('canvas background (ADR 0044)', () => {
  it('maps the stored pattern to a React Flow variant, none to no pattern', () => {
    expect(backgroundVariant('dots')).toBe(BackgroundVariant.Dots);
    expect(backgroundVariant('grid')).toBe(BackgroundVariant.Lines);
    expect(backgroundVariant('none')).toBeNull();
  });

  it('mixes two hex colours', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('darkens the pattern on a light colour and lightens it on a dark one', () => {
    const light = '#f4efe6';
    const dark = '#1f2a44';
    expect(patternColour(light) < light).toBe(true);
    expect(patternColour(dark) > dark).toBe(true);
    // Visible but quiet: about the theme's own dots on the theme canvas.
    for (const colour of [light, dark, '#7a3cff', '#ffffff', '#000000']) {
      const ratio = contrastRatio(colour, patternColour(colour));
      expect(ratio).toBeGreaterThan(1.1);
      expect(ratio).toBeLessThan(2);
    }
  });

  it('sets no variables without a stored colour, so the theme applies', () => {
    expect(canvasBackgroundVars(undefined)).toBeUndefined();
    expect(canvasBackgroundVars('#1f2a44')).toEqual({
      '--color-canvas': '#1f2a44',
      '--color-dot': patternColour('#1f2a44'),
    });
  });
});
