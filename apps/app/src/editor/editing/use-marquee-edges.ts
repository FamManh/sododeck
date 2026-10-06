/**
 * Connectors in the marquee. React Flow's marquee selects nodes only; while one runs this hook
 * follows its rectangle (`userSelectionRect` in React Flow's store, committed on every pointer
 * move and auto-pan) and adds every connector the rectangle touches to the selection. Unlike
 * cards (wholly inside, or touched with ⌥, 016 R13), a connector only has to be touched: lines
 * run across the canvas between cards, so one rarely fits inside a marquee.
 *
 * The paths are read from the rendered `.react-flow__edge-path` elements' `d`, in flow
 * coordinates. That is the exact line the user sees (routes, bends, anchors, fans, relationship
 * rows) without re-running the routing, and only drawn connectors can be caught, which is what a
 * marquee over the visible canvas means. Each `d` is flattened once per marquee (cached by its
 * text) and the element list is re-read only when the viewport moves, so a pointer move costs a
 * bounds check per connector plus segment tests for the few near the rectangle; no layout reads
 * (`getPointAtLength` would force one per connector per move).
 */
import { useStoreApi } from '@xyflow/react';
import { useEffect } from 'react';

import { readDeck } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { selectionSize } from '../../state/selection-kinds';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import {
  edgeShapeOf,
  edgesInRect,
  marqueeEdgeSelection,
  screenRectToFlow,
  type EdgeShape,
} from './marquee-edges';

/** Flattened paths by connector id, kept for one marquee. */
export interface CachedShape {
  d: string;
  shape: EdgeShape;
}

/**
 * The drawn connectors under `root` whose id passes `selectable`, flattened. Ids that are not
 * document connectors (bundles, merged lines, sticky leaders) are left out by `selectable`.
 */
export function renderedEdgeShapes(
  root: ParentNode,
  selectable: (id: string) => boolean,
  cache: Map<string, CachedShape>,
): { id: string; shape: EdgeShape }[] {
  const shapes: { id: string; shape: EdgeShape }[] = [];
  for (const element of root.querySelectorAll('.react-flow__edge[data-id]')) {
    const id = element.getAttribute('data-id');
    if (id === null || !selectable(id)) continue;
    const d = element.querySelector('path.react-flow__edge-path')?.getAttribute('d') ?? null;
    if (d === null) continue;
    let cached = cache.get(id);
    if (cached?.d !== d) {
      cached = { d, shape: edgeShapeOf(d) };
      cache.set(id, cached);
    }
    shapes.push({ id, shape: cached.shape });
  }
  return shapes;
}

export function useMarqueeEdges(active: boolean): void {
  const editor = useEditor();
  const store = useStoreApi();

  useEffect(() => {
    if (!active || isFlowMode(useUiStore.getState())) return;
    const before = useUiStore.getState().selection.edges;
    const ids = new Set(readDeck(editor.doc).edges.map((edge) => edge.id));
    const selectable = (id: string) => ids.has(id);
    const cache = new Map<string, CachedShape>();
    let shapes: { id: string; shape: EdgeShape }[] | null = null;
    let shapesAt: readonly number[] | null = null;
    let lastHit = '';

    const update = () => {
      // Esc ends the marquee before React Flow stops reporting the rectangle (pointer up).
      if (useUiStore.getState().canvasGesture !== 'marquee') return;
      const { userSelectionRect, transform, domNode } = store.getState();
      if (userSelectionRect === null || domNode === null) return;
      if (shapes === null || shapesAt !== transform) {
        shapes = renderedEdgeShapes(domNode, selectable, cache);
        shapesAt = transform;
      }
      const rect = screenRectToFlow(userSelectionRect, transform);
      const hit = edgesInRect(shapes, rect, 'partial');
      const key = hit.join(' ');
      if (key === lastHit) return;
      lastHit = key;
      const ui = useUiStore.getState();
      const edges = marqueeEdgeSelection(before, hit);
      const next = { ...ui.selection, edges };
      ui.select(next);
      ui.setMarqueeCount(selectionSize(next));
    };

    update();
    return store.subscribe((state, previous) => {
      if (
        state.userSelectionRect !== previous.userSelectionRect ||
        state.transform !== previous.transform
      ) {
        update();
      }
    });
  }, [active, editor, store]);
}
