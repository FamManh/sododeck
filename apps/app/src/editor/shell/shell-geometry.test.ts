import { describe, expect, it } from 'vitest';

import {
  chromeCoverage,
  chromeInsets,
  fitRectInFreeArea,
  PLAYER_CLEARANCE,
  clampDrawerWidth,
  DRAWER_DEFAULT,
  drawerRect,
  FLYOUT_LEFT,
  intersects,
  islandRects,
  jsonRect,
  maxJsonHeight,
  OVERLAY_TOP,
  panToClear,
  zoomIslandBottom,
  type Rect,
} from './shell-geometry';

const DESKTOP = { width: 1440, height: 900 };

const allRects = (viewport: { width: number; height: number }, compact = false): Rect[] => {
  const r = islandRects(viewport, compact);
  return [r.deck, r.tools, r.rail, r.history, r.zoom];
};

describe('islandRects', () => {
  it('keeps every island 12 px from its edges', () => {
    const rects = islandRects(DESKTOP);
    expect(rects.deck).toMatchObject({ x: 12, y: 12, height: 44 });
    expect(rects.tools.x + rects.tools.width).toBe(1428);
    expect(rects.zoom.y + rects.zoom.height).toBe(888);
    expect(rects.rail.x).toBe(12);
    expect(rects.history.y).toBe(rects.rail.y + rects.rail.height + 8);
  });

  it('covers at most 8 % of a 1440×900 window with nothing open (FR-003)', () => {
    expect(chromeCoverage(DESKTOP, allRects(DESKTOP))).toBeLessThanOrEqual(0.08);
  });

  it.each([
    { width: 1024, height: 768 },
    { width: 1279, height: 800 },
  ])('has no overlapping islands in a compact $width×$height window', (viewport) => {
    const rects = allRects(viewport, true);
    rects.forEach((a, i) => {
      for (const b of rects.slice(i + 1)) expect(intersects(a, b)).toBe(false);
    });
  });

  it('keeps the rail below the top islands in a short window', () => {
    expect(islandRects({ width: 1024, height: 500 }).rail.y).toBe(OVERLAY_TOP);
  });
});

describe('chromeCoverage', () => {
  it('is 0 for an empty viewport', () => {
    expect(chromeCoverage({ width: 0, height: 0 }, [{ x: 0, y: 0, width: 10, height: 10 }])).toBe(
      0,
    );
  });
});

describe('clampDrawerWidth', () => {
  it('keeps the width between 320 and 560', () => {
    expect(clampDrawerWidth(200, 1440)).toBe(320);
    expect(clampDrawerWidth(420, 1440)).toBe(420);
    expect(clampDrawerWidth(900, 1440)).toBe(560);
  });

  it('falls back to the default for NaN', () => {
    expect(clampDrawerWidth(Number.NaN, 1440)).toBe(DRAWER_DEFAULT);
  });

  it('covers at most 35 % of a compact window, never below 320', () => {
    expect(clampDrawerWidth(560, 1279, true)).toBe(447);
    expect(clampDrawerWidth(560, 1024, true)).toBe(358);
    expect(clampDrawerWidth(400, 800, true)).toBe(320);
  });
});

describe('drawerRect', () => {
  it('sits right 12, top 68, bottom 12', () => {
    expect(drawerRect(DESKTOP, 360)).toEqual({ x: 1068, y: 68, width: 360, height: 820 });
  });
});

describe('jsonRect', () => {
  it('spans from the rail to the right edge', () => {
    expect(jsonRect(DESKTOP, 268, null)).toEqual({
      x: FLYOUT_LEFT,
      y: 900 - 12 - 268,
      width: 1440 - 68 - 12,
      height: 268,
    });
  });

  it('stops 12 px before an open drawer', () => {
    const json = jsonRect(DESKTOP, 268, 360);
    expect(json.x + json.width).toBe(drawerRect(DESKTOP, 360).x - 12);
  });

  it('never reaches the top islands', () => {
    expect(jsonRect(DESKTOP, 5000, null).height).toBe(maxJsonHeight(900));
    expect(maxJsonHeight(900)).toBe(900 - 68 - 12);
  });
});

describe('zoomIslandBottom', () => {
  it('moves above an open JSON overlay', () => {
    expect(zoomIslandBottom(false, 268)).toBe(12);
    expect(zoomIslandBottom(true, 268)).toBe(12 + 268 + 8);
  });
});

describe('panToClear', () => {
  const card = { x: 1100, y: 300, width: 164, height: 50 };

  it('pans left so a card clears the drawer', () => {
    expect(panToClear(card, { right: 1068 })).toBe(-(1100 + 164 + 24 - 1068));
  });

  it('pans right so a card clears a flyout', () => {
    expect(panToClear({ ...card, x: 200 }, { left: 348 })).toBe(348 + 24 - 200);
  });

  it('does not pan when the card is already clear', () => {
    expect(panToClear({ ...card, x: 400 }, { left: 348, right: 1068 })).toBe(0);
  });
});

describe('chromeInsets', () => {
  it('reserves the rail, flyout, drawer, player and JSON overlay', () => {
    expect(
      chromeInsets({ flyoutOpen: false, drawerWidth: null, jsonHeight: null, playerShown: false }),
    ).toEqual({ top: 68, right: 12, bottom: 56, left: 68 });
    expect(
      chromeInsets({ flyoutOpen: true, drawerWidth: 360, jsonHeight: null, playerShown: true }),
    ).toEqual({ top: 68, right: 384, bottom: PLAYER_CLEARANCE, left: 348 });
    expect(
      chromeInsets({ flyoutOpen: false, drawerWidth: null, jsonHeight: 268, playerShown: true })
        .bottom,
    ).toBe(12 + 268 + 8 + 44);
  });
});

describe('fitRectInFreeArea', () => {
  const insets = { top: 68, right: 12, bottom: 112, left: 348 };

  it('centres the box in the free area, clear of the flyout', () => {
    const view = fitRectInFreeArea({ x: 0, y: 0, width: 1000, height: 400 }, DESKTOP, insets);
    const left = 0 * view.zoom + view.x;
    const right = 1000 * view.zoom + view.x;
    expect(left).toBeGreaterThanOrEqual(348);
    expect(right).toBeLessThanOrEqual(1440 - 12);
  });

  it('keeps the zoom within the limits', () => {
    expect(fitRectInFreeArea({ x: 0, y: 0, width: 10, height: 10 }, DESKTOP, insets).zoom).toBe(2);
    expect(
      fitRectInFreeArea({ x: 0, y: 0, width: 100000, height: 100000 }, DESKTOP, insets).zoom,
    ).toBe(0.3);
  });

  it('uses the whole canvas when the chrome leaves too little room', () => {
    const view = fitRectInFreeArea(
      { x: 0, y: 0, width: 100, height: 100 },
      { width: 500, height: 300 },
      insets,
    );
    expect(view.x + 50 * view.zoom).toBeCloseTo(250);
  });
});
