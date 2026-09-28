import { describe, expect, it } from 'vitest';

import { toolbarPlacement } from './toolbar-placement';

const viewport = { width: 1440, height: 900 };
const size = { width: 300, height: 44 };
const rect = (x: number, y: number, width = 164, height = 50) => ({ x, y, width, height });

describe('toolbarPlacement', () => {
  it('centres 12 px above the selection', () => {
    expect(toolbarPlacement(rect(600, 400), size, viewport)).toEqual({
      x: 600 + 82 - 150,
      y: 400 - 12 - 44,
      side: 'above',
    });
  });

  it('flips 12 px below when it would come within 68 px of the top', () => {
    expect(toolbarPlacement(rect(600, 100), size, viewport)).toEqual({
      x: 532,
      y: 100 + 50 + 12,
      side: 'below',
    });
    expect(toolbarPlacement(rect(600, 124), size, viewport).side).toBe('above');
  });

  it('clamps inside the window edges', () => {
    expect(toolbarPlacement(rect(0, 400), size, viewport).x).toBe(12);
    expect(toolbarPlacement(rect(1400, 400), size, viewport).x).toBe(1440 - 12 - 300);
  });

  it('centres on a wide rect, and keeps a toolbar wider than the window at the left edge', () => {
    // Centre of a 3000 px rect from -500 is 1000: the toolbar is centred there.
    expect(toolbarPlacement(rect(-500, 400, 3000), size, viewport).x).toBe(850);
    expect(toolbarPlacement(rect(-500, 400, 3000), { width: 2000, height: 44 }, viewport).x).toBe(
      12,
    );
  });
});
