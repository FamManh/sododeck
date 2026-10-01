import { toJSON } from '@sododeck/model';
import { act, fireEvent, renderHook } from '@testing-library/react';
import type { Edge } from '@xyflow/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, editorWrapper } from '../test/render-canvas';
import { useCanvasHandlers } from './use-canvas-handlers';

// a(0,0) b(300,0) c(0,200) d(300,200), each 164×50 at their display position (017 R12).
const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'database', title: 'B', position: { x: 300, y: 0 } },
    { id: 'c', type: 'queue', title: 'C', position: { x: 0, y: 200 } },
    { id: 'd', type: 'client', title: 'D', position: { x: 300, y: 200 } },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b' },
    { id: 'e2', from: 'b', to: 'c', route: { offset: 20 } },
  ],
});

const ui = () => useUiStore.getState();

function handlers(file = deck) {
  const env = editorWrapper(file);
  const { result } = renderHook(() => useCanvasHandlers(), { wrapper: env.wrapper });
  return { ...env, h: () => result.current };
}

const flowEdge = (id: string) => ({ id }) as Edge;

/** Starts the gesture, moves the pointer to `point`, and returns a cleanup. */
function dragTo(
  h: () => ReturnType<typeof useCanvasHandlers>,
  edge: Edge,
  point: { x: number; y: number },
) {
  act(() => {
    h().onReconnectStart({ clientX: 0, clientY: 0 } as unknown as ReactMouseEvent, edge, 'target');
  });
  act(() => {
    fireEvent.mouseMove(window, { clientX: point.x, clientY: point.y });
  });
}

describe('use-canvas-handlers: reconnect pins a side (017 R12)', () => {
  it('pins the moved end to the nearest side of the drop point, same card', () => {
    const { h, doc } = handlers();
    // b's box is x:300 y:0 w:164 h:50; a point just inside its left edge is nearest the left side.
    dragTo(h, flowEdge('e1'), { x: 302, y: 25 });
    expect(ui().endpointHover).toEqual({ nodeId: 'b', side: 'left' });
    act(() => {
      h().onReconnect(
        { id: 'e1', source: 'a', target: 'b' },
        { source: 'a', target: 'b', sourceHandle: null, targetHandle: 'left' },
      );
    });
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route).toEqual({ toSide: 'left' });
    expect(ui().announcement.text).toBe('Connection now enters from the left');
    act(() => {
      h().onReconnectEnd();
    });
    expect(ui().endpointHover).toBeNull();
    expect(ui().canvasGesture).toBeNull();
  });

  it('pins the source side and announces "leaves from"', () => {
    const { h, doc } = handlers();
    // a's box is x:0 y:0 w:164 h:50; a point just inside its top edge is nearest the top side.
    dragTo(h, flowEdge('e1'), { x: 80, y: 2 });
    expect(ui().endpointHover).toEqual({ nodeId: 'a', side: 'top' });
    act(() => {
      h().onReconnectStart(
        { clientX: 0, clientY: 0 } as unknown as ReactMouseEvent,
        flowEdge('e1'),
        'source',
      );
      fireEvent.mouseMove(window, { clientX: 80, clientY: 2 });
    });
    act(() => {
      h().onReconnect(
        { id: 'e1', source: 'a', target: 'b' },
        { source: 'a', target: 'b', sourceHandle: 'top', targetHandle: null },
      );
    });
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route).toEqual({ fromSide: 'top' });
    expect(ui().announcement.text).toBe('Connection now leaves from the top');
  });

  it('moving to a different card updates from/to, pins the side and clears the offset', () => {
    const { h, doc } = handlers();
    // d's box is x:300 y:200 w:164 h:50; a point just inside its right edge is nearest the right side.
    dragTo(h, flowEdge('e2'), { x: 462, y: 225 });
    expect(ui().endpointHover).toEqual({ nodeId: 'd', side: 'right' });
    act(() => {
      h().onReconnect(
        { id: 'e2', source: 'b', target: 'c' },
        { source: 'b', target: 'd', sourceHandle: null, targetHandle: 'right' },
      );
    });
    const e2 = toJSON(doc).edges.find((e) => e.id === 'e2');
    expect(e2).toMatchObject({ from: 'b', to: 'd' });
    expect(e2?.route).toEqual({ toSide: 'right' });
    expect(ui().announcement.text).toBe('Connection now enters from the right');
  });

  it('moving to a different card without a recorded hover still clears the offset', () => {
    const { h, doc } = handlers();
    act(() => {
      h().onReconnect(
        { id: 'e2', source: 'b', target: 'c' },
        { source: 'b', target: 'd', sourceHandle: null, targetHandle: null },
      );
    });
    const e2 = toJSON(doc).edges.find((e) => e.id === 'e2');
    expect(e2).toMatchObject({ from: 'b', to: 'd' });
    expect(e2?.route).toBeUndefined();
  });

  it("same card, no recorded hover: no-op (keeps today's reconnect tests unchanged)", () => {
    const { h, doc } = handlers();
    const before = toJSON(doc);
    act(() => {
      h().onReconnect(
        { id: 'e1', source: 'a', target: 'b' },
        { source: 'a', target: 'b', sourceHandle: null, targetHandle: null },
      );
    });
    expect(toJSON(doc)).toEqual(before);
  });

  it('still refuses invalid reconnections', () => {
    const { h, doc } = handlers();
    const before = toJSON(doc);
    act(() => {
      h().onReconnect(
        { id: 'e1', source: 'a', target: 'b' },
        { source: 'a', target: 'a', sourceHandle: null, targetHandle: null },
      );
    });
    expect(ui().announcement.text).toBe("Can't connect to itself");
    expect(toJSON(doc)).toEqual(before);
  });
});
