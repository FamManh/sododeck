import { getSmoothStepPath, Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { middleSegment, nearestSide, resolveSides, routedStepPath, type Box } from './route-path';

const near: Box = { x: 0, y: 0, width: 160, height: 50 };
const far = (x: number, y: number, width = 160, height = 50): Box => ({ x, y, width, height });

describe('resolveSides', () => {
  it('picks sides by comparing centres, same as facingSides for equal-size cards', () => {
    expect(resolveSides(near, far(300, 0))).toEqual(['right', 'left']);
    expect(resolveSides(near, far(-300, 0))).toEqual(['left', 'right']);
    expect(resolveSides(near, far(0, 300))).toEqual(['bottom', 'top']);
    expect(resolveSides(near, far(0, -300))).toEqual(['top', 'bottom']);
  });

  it('a pinned side from the route wins over the computed one', () => {
    expect(resolveSides(near, far(300, 0), { fromSide: 'top' })).toEqual(['top', 'left']);
    expect(resolveSides(near, far(300, 0), { toSide: 'bottom' })).toEqual(['right', 'bottom']);
    expect(resolveSides(near, far(300, 0), { fromSide: 'top', toSide: 'bottom' })).toEqual([
      'top',
      'bottom',
    ]);
  });
});

describe('middleSegment', () => {
  const sides: [string, string][] = [
    ['top', 'top'],
    ['top', 'right'],
    ['top', 'bottom'],
    ['top', 'left'],
    ['right', 'top'],
    ['right', 'right'],
    ['right', 'bottom'],
    ['right', 'left'],
    ['bottom', 'top'],
    ['bottom', 'right'],
    ['bottom', 'bottom'],
    ['bottom', 'left'],
    ['left', 'top'],
    ['left', 'right'],
    ['left', 'bottom'],
    ['left', 'left'],
  ];

  it.each(sides)('%s → %s', (from, to) => {
    const axis = middleSegment([from, to] as [never, never]);
    if ((from === 'top' && to === 'bottom') || (from === 'bottom' && to === 'top')) {
      expect(axis).toBe('vertical');
    } else if ((from === 'left' && to === 'right') || (from === 'right' && to === 'left')) {
      expect(axis).toBe('horizontal');
    } else {
      expect(axis).toBeNull();
    }
  });
});

describe('nearestSide', () => {
  it('picks the closest edge of the box to the point', () => {
    const box: Box = { x: 100, y: 100, width: 160, height: 50 };
    expect(nearestSide(box, { x: 101, y: 120 })).toBe('left');
    expect(nearestSide(box, { x: 259, y: 120 })).toBe('right');
    expect(nearestSide(box, { x: 150, y: 101 })).toBe('top');
    expect(nearestSide(box, { x: 150, y: 149 })).toBe('bottom');
  });
});

describe('routedStepPath', () => {
  const common = { sourceX: 0, sourceY: 0, targetX: 300, targetY: 0 };

  it('with no route, equals getSmoothStepPath exactly', () => {
    const [path, labelX, labelY] = getSmoothStepPath({
      ...common,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      borderRadius: 8,
    });
    const routed = routedStepPath({ ...common, sides: ['right', 'left'] });
    expect(routed).toEqual({ path, labelX, labelY, segment: expect.any(Object) as unknown });
    expect(routed.path).toBe(path);
    expect(routed.labelX).toBe(labelX);
    expect(routed.labelY).toBe(labelY);
  });

  it('offset on a vertical pair (top/bottom) moves the middle segment and labelY', () => {
    const vertical = { sourceX: 0, sourceY: 0, targetX: 0, targetY: 300 };
    const base = routedStepPath({ ...vertical, sides: ['bottom', 'top'] });
    const routed = routedStepPath({ ...vertical, sides: ['bottom', 'top'], offset: 60 });
    expect(routed.labelY).toBe(base.labelY + 60);
    expect(routed.segment).toMatchObject({ axis: 'vertical', at: base.labelY + 60 });
    expect(routed.path).not.toBe(base.path);
  });

  it('offset on a horizontal pair (left/right) moves the middle segment and labelX', () => {
    const base = routedStepPath({ ...common, sides: ['right', 'left'] });
    const routed = routedStepPath({ ...common, sides: ['right', 'left'], offset: 60 });
    expect(routed.labelX).toBe(base.labelX + 60);
    expect(routed.segment).toMatchObject({ axis: 'horizontal', at: base.labelX + 60 });
    expect(routed.path).not.toBe(base.path);
  });

  it('ignores the offset on a perpendicular or same-side pair, and segment is null', () => {
    const perpendicular = routedStepPath({ ...common, sides: ['right', 'top'], offset: 60 });
    const sameSide = routedStepPath({ ...common, sides: ['right', 'right'], offset: 60 });
    expect(perpendicular.segment).toBeNull();
    expect(sameSide.segment).toBeNull();
    expect(perpendicular).toEqual(
      routedStepPath({ ...common, sides: ['right', 'top'], offset: 0 }),
    );
    expect(sameSide).toEqual(routedStepPath({ ...common, sides: ['right', 'right'], offset: 0 }));
  });
});
