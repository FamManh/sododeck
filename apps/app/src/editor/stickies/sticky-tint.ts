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
