import { toJSON } from '@sododeck/model';
import { act, renderHook } from '@testing-library/react';
import {
  Position,
  ReactFlowProvider,
  type Edge,
  type FinalConnectionState,
  type Node,
} from '@xyflow/react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

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

/** Handlers inside a provider that already draws `nodes` (what `getNodes()` returns). */
function handlersOver(nodes: Node[], file = deck) {
  const env = editorWrapper(file);
  const Outer = env.wrapper;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Outer>
      <ReactFlowProvider initialNodes={nodes}>{children}</ReactFlowProvider>
    </Outer>
  );
  const { result } = renderHook(() => useCanvasHandlers(), { wrapper });
  return { ...env, h: () => result.current };
}

const card = (id: string, x: number, y: number): Node => ({
  id,
  type: 'deck',
  position: { x, y },
  width: 164,
  height: 50,
  data: {},
});
const drawn = [card('a', 0, 0), card('b', 300, 0), card('c', 0, 200), card('d', 300, 200)];

/** React Flow's final state of a connection dragged from `from` and dropped off every handle. */
function dropped(from: string, handleType: 'source' | 'target' = 'source') {
  return {
    isValid: false,
    from: { x: 0, y: 0 },
    fromHandle: {
      id: null,
      nodeId: from,
      type: handleType,
      position: Position.Right,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    },
    fromPosition: Position.Right,
    fromNode: { id: from },
    to: { x: 0, y: 0 },
    toHandle: null,
    toPosition: null,
    toNode: null,
    pointer: { x: 0, y: 0 },
  } as unknown as FinalConnectionState;
}

const at = (x: number, y: number) => ({ clientX: x, clientY: y }) as MouseEvent;

describe('use-canvas-handlers: a new connection dropped off a handle (050 T021)', () => {
  it('creates the connector to the card near the drop, with the drop side and position pinned', () => {
    const { h, doc, editor } = handlersOver(drawn);
    // 8 px right of d's right side (x 464), at 30 % down: within reach, not on a handle.
    act(() => {
      h().onConnectEnd(at(472, 215), dropped('a'));
    });
    const created = toJSON(doc).edges.find((e) => e.from === 'a' && e.to === 'd');
    expect(created?.route).toEqual({ toSide: 'right', toAt: 0.3 });
    expect(ui().selection.edges).toEqual([created?.id]);
    // one undo step takes the whole connector away
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).edges.some((e) => e.from === 'a' && e.to === 'd')).toBe(false);
  });

  it('started from a target handle, the dropped card is the source', () => {
    const { h, doc } = handlersOver(drawn);
    act(() => {
      h().onConnectEnd(at(472, 215), dropped('a', 'target'));
    });
    expect(toJSON(doc).edges.find((e) => e.from === 'd' && e.to === 'a')?.route).toEqual({
      fromSide: 'right',
      fromAt: 0.3,
    });
  });

  it('does nothing after a handle drop (onConnect made it), or off every card', () => {
    const { h, doc } = handlersOver(drawn);
    const before = toJSON(doc);
    act(() => {
      h().onConnectEnd(at(472, 215), { ...dropped('a'), isValid: true } as FinalConnectionState);
      h().onConnectEnd(at(900, 900), dropped('a'));
      // the card it starts from is no target
      h().onConnectEnd(at(80, 25), dropped('a'));
    });
    expect(toJSON(doc)).toEqual(before);
  });

  it('refuses a duplicate with the usual reason', () => {
    const { h, doc } = handlersOver(drawn);
    const before = toJSON(doc);
    act(() => {
      // a–b exists (e1)
      h().onConnectEnd(at(310, 25), dropped('a'));
    });
    expect(ui().announcement.text).toBe('Already connected');
    expect(toJSON(doc)).toEqual(before);
  });

  it('a group frame is no target while group ends are off', () => {
    const { h, doc } = handlersOver([
      ...drawn,
      {
        id: 'group:g',
        type: 'group-boundary',
        position: { x: 600, y: 0 },
        width: 300,
        height: 300,
        data: {},
      },
    ]);
    const before = toJSON(doc);
    act(() => {
      h().onConnectEnd(at(750, 150), dropped('a'));
    });
    expect(toJSON(doc)).toEqual(before);
  });

  it('is refused in flow mode', () => {
    const { h, doc } = handlersOver(drawn);
    const before = toJSON(doc);
    act(() => {
      useUiStore.setState({
        activeFlow: {
          flowId: 'f1',
          stepId: null,
          branchId: null,
          alternativeId: null,
          playing: false,
          speed: 1,
        },
      });
    });
    act(() => {
      h().onConnectEnd(at(472, 215), dropped('a'));
    });
    expect(toJSON(doc)).toEqual(before);
  });
});

describe('use-canvas-handlers: bundles (034)', () => {
  const click = {} as ReactMouseEvent;

  it('opens the popover from a click on the bundle curve instead of selecting it', () => {
    const { h } = handlers();
    act(() => {
      h().onEdgeClick(click, flowEdge('bundle:a|b'));
    });
    expect(ui().popover).toEqual({ kind: 'merged', edgeId: 'bundle:a|b' });
    expect(ui().focusedEdgeId).toBe('bundle:a|b');
    expect(ui().selection.edges).toEqual([]);
  });

  it('opens it on double-click too, and gives a bundle no context menu', () => {
    const { h } = handlers();
    act(() => {
      h().onEdgeDoubleClick(click, flowEdge('bundle:a|b'));
    });
    expect(ui().popover).toEqual({ kind: 'merged', edgeId: 'bundle:a|b' });
    const preventDefault = vi.fn();
    act(() => {
      h().onEdgeContextMenu(
        { preventDefault } as unknown as ReactMouseEvent,
        flowEdge('bundle:a|b'),
      );
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(ui().contextMenu).toBeNull();
  });

  it('folds every fanned bundle on a click on empty canvas', () => {
    const { h } = handlers();
    act(() => {
      ui().toggleBundleFan('bundle:a|b');
      h().onPaneClick(click);
    });
    expect(ui().fannedBundles.size).toBe(0);
  });
});
