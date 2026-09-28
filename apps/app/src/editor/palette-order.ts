import type { ComponentKind } from '@sododeck/ui/lib/icons';

/**
 * Palette order (design 14). Also the number keys 1–6 that add a kind while the palette flyout
 * is open (018, design 88). Cloud and partner kinds are deferred (§g-28 → B).
 */
export const PALETTE_ORDER: readonly ComponentKind[] = [
  'service',
  'database',
  'queue',
  'gateway',
  'client',
  'external',
];
