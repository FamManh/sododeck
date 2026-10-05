import { act, renderHook } from '@testing-library/react';
import { useStoreApi } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { renderedEdgeShapes, useMarqueeEdges, type CachedShape } from './use-marquee-edges';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'database', title: 'B', position: { x: 300, y: 0 } },
    { id: 'c', type: 'queue', title: 'C', position: { x: 0, y: 200 } },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b' },
    { id: 'e2', from: 'a', to: 'c' },
    { id: 'e3', from: 'b', to: 'c' },
  ],
});

const ui = () => useUiStore.getState();

/** A pane with drawn connectors as React Flow renders them: `g.react-flow__edge[data-id]`. */
function pane(paths: Record<string, string>): HTMLElement {
  const root = document.createElement('div');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [id, d] of Object.entries(paths)) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'react-flow__edge');
    g.setAttribute('data-id', id);
    const halo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    halo.setAttribute('d', 'M 0 0 L 9999 9999');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'react-flow__edge-path');
    path.setAttribute('d', d);
    g.append(halo, path);
    svg.append(g);
  }
  root.append(svg);
  return root;
}

// e1 runs along y = 25 from a to b; e2 down x = 82 from a to c; e3 diagonally b → c;
// `sticky-leader:n` is a drawn line that is not a document connector.
const drawn = {
  e1: 'M 164 25 L 300 25',
  e2: 'M 82 50 L 82 200',
  e3: 'M 300 50 C 300 120 164 130 164 225',
  'sticky-leader:n': 'M 170 20 L 290 20',
};

describe('renderedEdgeShapes', () => {
  it('reads each selectable connector path once, keyed by its text', () => {
    const root = pane(drawn);
    const cache = new Map<string, CachedShape>();
    const shapes = renderedEdgeShapes(root, (id) => id.startsWith('e'), cache);
    expect(shapes.map((s) => s.id)).toEqual(['e1', 'e2', 'e3']);
    expect(shapes[0]?.shape.points[0]).toEqual({ x: 164, y: 25 });
    const again = renderedEdgeShapes(root, (id) => id.startsWith('e'), cache);
    expect(again[0]?.shape).toBe(shapes[0]?.shape);
  });
});

function setup() {
  const env = editorWrapper(deck);
  const { result, rerender } = renderHook(
    ({ active, touch }: { active: boolean; touch: boolean }) => {
      useMarqueeEdges(active, touch);
      return useStoreApi();
    },
    { wrapper: env.wrapper, initialProps: { active: false, touch: false } },
  );
  const store = result.current;
  act(() => {
    store.setState({ domNode: pane(drawn) as HTMLDivElement, transform: [0, 0, 1] });
  });
  const start = (touch = false) => {
    act(() => {
      ui().setCanvasGesture('marquee');
    });
    rerender({ active: true, touch });
  };
  const drag = (x: number, y: number, width: number, height: number) => {
    act(() => {
      store.setState({ userSelectionRect: { startX: x, startY: y, x, y, width, height } });
    });
  };
  const end = () => {
    act(() => {
      ui().setCanvasGesture(null);
      store.setState({ userSelectionRect: null });
    });
    rerender({ active: false, touch: false });
  };
  return { store, start, drag, end };
}

describe('useMarqueeEdges (connectors in the marquee)', () => {
  it('selects connectors wholly inside the marquee, alongside the cards, and counts them', () => {
    const { start, drag, end } = setup();
    act(() => {
      ui().select({ nodes: ['a'] });
    });
    start();
    // Across e1 only: from just left of its start to past its end, not over the cards.
    drag(160, 10, 150, 30);
    expect(ui().selection.edges).toEqual(['e1']);
    expect(ui().selection.nodes).toEqual(['a']);
    expect(ui().marqueeCount).toBe(2);
    // Shrunk so e1 sticks out: no longer caught.
    drag(160, 10, 100, 30);
    expect(ui().selection.edges).toEqual([]);
    expect(ui().marqueeCount).toBe(1);
    end();
    expect(ui().selection.nodes).toEqual(['a']);
  });

  it('with ⌥ (touch), selects every connector the marquee cuts', () => {
    const { start, drag } = setup();
    start(true);
    drag(60, 60, 200, 60);
    expect(ui().selection.edges).toEqual(['e2', 'e3']);
    expect(ui().marqueeCount).toBe(2);
  });

  it('keeps the connectors selected before the marquee and skips lines that are not connectors', () => {
    const { start, drag } = setup();
    act(() => {
      ui().select({ edges: ['e3'] });
    });
    start(true);
    // Cuts e1 and the sticky leader line just above it.
    drag(200, 15, 20, 20);
    expect(ui().selection.edges).toEqual(['e3', 'e1']);
  });

  it('follows the viewport: the rectangle is in pane pixels', () => {
    const { store, start, drag } = setup();
    act(() => {
      store.setState({ transform: [100, 100, 2] });
    });
    start(true);
    // Pane (400..440, 140..170) is flow (150..170, 20..35): it cuts e1.
    drag(400, 140, 40, 30);
    expect(ui().selection.edges).toEqual(['e1']);
  });

  it('does nothing once the marquee is cancelled', () => {
    const { start, drag } = setup();
    start(true);
    act(() => {
      ui().setCanvasGesture(null);
    });
    drag(60, 60, 200, 60);
    expect(ui().selection.edges).toEqual([]);
  });
});
