/** A screen rectangle (DOM px). */
export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the selection toolbar goes (019 FR-019, R5): centred 12 px above the selection, flipped
 * 12 px below when its top would come within 68 px of the window top (the top islands), and kept
 * inside the window's 12 px edges. A toolbar wider than the window sticks to the left edge.
 */
export function toolbarPlacement(
  rect: ScreenRect,
  size: { width: number; height: number },
  viewport: { width: number },
  { gap = 12, topLimit = 68, edge = 12 }: { gap?: number; topLimit?: number; edge?: number } = {},
): { x: number; y: number; side: 'above' | 'below' } {
  const above = rect.y - gap - size.height;
  const side = above < topLimit ? 'below' : 'above';
  const centred = rect.x + rect.width / 2 - size.width / 2;
  const x = Math.max(edge, Math.min(centred, viewport.width - edge - size.width));
  return { x, y: side === 'above' ? above : rect.y + rect.height + gap, side };
}
