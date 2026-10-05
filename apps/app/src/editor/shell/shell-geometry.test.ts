import { describe, expect, it } from 'vitest';

import {
  chromeCoverage,
  chromeInsets,
  fitRectInFreeArea,
  PLAYER_CLEARANCE,
  clampCodeDrawerWidth,
  drawersFitTogether,
  drawerStackWidth,
  clampDrawerWidth,
  CODE_DRAWER_DEFAULT,
  DRAWER_DEFAULT,
  drawerRect,
  EDGE,
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

describe('clampCodeDrawerWidth', () => {
  it('stays between 320 and 70 % of the viewport with no details drawer', () => {
    expect(clampCodeDrawerWidth(100, 1440, null, false)).toBe(320);
    expect(clampCodeDrawerWidth(700, 1440, null, false)).toBe(700);
    expect(clampCodeDrawerWidth(5000, 1440, null, false)).toBe(1007);
  });

  it('leaves a 240 px canvas strip when the details drawer is open', () => {
    // 1440 - 68 (flyout left) - 360 (details) - 24 (two gaps) - 240 = 748
    expect(clampCodeDrawerWidth(5000, 1440, 360, false)).toBe(748);
    expect(clampCodeDrawerWidth(600, 1440, 360, false)).toBe(600);
  });

  it('uses the 35 % share in a compact window', () => {
    expect(clampCodeDrawerWidth(5000, 1200, null, true)).toBe(420);
  });

  it('never goes below 320, even when there is no room', () => {
    expect(clampCodeDrawerWidth(400, 900, 560, false)).toBe(320);
    expect(clampCodeDrawerWidth(400, 800, null, true)).toBe(320);
  });

  it('falls back to the default for a non-finite width', () => {
    expect(clampCodeDrawerWidth(Number.NaN, 1440, null, false)).toBe(CODE_DRAWER_DEFAULT);
    expect(CODE_DRAWER_DEFAULT).toBe(560);
  });
});

describe('drawersFitTogether', () => {
  it('never in a compact window', () => {
    expect(drawersFitTogether(1279, 320, true)).toBe(false);
  });

  it('while the code drawer can keep 320 px and the canvas 240 px', () => {
    // 1440 - 68 - 360 - 24 - 240 = 748 ≥ 320
    expect(drawersFitTogether(1440, 360, false)).toBe(true);
    // 1100 - 68 - 560 - 24 - 240 = 208 < 320
    expect(drawersFitTogether(1100, 560, false)).toBe(false);
  });
});

describe('drawerStackWidth', () => {
  it('is null with no drawer, one width alone, and adds the gap for two', () => {
    expect(drawerStackWidth(null, null)).toBeNull();
    expect(drawerStackWidth(360, null)).toBe(360);
    expect(drawerStackWidth(null, 560)).toBe(560);
    expect(drawerStackWidth(360, 560)).toBe(932);
  });

  it('keeps the rail, the drawers and a canvas strip apart at 1440 with a 900 px code drawer', () => {
    const code = clampCodeDrawerWidth(900, 1440, 360, false);
    const stack = drawerStackWidth(360, code);
    expect(stack).not.toBeNull();
    const left = 1440 - 12 - (stack ?? 0);
    // The code drawer's left edge, which is the canvas strip's right edge.
    expect(left - FLYOUT_LEFT).toBeGreaterThanOrEqual(240);
  });
});

describe('both drawers over the islands (054 FR-018)', () => {
  it.each([1280, 1440, 1920, 2560])(
    'at %i px the widest code drawer clears the rail, the islands and keeps a canvas strip',
    (width) => {
      const viewport = { width, height: 900 };
      const details = 360;
      const code = clampCodeDrawerWidth(5000, width, details, false);
      const stack = drawerStackWidth(details, code) ?? 0;
      const codeRect: Rect = {
        x: width - EDGE - stack,
        y: OVERLAY_TOP,
        width: code,
        height: viewport.height - OVERLAY_TOP - EDGE,
      };
      const detailsRect = drawerRect(viewport, details);
      const rects = islandRects(viewport);
      for (const island of [rects.deck, rects.tools, rects.rail, rects.history]) {
        expect(intersects(codeRect, island), 'code drawer').toBe(false);
        expect(intersects(detailsRect, island), 'details drawer').toBe(false);
      }
      expect(intersects(codeRect, detailsRect)).toBe(false);
      expect(codeRect.x - FLYOUT_LEFT).toBeGreaterThanOrEqual(240);
    },
  );

  it('opens one at a time in a compact window', () => {
    expect(drawersFitTogether(1100, 360, true)).toBe(false);
    expect(clampCodeDrawerWidth(900, 1100, null, true)).toBe(385);
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
