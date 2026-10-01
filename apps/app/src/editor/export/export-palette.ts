import { readableText } from '@sododeck/ui/lib/contrast';
import type { CardColor, ColorRef, StickyColor, Style } from '@sododeck/schema';
import type { ComponentKind } from '@sododeck/ui/lib/icons';

/**
 * Light token values for standalone images (R2: images are always light). Copied from
 * `packages/ui/src/styles/tokens.css`; `export-palette.test.ts` fails if a token changes.
 */
export const LIGHT_PALETTE = {
  canvas: '#fafaf8',
  surface: '#ffffff',
  surface2: '#f4f4f1',
  border: '#deded8',
  hairline: '#ecece8',
  group: 'rgba(255, 255, 255, 0.7)',
  ink: '#1c1c1a',
  inkSecondary: '#55554f',
  inkMuted: '#72726b',
  edge: '#c9c9c2',
  primary: '#f2661c',
  primarySoft: '#fdeee4',
  primaryInk: '#b3480c',
  onPrimary: '#1c1c1a',
  clayInk: '#a3303f',
  claySoft: '#f9e3e6',
  amberSoft: '#f6eddb',
  amberInk: '#8a6112',
  blueSoft: '#e3ecf5',
  blueInk: '#2d5b86',
  successSoft: '#e6f1ec',
  successInk: '#17603f',
  inverse: '#1c1c1a',
  onInverse: '#ffffff',
  /** Named card colours (020, R2): light hex values, copied from `tokens.css`'s `:root`. */
  cardColours: {
    red: { fill: '#ffe4de', stroke: '#d15c53' },
    orange: { fill: '#ffe7d2', stroke: '#c9690c' },
    amber: { fill: '#ffeccd', stroke: '#b47900' },
    yellow: { fill: '#f4f0ce', stroke: '#998800' },
    lime: { fill: '#e5f5d6', stroke: '#679725' },
    green: { fill: '#d9f8e0', stroke: '#259f56' },
    teal: { fill: '#cff9f1', stroke: '#00a28d' },
    cyan: { fill: '#cdf7ff', stroke: '#009bbe' },
    blue: { fill: '#dbf1ff', stroke: '#4087de' },
    indigo: { fill: '#e7ecff', stroke: '#737ade' },
    violet: { fill: '#f4e8ff', stroke: '#986dd0' },
    pink: { fill: '#ffe3f3', stroke: '#c65b93' },
    slate: { fill: '#e6ecf3', stroke: '#667383' },
  } satisfies Record<CardColor, { fill: string; stroke: string }>,
  cardText: { dark: '#1c1c1a', light: '#ffffff' },
};

export type ExportPalette = typeof LIGHT_PALETTE;

function isCardColour(value: ColorRef): value is CardColor {
  return value in LIGHT_PALETTE.cardColours;
}

/** Resolves one channel to a literal hex: the light token for a named colour, else the hex as-is. */
function resolveExportChannel(value: ColorRef, channel: 'fill' | 'stroke'): string {
  return isCardColour(value) ? LIGHT_PALETTE.cardColours[value][channel] : value;
}

/** A card/group's resolved colour for export (020, R2): literal hex, since images are light-only. */
export interface ExportLook {
  fill?: string;
  stroke?: string;
  text: 'default' | 'dark' | 'light';
}

/** Mirrors `card-style.ts`'s `resolveLook`, but for the flattened SVG/PNG export. */
export function exportLook(style: Style | undefined): ExportLook | undefined {
  if (style?.fill === undefined && style?.stroke === undefined) return undefined;
  const fill = style.fill === undefined ? undefined : resolveExportChannel(style.fill, 'fill');
  const stroke =
    style.stroke === undefined ? undefined : resolveExportChannel(style.stroke, 'stroke');
  const text: ExportLook['text'] =
    style.fill !== undefined && !isCardColour(style.fill)
      ? readableText(style.fill).text
      : 'default';
  return { fill, stroke, text };
}

/** The literal ink colour for a resolved `text` role. */
export function exportTextColour(text: ExportLook['text'], palette: ExportPalette): string {
  switch (text) {
    case 'dark':
      return palette.cardText.dark;
    case 'light':
      return palette.cardText.light;
    case 'default':
      return palette.ink;
  }
}

/** Kind tile fill and icon colour, as `KIND_STYLE[kind].tone` / `KIND_FALLBACK`. */
export function kindColours(
  kind: ComponentKind | 'fallback',
  palette: ExportPalette,
): { fill: string; ink: string } {
  switch (kind) {
    case 'gateway':
      return { fill: palette.inverse, ink: palette.onInverse };
    case 'service':
      return { fill: palette.primarySoft, ink: palette.primaryInk };
    case 'queue':
      return { fill: palette.amberSoft, ink: palette.amberInk };
    case 'database':
      return { fill: palette.blueSoft, ink: palette.blueInk };
    case 'external':
      return { fill: palette.claySoft, ink: palette.clayInk };
    case 'client':
    case 'fallback':
      return { fill: palette.surface2, ink: palette.inkSecondary };
  }
}

/** Sticky note tint, as `STICKY_TINT` (amber when unset). */
export function stickyColours(
  tint: StickyColor | undefined,
  palette: ExportPalette,
): { fill: string; border: string; ink: string } {
  switch (tint ?? 'amber') {
    case 'amber':
      return { fill: palette.amberSoft, border: palette.amberInk, ink: palette.amberInk };
    case 'blue':
      return { fill: palette.blueSoft, border: palette.blueInk, ink: palette.blueInk };
    case 'clay':
      return { fill: palette.claySoft, border: palette.clayInk, ink: palette.clayInk };
    case 'green':
      return { fill: palette.successSoft, border: palette.successInk, ink: palette.successInk };
    case 'grey':
      return { fill: palette.surface2, border: palette.border, ink: palette.inkSecondary };
  }
}
