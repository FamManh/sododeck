/**
 * The deck's canvas background (ADR 0044) as canvas styling: which React Flow `<Background>`
 * pattern to draw, and the CSS variables that recolour the canvas when the deck stores a colour.
 * Pure, so the canvas and its tests read the same answer.
 */
import type { ResolvedCanvasBackground } from '@sododeck/model';
import { readableText } from '@sododeck/ui/lib/contrast';
import { BackgroundVariant } from '@xyflow/react';
import type { CSSProperties } from 'react';

/** Spacing of dots and grid lines, in canvas px (the canvas's look since M1). */
export const BACKGROUND_GAP = 22;

/**
 * How far the pattern colour moves from the background toward black (light colours) or white
 * (dark colours). 16 % is about the contrast of the theme's own dots on the theme canvas
 * (`--sd-dot` on `--sd-canvas`, light and dark), so a custom colour keeps the same quiet pattern.
 */
const PATTERN_MIX = 0.16;

/** The React Flow pattern for a stored pattern; `null` draws none (plain colour). */
export function backgroundVariant(
  pattern: ResolvedCanvasBackground['pattern'],
): BackgroundVariant | null {
  if (pattern === 'grid') return BackgroundVariant.Lines;
  if (pattern === 'none') return null;
  return BackgroundVariant.Dots;
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** `from` moved `amount` (0–1) of the way to `to`, both lowercase `#rrggbb`. */
export function mixHex(from: string, to: string, amount: number): string {
  const a = channels(from);
  const b = channels(to);
  return `#${a
    .map((channel, i) =>
      Math.round(channel + ((b[i] ?? channel) - channel) * amount)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/**
 * The dot / grid colour on a custom background: the background itself, darkened when dark text
 * reads best on it and lightened otherwise (the same luminance switch as card text, 020). Derived
 * rather than a fixed token, because a token has one value per theme and the custom colour can be
 * light in dark mode or dark in light mode.
 */
export function patternColour(background: string): string {
  const towards = readableText(background).text === 'dark' ? '#000000' : '#ffffff';
  return mixHex(background, towards, PATTERN_MIX);
}

/**
 * CSS variables for the React Flow root: with a stored colour, `--color-canvas` and `--color-dot`
 * are overridden there, so the background, its pattern and every canvas-coloured knockout inside
 * the canvas (relationship rings, Outside proxies) follow it; without one, nothing is set and the
 * theme tokens apply (light and dark keep working).
 */
export function canvasBackgroundVars(color: string | undefined): CSSProperties | undefined {
  if (color === undefined) return undefined;
  return { '--color-canvas': color, '--color-dot': patternColour(color) } as CSSProperties;
}
