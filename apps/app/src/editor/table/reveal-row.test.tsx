import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TableLayout } from '../table-layout';
import { pointInView, useRevealRow } from './reveal-row';

const setCenter = vi.fn();
let reduced = false;

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    getInternalNode: () => ({ internals: { positionAbsolute: { x: 5000, y: 5000 } } }),
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    setCenter,
  }),
  useStoreApi: () => ({ getState: () => ({ width: 800, height: 600 }) }),
}));
vi.mock('@sododeck/ui/hooks/use-reduced-motion', () => ({ useReducedMotion: () => reduced }));
vi.mock('../table-layout', () => ({ rowAnchorY: () => ({ y: 40, kind: 'row' }) }));

const layout = { width: 200 } as unknown as TableLayout;

describe('pointInView', () => {
  it('keeps a margin from the edges', () => {
    const size = { width: 800, height: 600 };
    expect(pointInView({ x: 400, y: 300 }, { x: 0, y: 0, zoom: 1 }, size)).toBe(true);
    expect(pointInView({ x: 10, y: 300 }, { x: 0, y: 0, zoom: 1 }, size)).toBe(false);
  });
});

describe('useRevealRow pans (048 accessibility)', () => {
  beforeEach(() => {
    setCenter.mockClear();
  });

  it('animates the pan to a row outside the view', () => {
    reduced = false;
    renderHook(() => useRevealRow()).result.current('t1', layout, 'c1');
    expect(setCenter).toHaveBeenCalledWith(5100, 5040, { zoom: 1, duration: 200 });
  });

  it('jumps without animation under reduced motion', () => {
    reduced = true;
    renderHook(() => useRevealRow()).result.current('t1', layout, 'c1');
    expect(setCenter).toHaveBeenCalledWith(5100, 5040, { zoom: 1, duration: 0 });
  });
});
