import { describe, expect, it } from 'vitest';

import {
  edgeInRect,
  edgeShapeOf,
  edgesInRect,
  marqueeEdgeSelection,
  screenRectToFlow,
  segmentHitsRect,
} from './marquee-edges';

const rect = { x: 0, y: 0, width: 100, height: 100 };

describe('segmentHitsRect', () => {
  it('is true for a segment inside, crossing or touching the rectangle', () => {
    expect(segmentHitsRect({ x: 10, y: 10 }, { x: 20, y: 20 }, rect)).toBe(true);
    expect(segmentHitsRect({ x: -50, y: 50 }, { x: 150, y: 50 }, rect)).toBe(true);
    expect(segmentHitsRect({ x: -10, y: 0 }, { x: 0, y: 0 }, rect)).toBe(true);
  });

  it('is false for a segment that passes by', () => {
    expect(segmentHitsRect({ x: 110, y: -10 }, { x: 210, y: 90 }, rect)).toBe(false);
    // Crosses both axes' ranges but misses the corner.
    expect(segmentHitsRect({ x: 90, y: 130 }, { x: 130, y: 90 }, rect)).toBe(false);
    expect(segmentHitsRect({ x: 150, y: 150 }, { x: 150, y: 150 }, rect)).toBe(false);
  });
});

describe('edgeInRect', () => {
  const across = edgeShapeOf('M -50 50 L 150 50');
  const inside = edgeShapeOf('M 10 10 L 90 90');
  const curve = edgeShapeOf('M 0 50 C 0 -200 100 -200 100 50');

  it('partial: any part of the path inside the rectangle', () => {
    expect(edgeInRect(across, rect, 'partial')).toBe(true);
    expect(edgeInRect(inside, rect, 'partial')).toBe(true);
    expect(edgeInRect(edgeShapeOf('M 200 0 L 300 0'), rect, 'partial')).toBe(false);
  });

  it('full: the whole path, curves included, inside the rectangle', () => {
    expect(edgeInRect(inside, rect, 'full')).toBe(true);
    expect(edgeInRect(across, rect, 'full')).toBe(false);
    // Its ends are inside but the curve bulges out above.
    expect(edgeInRect(curve, rect, 'full')).toBe(false);
    expect(edgeInRect(curve, { x: -10, y: -200, width: 120, height: 260 }, 'full')).toBe(true);
  });

  it('never hits an empty path', () => {
    expect(edgeInRect(edgeShapeOf(''), rect, 'partial')).toBe(false);
    expect(edgeInRect(edgeShapeOf(''), rect, 'full')).toBe(false);
  });

  it('samples curves: a curve that only its bulge carries into the rectangle is hit', () => {
    const arc = edgeShapeOf('M -100 300 Q 50 -200 200 300');
    expect(edgeInRect(arc, rect, 'partial')).toBe(true);
  });
});

describe('edgesInRect', () => {
  it('returns the ids hit, in order', () => {
    const shapes = [
      { id: 'a', shape: edgeShapeOf('M -50 50 L 150 50') },
      { id: 'b', shape: edgeShapeOf('M 200 0 L 300 0') },
      { id: 'c', shape: edgeShapeOf('M 10 10 L 20 20') },
    ];
    expect(edgesInRect(shapes, rect, 'partial')).toEqual(['a', 'c']);
    expect(edgesInRect(shapes, rect, 'full')).toEqual(['c']);
  });
});

describe('screenRectToFlow', () => {
  it('undoes the pan and zoom', () => {
    expect(screenRectToFlow({ x: 120, y: 40, width: 200, height: 100 }, [20, -60, 2])).toEqual({
      x: 50,
      y: 50,
      width: 100,
      height: 50,
    });
  });
});

describe('marqueeEdgeSelection', () => {
  it('adds the hit connectors to the ones selected before the marquee, once each', () => {
    expect(marqueeEdgeSelection(['x', 'a'], ['a', 'b'])).toEqual(['x', 'a', 'b']);
    expect(marqueeEdgeSelection([], [])).toEqual([]);
  });
});
