import type { StickyColor } from '@sododeck/schema';
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
};

export type ExportPalette = { readonly [K in keyof typeof LIGHT_PALETTE]: string };

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
