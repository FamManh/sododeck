import { describe, expect, it } from 'vitest';

import type { EndpointPreview } from '../../state/ui-store';
import { withEndPreview, type DrawnEnds } from './end-override';

const base: DrawnEnds = {
  fromBox: { x: 0, y: 0, width: 160, height: 50 },
  toBox: { x: 400, y: 200, width: 160, height: 50 },
  sides: ['right', 'left'],
  route: undefined,
};

const preview = (patch: Partial<EndpointPreview>): EndpointPreview => ({
  edgeId: 'e',
  end: 'target',
  targetId: 'b',
  targetKind: 'node',
  box: { x: 400, y: 200, width: 160, height: 50 },
  side: 'top',
  at: 0.3,
  point: { x: 448, y: 200 },
  snapped: false,
  automatic: false,
  valid: 'ok',
  ...patch,
});

describe('withEndPreview (050 R3)', () => {
  it('pins the dragged end on its own card at the live side and position', () => {
    const drawn = withEndPreview(base, preview({}), { source: 'a', target: 'b' });
    expect(drawn.route).toEqual({ toSide: 'top', toAt: 0.3 });
    expect(drawn.sides).toEqual(['right', 'top']);
    expect(drawn.toBox).toEqual(base.toBox);
  });

  it('pins the source end the same way, keeping the other end', () => {
    const drawn = withEndPreview(
      { ...base, route: { toSide: 'left', toAt: 0.8 } },
      preview({ end: 'source', targetId: 'a', box: base.fromBox, side: 'bottom', at: 0.6 }),
      { source: 'a', target: 'b' },
    );
    expect(drawn.route).toEqual({ fromSide: 'bottom', fromAt: 0.6, toSide: 'left', toAt: 0.8 });
    expect(drawn.sides).toEqual(['bottom', 'left']);
  });

  it('automatic drops the pin and resolves the side again', () => {
    const drawn = withEndPreview(
      { ...base, route: { toSide: 'top', toAt: 0.2 }, sides: ['right', 'top'] },
      preview({ automatic: true }),
      { source: 'a', target: 'b' },
    );
    expect(drawn.route).toBeUndefined();
    expect(drawn.sides).toEqual(['right', 'left']);
  });

  it('off every target, the end follows the free point', () => {
    const drawn = withEndPreview(
      base,
      preview({
        targetId: null,
        targetKind: null,
        box: null,
        point: { x: 900, y: 40 },
        valid: 'none',
      }),
      { source: 'a', target: 'b' },
    );
    expect(drawn.toBox).toEqual({ x: 900, y: 40, width: 0, height: 0 });
    expect(drawn.route).toBeUndefined();
    expect(drawn.sides).toEqual(['right', 'left']);
  });

  it('another target uses its box and outline, and drops 017 offsets', () => {
    const drawn = withEndPreview(
      { ...base, route: { offset: 30 }, toGeometry: 'ellipse' },
      preview({
        targetId: 'c',
        box: { x: 400, y: -200, width: 176, height: 112 },
        geometry: 'diamond',
        side: 'bottom',
        at: 0.25,
      }),
      { source: 'a', target: 'b' },
    );
    expect(drawn.toBox).toEqual({ x: 400, y: -200, width: 176, height: 112 });
    expect(drawn.toGeometry).toBe('diamond');
    expect(drawn.route).toEqual({ toSide: 'bottom', toAt: 0.25 });
  });

  it('bends keep facing: with waypoints the automatic side faces the last bend', () => {
    const drawn = withEndPreview(
      { ...base, route: { toSide: 'left', waypoints: [{ x: 0.5, y: 3 }] } },
      preview({ automatic: true }),
      { source: 'a', target: 'b' },
    );
    expect(drawn.route).toEqual({ waypoints: [{ x: 0.5, y: 3 }] });
    // the bend sits far below both cards, so the target end faces down
    expect(drawn.sides[1]).toBe('bottom');
  });
});
