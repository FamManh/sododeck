import { describe, expect, it } from 'vitest';

import { isRegionId, nextRegion, REGION_ORDER, visibleRegions } from './regions';

describe('visibleRegions', () => {
  it('follows frame 115 and adds the drawer only when it is open', () => {
    expect(REGION_ORDER).toEqual([
      'deck',
      'tools',
      'rail',
      'history',
      'canvas',
      'zoom',
      'drawer',
      'code',
    ]);
    expect(visibleRegions({ hideUi: false, drawerOpen: false })).not.toContain('drawer');
    expect(visibleRegions({ hideUi: false, drawerOpen: true })).toContain('drawer');
  });

  it('adds the code drawer (054) only when it is open, after the details drawer', () => {
    expect(visibleRegions({ hideUi: false, drawerOpen: false })).not.toContain('code');
    expect(visibleRegions({ hideUi: false, drawerOpen: true, codeOpen: true }).slice(-2)).toEqual([
      'drawer',
      'code',
    ]);
    expect(visibleRegions({ hideUi: true, drawerOpen: true, codeOpen: true })).toEqual([
      'canvas',
      'show-ui',
    ]);
    expect(isRegionId('code')).toBe(true);
  });

  it('keeps only the canvas and the Show UI button under Hide UI', () => {
    expect(visibleRegions({ hideUi: true, drawerOpen: true })).toEqual(['canvas', 'show-ui']);
  });
});

describe('nextRegion', () => {
  const closed = visibleRegions({ hideUi: false, drawerOpen: false });
  const open = visibleRegions({ hideUi: false, drawerOpen: true });

  it('moves forward and wraps', () => {
    expect(nextRegion('canvas', closed, 1)).toBe('zoom');
    expect(nextRegion('zoom', closed, 1)).toBe('deck');
    expect(nextRegion('zoom', open, 1)).toBe('drawer');
    expect(nextRegion('drawer', open, 1)).toBe('deck');
  });

  it('moves backward and wraps', () => {
    expect(nextRegion('deck', closed, -1)).toBe('zoom');
    expect(nextRegion('deck', open, -1)).toBe('drawer');
    expect(nextRegion('canvas', closed, -1)).toBe('history');
  });

  it('visits every visible region once per cycle', () => {
    const seen: string[] = [];
    let region = nextRegion(null, open, 1);
    for (let i = 0; i < open.length; i++) {
      seen.push(region);
      region = nextRegion(region, open, 1);
    }
    expect(new Set(seen).size).toBe(open.length);
  });

  it('goes to the canvas from outside any region or from a hidden one', () => {
    expect(nextRegion(null, closed, 1)).toBe('canvas');
    expect(nextRegion('drawer', closed, 1)).toBe('canvas');
  });

  it('alternates canvas and Show UI under Hide UI', () => {
    const hidden = visibleRegions({ hideUi: true, drawerOpen: false });
    expect(nextRegion('canvas', hidden, 1)).toBe('show-ui');
    expect(nextRegion('show-ui', hidden, 1)).toBe('canvas');
  });
});

describe('isRegionId', () => {
  it('accepts region ids only', () => {
    expect(isRegionId('rail')).toBe(true);
    expect(isRegionId('show-ui')).toBe(true);
    expect(isRegionId('sidebar')).toBe(false);
    expect(isRegionId(undefined)).toBe(false);
  });
});
