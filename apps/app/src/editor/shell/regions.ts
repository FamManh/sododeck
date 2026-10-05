/**
 * Keyboard regions of the canvas-first shell (018 FR-036, design 115): F6 moves forward through
 * them and ⇧F6 backward, wrapping and skipping the hidden ones. Under Hide UI only the canvas
 * and the "Show UI" button remain.
 */
export const REGION_ORDER = [
  'deck',
  'tools',
  'rail',
  'history',
  'canvas',
  'zoom',
  'drawer',
  'code',
] as const;

export type RegionId = (typeof REGION_ORDER)[number] | 'show-ui';

export function visibleRegions({
  hideUi,
  drawerOpen,
  codeOpen = false,
}: {
  hideUi: boolean;
  drawerOpen: boolean;
  /** The DBML / SQL drawer (054). */
  codeOpen?: boolean;
}): readonly RegionId[] {
  if (hideUi) return ['canvas', 'show-ui'];
  return REGION_ORDER.filter(
    (region) => (region !== 'drawer' || drawerOpen) && (region !== 'code' || codeOpen),
  );
}

/**
 * The region after (or before, `direction` −1) `current` among `visible`. From outside any
 * region (or a hidden one) F6 goes to the canvas, the region users most often return to.
 */
export function nextRegion(
  current: RegionId | null,
  visible: readonly RegionId[],
  direction: 1 | -1,
): RegionId {
  const index = current === null ? -1 : visible.indexOf(current);
  if (index === -1) return visible.includes('canvas') ? 'canvas' : (visible[0] ?? 'canvas');
  const next = (index + direction + visible.length) % visible.length;
  return visible[next] ?? 'canvas';
}

export function isRegionId(value: string | undefined): value is RegionId {
  return value === 'show-ui' || (REGION_ORDER as readonly string[]).includes(value ?? '');
}
