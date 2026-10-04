import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { useReactFlow, useStoreApi } from '@xyflow/react';
import { useCallback } from 'react';

import { rowAnchorY, type TableLayout } from '../table-layout';

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** Whether flow point `point` is inside the canvas box under `viewport`, `margin` px from the edges. */
export function pointInView(
  point: { x: number; y: number },
  viewport: Viewport,
  size: { width: number; height: number },
  margin = 48,
): boolean {
  const x = point.x * viewport.zoom + viewport.x;
  const y = point.y * viewport.zoom + viewport.y;
  return x >= margin && y >= margin && x <= size.width - margin && y <= size.height - margin;
}

/** The flow point at the middle of a column's row (or its stand-in), from the card's box. */
export function rowPoint(
  box: { x: number; y: number },
  layout: TableLayout,
  columnId: string,
): { x: number; y: number } {
  return { x: box.x + layout.width / 2, y: box.y + rowAnchorY(layout, columnId).y };
}

/**
 * Pans the canvas to a row when it is outside the viewport (048: filter matches, Jump to). The zoom
 * is kept; the animation is skipped under reduced motion. A node React Flow has not measured yet
 * is left alone.
 */
export function useRevealRow(): (nodeId: string, layout: TableLayout, columnId: string) => void {
  const { getInternalNode, getViewport, setCenter } = useReactFlow();
  const store = useStoreApi();
  const reduced = useReducedMotion();
  return useCallback(
    (nodeId, layout, columnId) => {
      const node = getInternalNode(nodeId);
      if (node === undefined) return;
      const point = rowPoint(node.internals.positionAbsolute, layout, columnId);
      const viewport = getViewport();
      const { width, height } = store.getState();
      if (pointInView(point, viewport, { width, height })) return;
      void setCenter(point.x, point.y, { zoom: viewport.zoom, duration: reduced ? 0 : 200 });
    },
    [getInternalNode, getViewport, setCenter, store, reduced],
  );
}
