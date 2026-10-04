import { describe, expect, it } from 'vitest';

import { deckOf } from '../test/render-canvas';
import {
  effectiveLevel,
  LEVEL_MID_ZOOM,
  LEVEL_NAMES,
  LEVELS,
  levelForZoom,
  levelWithHysteresis,
  nodeLevel,
} from './levels';
import type { Scope } from './visible-graph';

describe('levels', () => {
  it('exports the level constants in widest-to-narrowest order', () => {
    expect(LEVELS).toEqual(['landscape', 'system', 'container', 'component']);
    expect(LEVEL_NAMES).toEqual({
      landscape: 'Landscape',
      system: 'System',
      container: 'Container',
      component: 'Component',
    });
    expect(LEVEL_MID_ZOOM).toEqual({
      landscape: 0.2,
      system: 0.4,
      container: 1.0,
      component: 1.75,
    });
    // Each level's zoom target lies inside its own band.
    for (const level of LEVELS) expect(levelForZoom(LEVEL_MID_ZOOM[level])).toBe(level);
  });

  it('maps whole-percent zoom bands exactly', () => {
    // 051: Landscape ≤ 30 %, System 31–50 %, Container 51–150 %.
    expect(levelForZoom(0.2)).toBe('landscape');
    expect(levelForZoom(0.3)).toBe('landscape');
    expect(levelForZoom(0.31)).toBe('system');
    expect(levelForZoom(0.5)).toBe('system');
    expect(levelForZoom(0.51)).toBe('container');
    expect(levelForZoom(1.5)).toBe('container');
    expect(levelForZoom(1.51)).toBe('component');
    expect(levelForZoom(2)).toBe('component');
  });

  it('holds the current level until zoom is two points past a threshold', () => {
    expect(levelWithHysteresis(0.31, 'landscape')).toBe('landscape');
    expect(levelWithHysteresis(0.32, 'landscape')).toBe('landscape');
    expect(levelWithHysteresis(0.33, 'landscape')).toBe('system');
    expect(levelWithHysteresis(0.29, 'system')).toBe('system');
    expect(levelWithHysteresis(0.28, 'system')).toBe('landscape');

    expect(levelWithHysteresis(0.51, 'system')).toBe('system');
    expect(levelWithHysteresis(0.52, 'system')).toBe('system');
    expect(levelWithHysteresis(0.53, 'system')).toBe('container');
    expect(levelWithHysteresis(0.49, 'container')).toBe('container');
    expect(levelWithHysteresis(0.48, 'container')).toBe('container');
    expect(levelWithHysteresis(0.47, 'container')).toBe('system');

    expect(levelWithHysteresis(1.51, 'container')).toBe('container');
    expect(levelWithHysteresis(1.52, 'container')).toBe('container');
    expect(levelWithHysteresis(1.53, 'container')).toBe('component');
  });

  it('forces component level when drilled into a node', () => {
    const top: Scope = { node: null, group: null };
    const node: Scope = { node: 'svc', group: null };
    expect(effectiveLevel('system', top)).toBe('system');
    expect(effectiveLevel('landscape', node)).toBe('component');
  });

  it('uses node.level first, else derives from parent depth', () => {
    const deck = deckOf({
      nodes: [
        { id: 'root', type: 'service', title: 'Root' } as const,
        { id: 'child', type: 'service', title: 'Child', parent: 'root' } as const,
        { id: 'grandchild', type: 'service', title: 'Grandchild', parent: 'child' } as const,
        { id: 'explicit', type: 'service', title: 'Explicit', level: 'system' as const },
        { id: 'orphan', type: 'service', title: 'Orphan', parent: 'missing' } as const,
        { id: 'cycle-a', type: 'service', title: 'Cycle A', parent: 'cycle-b' } as const,
        { id: 'cycle-b', type: 'service', title: 'Cycle B', parent: 'cycle-a' } as const,
      ],
    });

    expect(nodeLevel(deck, 'root')).toBe('container');
    expect(nodeLevel(deck, 'child')).toBe('component');
    expect(nodeLevel(deck, 'grandchild')).toBe('component');
    expect(nodeLevel(deck, 'explicit')).toBe('system');
    expect(nodeLevel(deck, 'orphan')).toBe('container');
    expect(nodeLevel(deck, 'cycle-a')).toBe('container');
    expect(nodeLevel(deck, 'missing')).toBeUndefined();
  });
});
