/**
 * Geometry of the canvas-first shell (018, DESIGN.md "Canvas-first Editor", research R1/R5/R6).
 * Pure: everything is in screen px for a given viewport, so the layout rules are unit-tested
 * without a browser. The components read these numbers; nothing measures the canvas.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Distance of every island from the viewport edges. */
export const EDGE = 12;
export const ISLAND_HEIGHT = 44;
export const RAIL_WIDTH = 48;
/** Top of flyouts and the drawer: island height + both edge gaps. */
export const OVERLAY_TOP = EDGE + ISLAND_HEIGHT + EDGE;
/** Left of flyouts and the JSON overlay: rail + its edge gap + 8. */
export const FLYOUT_LEFT = EDGE + RAIL_WIDTH + 8;
export const FLYOUT_WIDTH = 280;
export const DRAWER_MIN = 320;
export const DRAWER_DEFAULT = 360;
export const DRAWER_MAX = 560;
/** In a compact window (1024–1279) the drawer covers at most this share of the width. */
export const DRAWER_COMPACT_SHARE = 0.35;
/** Gap between the zoom island and the JSON overlay under it. */
export const STACK_GAP = 8;
/** Room kept between a selection and the chrome that would cover it. */
export const CLEAR_MARGIN = 24;

/**
 * Design sizes of the islands at 100 % (states 86, 115). Used for the coverage budget and for
 * overlap checks in narrow windows; the rendered islands size to their content.
 */
export const ISLAND_SIZES = {
  deck: { width: 460, height: ISLAND_HEIGHT },
  deckCompact: { width: 300, height: ISLAND_HEIGHT },
  tools: { width: 470, height: ISLAND_HEIGHT },
  toolsCompact: { width: 220, height: ISLAND_HEIGHT },
  // 10 buttons of 38 with 2 px gaps, 2 dividers of 9, 4 px padding each end.
  rail: { width: RAIL_WIDTH, height: 10 * 38 + 9 * 2 + 2 * 9 + 8 },
  history: { width: RAIL_WIDTH, height: 2 * 38 + 2 + 8 },
  zoom: { width: 290, height: ISLAND_HEIGHT },
} as const;

export interface IslandRects {
  deck: Rect;
  tools: Rect;
  rail: Rect;
  history: Rect;
  zoom: Rect;
}

/** Rectangles of the always-visible islands for a viewport (nothing else open). */
export function islandRects(viewport: Size, compact = false): IslandRects {
  const deck = compact ? ISLAND_SIZES.deckCompact : ISLAND_SIZES.deck;
  const tools = compact ? ISLAND_SIZES.toolsCompact : ISLAND_SIZES.tools;
  const { rail, history, zoom } = ISLAND_SIZES;
  const railY = Math.max(OVERLAY_TOP, (viewport.height - rail.height - 8 - history.height) / 2);
  return {
    deck: { x: EDGE, y: EDGE, ...deck },
    tools: { x: viewport.width - EDGE - tools.width, y: EDGE, ...tools },
    rail: { x: EDGE, y: railY, ...rail },
    history: { x: EDGE, y: railY + rail.height + 8, ...history },
    zoom: {
      x: viewport.width - EDGE - zoom.width,
      y: viewport.height - EDGE - zoom.height,
      ...zoom,
    },
  };
}

const area = (rect: Rect) => Math.max(0, rect.width) * Math.max(0, rect.height);

/** Share of the viewport covered by the given rectangles (assumed not to overlap). */
export function chromeCoverage(viewport: Size, rects: readonly Rect[]): number {
  const total = viewport.width * viewport.height;
  if (total <= 0) return 0;
  return rects.reduce((sum, rect) => sum + area(rect), 0) / total;
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Drawer width kept between 320 and 560 px; in a compact window also at most 35 % of the width,
 * but never below the 320 px minimum.
 */
export function clampDrawerWidth(px: number, viewportWidth: number, compact = false): number {
  const requested = Number.isFinite(px) ? px : DRAWER_DEFAULT;
  const max = compact
    ? Math.max(DRAWER_MIN, Math.min(DRAWER_MAX, Math.floor(viewportWidth * DRAWER_COMPACT_SHARE)))
    : DRAWER_MAX;
  return Math.min(Math.max(requested, DRAWER_MIN), max);
}

/** The detail drawer: right 12, top 68, bottom 12. */
export function drawerRect(viewport: Size, width: number): Rect {
  return {
    x: viewport.width - EDGE - width,
    y: OVERLAY_TOP,
    width,
    height: Math.max(0, viewport.height - OVERLAY_TOP - EDGE),
  };
}

/** Largest JSON overlay height that keeps the top islands clear. */
export function maxJsonHeight(viewportHeight: number): number {
  return Math.max(0, viewportHeight - OVERLAY_TOP - EDGE);
}

/**
 * The JSON overlay: from the rail to the right edge, or to the drawer's left edge (with a 12 px
 * gap) when the drawer is open.
 */
export function jsonRect(viewport: Size, height: number, drawerWidth: number | null): Rect {
  const right = drawerWidth === null ? EDGE : EDGE + drawerWidth + EDGE;
  const h = Math.min(height, maxJsonHeight(viewport.height));
  return {
    x: FLYOUT_LEFT,
    y: viewport.height - EDGE - h,
    width: Math.max(0, viewport.width - FLYOUT_LEFT - right),
    height: h,
  };
}

/** Distance of the zoom island from the bottom: above the JSON overlay when it is open. */
export function zoomIslandBottom(jsonOpen: boolean, jsonHeight: number): number {
  return jsonOpen ? EDGE + jsonHeight + STACK_GAP : EDGE;
}

/**
 * Horizontal pan (screen px, positive moves the diagram right) that keeps `target` clear of the
 * chrome: `left` is the right edge of chrome on the left (a flyout), `right` the left edge of
 * chrome on the right (the drawer). 0 when the target is already clear or cannot fit.
 */
export function panToClear(
  target: Rect,
  obstacle: { left?: number; right?: number },
  margin = CLEAR_MARGIN,
): number {
  if (obstacle.right !== undefined) {
    const overlap = target.x + target.width + margin - obstacle.right;
    if (overlap > 0) return -overlap;
  }
  if (obstacle.left !== undefined) {
    const overlap = obstacle.left + margin - target.x;
    if (overlap > 0) return overlap;
  }
  return 0;
}
