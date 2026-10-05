import type { StickyColor } from '@sododeck/schema';

export const STICKY_TINT = {
  amber: 'border-amber-ink bg-amber-soft text-amber-ink',
  blue: 'border-blue-ink bg-blue-soft text-blue-ink',
  clay: 'border-clay-ink bg-clay-soft text-clay-ink',
  green: 'border-success-ink bg-success-soft text-success-ink',
  grey: 'border-border bg-surface-2 text-text-secondary',
} as const satisfies Record<StickyColor, string>;

export function stickyTintClass(color: StickyColor | undefined): string {
  return STICKY_TINT[color ?? 'amber'];
}

/** The five note colours, in the order the toolbar lists them. */
export const STICKY_COLORS: readonly StickyColor[] = ['amber', 'blue', 'clay', 'green', 'grey'];

const COLOUR_NAMES: Readonly<Record<StickyColor, string>> = {
  amber: 'Amber',
  blue: 'Blue',
  clay: 'Clay',
  green: 'Green',
  grey: 'Grey',
};

export const stickyColourName = (color: StickyColor | undefined): string =>
  COLOUR_NAMES[color ?? 'amber'];

/** The paper's fill as a token, for a mini swatch (the sheet itself uses `STICKY_TINT`). */
const SWATCH_FILL = {
  amber: 'var(--color-amber-soft)',
  blue: 'var(--color-blue-soft)',
  clay: 'var(--color-clay-soft)',
  green: 'var(--color-success-soft)',
  grey: 'var(--color-surface-2)',
} as const satisfies Record<StickyColor, string>;

/** The paper's edge as a token: the ring that keeps a pale swatch visible on the toolbar. */
const SWATCH_EDGE = {
  amber: 'var(--color-amber-ink)',
  blue: 'var(--color-blue-ink)',
  clay: 'var(--color-clay-ink)',
  green: 'var(--color-success-ink)',
  grey: 'var(--color-border)',
} as const satisfies Record<StickyColor, string>;

export const stickySwatch = (color: StickyColor | undefined) => ({
  swatch: SWATCH_FILL[color ?? 'amber'],
  ringSwatch: SWATCH_EDGE[color ?? 'amber'],
});
