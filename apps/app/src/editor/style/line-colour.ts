/**
 * How a connector's own colour and dash draw (022 R12, R11). Pure. A named colour uses its
 * `stroke` token (all 13 reach 3:1 against the canvas in both themes, tested in `@sododeck/ui`);
 * a custom hex is mixed toward the text colour until it does, so a pale colour never vanishes.
 * The stored value is never changed.
 */
import { contrastRatio } from '@sododeck/ui/lib/contrast';
import type { ColorRef } from '@sododeck/schema';

import { isNamedColor } from './card-style';

export type LineTheme = 'light' | 'dark';

/**
 * `--sd-canvas` in tokens.css, light and dark. Contrast needs the number, not the token; a test
 * keeps these equal to the CSS.
 */
export const CANVAS_HEX = { light: '#fafaf8', dark: '#121211' } as const;

/** WCAG 1.4.11 for a graphical object. */
const MIN_CONTRAST = 3;
/** The mix toward black (light) or white (dark) moves in this many equal steps. */
const MIX_STEPS = 24;

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

function mix(hex: string, target: number, share: number): string {
  const [r, g, b] = channels(hex);
  const blend = (c: number) => c + (target - c) * share;
  return toHex([blend(r), blend(g), blend(b)]);
}

/** The CSS colour a connector is drawn with: a token, or the hex adjusted to be visible. */
export function lineColour(ref: ColorRef | null, theme: LineTheme): string {
  if (ref === null) return 'var(--color-deck-edge)';
  if (isNamedColor(ref)) return `var(--color-card-${ref}-stroke)`;
  const canvas = CANVAS_HEX[theme];
  if (contrastRatio(ref, canvas) >= MIN_CONTRAST) return ref;
  const target = theme === 'light' ? 0 : 255;
  for (let step = 1; step <= MIX_STEPS; step += 1) {
    const candidate = mix(ref, target, step / MIX_STEPS);
    if (contrastRatio(candidate, canvas) >= MIN_CONTRAST) return candidate;
  }
  return mix(ref, target, 1);
}

type Dash = 'solid' | 'dashed' | 'dotted';

/** Trims float noise (4 × 1.5 is exact, but 3.5 × 1.5 should print 5.25, not 5.250000001). */
const num = (n: number): string => String(Math.round(n * 1000) / 1000);

/** `stroke-dasharray`: dashed is 4w on, 3.5w off; dotted is round dots every 3w. Solid has none. */
export function lineDash(dash: Dash, width: number): string | undefined {
  if (dash === 'dashed') return `${num(4 * width)} ${num(3.5 * width)}`;
  if (dash === 'dotted') return `0 ${num(3 * width)}`;
  return undefined;
}

/** Dots are zero-length dashes, so they only show with round caps. */
export function lineCap(dash: Dash): 'round' | undefined {
  return dash === 'dotted' ? 'round' : undefined;
}
