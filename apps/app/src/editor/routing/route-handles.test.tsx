import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlow } from '@xyflow/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import type { BendContext } from '../editing/bend-drag';
import type { SegmentContext } from '../editing/segment-drag';
import { decodeWaypoints } from './connector-geometry';
import { RelationshipEndHandles, RouteHandles } from './route-handles';

/** The handles portal into the React Flow viewport, so they render inside a real canvas. */
const inCanvas = (children: ReactNode) => (
  <ReactFlow nodes={[]} edges={[]}>
    {children}
  </ReactFlow>
);

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 200 } },
  ],
  edges: [{ id: 'e', from: 'a', to: 'b' }],
});

const ctx = (bends: BendContext['bends'] = []): BendContext => ({
  edgeId: 'e',
  fromCentre: { x: 80, y: 25 },
  toCentre: { x: 480, y: 225 },
  start: { x: 160, y: 25 },
  end: { x: 400, y: 225 },
  bends,
});

beforeEach(() => {
  useUiStore.getState().resetForDeck();
  // Drag frames run at once (the helper throttles moves to animation frames).
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(bends: BendContext['bends'] = []) {
  const view = renderWithEditor(inCanvas(<RouteHandles context={ctx(bends)} />), deck);
  return view;
}

describe('RouteHandles (022 US2)', () => {
  it('names the midpoints and the bends, and lists midpoints for each hop', () => {
    setup([
      { x: 280, y: 25 },
      { x: 280, y: 225 },
    ]);
    expect(screen.getAllByRole('button', { name: /^Add bend between points/ })).toHaveLength(3);
    expect(
      screen.getByRole('button', { name: 'Add bend between points 1 and 2' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bend 1 of 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bend 2 of 2' })).toBeInTheDocument();
  });

  it('a connector with no bends shows one midpoint handle', () => {
    setup();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('Enter on a midpoint adds a bend, announced', async () => {
    const { doc } = setup();
    const midpoint = screen.getByRole('button', { name: 'Add bend between points 1 and 2' });
    midpoint.focus();
    await userEvent.setup().keyboard('{Enter}');
    expect(toJSON(doc).edges[0]?.route?.waypoints).toHaveLength(1);
    expect(useUiStore.getState().announcement.text).toBe('Bend added');
  });

  it('Backspace, Delete and double-click remove only the bend', async () => {
    const { doc, editor } = setup([{ x: 280, y: 25 }]);
    act(() => {
      editor().setEdgeRoute('e', { waypoints: [{ x: 0.5, y: 0 }] });
    });
    const user = userEvent.setup();
    const bend = screen.getByRole('button', { name: 'Bend 1 of 1' });
    bend.focus();
    await user.keyboard('{Backspace}');
    expect(toJSON(doc).edges).toHaveLength(1);
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
    act(() => {
      editor().setEdgeRoute('e', { waypoints: [{ x: 0.5, y: 0 }] });
    });
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Bend 1 of 1' }));
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
  });

  it.each([
    ['{ArrowRight}', 22],
    ['{Shift>}{ArrowRight}{/Shift}', 1],
  ])('moves a focused bend with %s by %s px, as one undo step', async (keys, px) => {
    const { doc, editor } = setup([{ x: 280, y: 25 }]);
    act(() => {
      editor().setEdgeRoute('e', { waypoints: [{ x: 0.5, y: 0 }] });
    });
    screen.getByRole('button', { name: 'Bend 1 of 1' }).focus();
    await userEvent.setup().keyboard(keys);
    const x = toJSON(doc).edges[0]?.route?.waypoints?.[0]?.x ?? NaN;
    expect(x).toBeCloseTo(0.5 + px / 400, 3);
    expect(useUiStore.getState().announcement.text).toBe('Bend moved');
  });

  it('shows the live bends of a drag from the UI store, and hides midpoints while dragging', () => {
    setup([{ x: 280, y: 25 }]);
    act(() => {
      useUiStore.getState().setBendPreview({
        edgeId: 'e',
        bends: [
          { x: 300, y: 40 },
          { x: 320, y: 60 },
        ],
      });
    });
    expect(screen.getByRole('button', { name: 'Bend 2 of 2' })).toBeInTheDocument();
    expect(within(document.body).getAllByRole('button', { name: /^Add bend/ }).length).toBe(3);
  });
});

describe('RouteHandles end anchors (022 US3)', () => {
  function withAnchors(anchors: { fromSide: 'right' | 'top'; fromAt: number }) {
    return renderWithEditor(
      inCanvas(
        <RouteHandles context={ctx()} anchors={{ ...anchors, toSide: 'left', toAt: 0.5 }} />,
      ),
      deck,
    );
  }

  it('has Source end and Target end buttons', () => {
    withAnchors({ fromSide: 'right', fromAt: 0.5 });
    expect(screen.getByRole('button', { name: 'Source end' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Target end' })).toBeInTheDocument();
  });

  it('→ moves the source end one stop along its side, announced', async () => {
    const { doc } = withAnchors({ fromSide: 'right', fromAt: 0.5 });
    screen.getByRole('button', { name: 'Source end' }).focus();
    await userEvent.setup().keyboard('{ArrowRight}');
    expect(toJSON(doc).edges[0]?.route).toEqual({ fromSide: 'right', fromAt: 0.75 });
    expect(useUiStore.getState().announcement.text).toBe('Anchor right side · 75 %');
  });

  it('moves onto the next side at a corner', async () => {
    const { doc } = withAnchors({ fromSide: 'top', fromAt: 1 });
    screen.getByRole('button', { name: 'Source end' }).focus();
    await userEvent.setup().keyboard('{ArrowRight}');
    expect(toJSON(doc).edges[0]?.route).toEqual({ fromSide: 'right', fromAt: 0 });
  });
});

describe('RelationshipEndHandles (042 US7)', () => {
  const ends = (fromColumns: string[]) => ({
    from: {
      at: { x: 240, y: 106 },
      tableId: 'orders',
      columns: fromColumns,
      side: 'right' as const,
    },
    to: { at: { x: 400, y: 182 }, tableId: 'customers', columns: ['c.id'], side: 'left' as const },
  });

  it('sits at the row anchors', () => {
    renderWithEditor(inCanvas(<RelationshipEndHandles edgeId="r" {...ends(['o.cid'])} />), deck);
    expect(screen.getByRole('button', { name: 'Source end' })).toHaveStyle({
      left: '240px',
      top: '106px',
    });
    expect(screen.getByRole('button', { name: 'Target end' })).toHaveStyle({
      left: '400px',
      top: '182px',
    });
  });

  it('does not move a composite end and says where it is edited', () => {
    renderWithEditor(
      inCanvas(<RelationshipEndHandles edgeId="r" {...ends(['o.a', 'o.b'])} />),
      deck,
    );
    const handle = screen.getByRole('button', { name: 'Source end' });
    expect(handle).toHaveAccessibleDescription('Edit composite column ends in the details drawer');
    fireEvent.pointerDown(handle, { button: 0 });
    expect(useUiStore.getState().announcement.text).toContain(
      'Edit composite column ends in the details drawer',
    );
    expect(useUiStore.getState().columnConnect).toBeNull();
  });
});

describe('RouteHandles pointer drags (050 US1)', () => {
  const ui = () => useUiStore.getState();
  const down = (el: HTMLElement, x: number, y: number) =>
    fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: x, clientY: y });
  const move = (x: number, y: number) =>
    fireEvent.pointerMove(window, { pointerId: 1, clientX: x, clientY: y, metaKey: true });
  const up = (x: number, y: number) =>
    fireEvent.pointerUp(window, { pointerId: 1, clientX: x, clientY: y });

  it('renders the handles inside the viewport portal, above the cards', () => {
    setup([{ x: 280, y: 25 }]);
    const bend = screen.getByRole('button', { name: 'Bend 1 of 1' });
    expect(bend.closest('.react-flow__viewport-portal')).not.toBeNull();
    expect(bend.closest('.react-flow__edgelabel-renderer')).toBeNull();
  });

  it('a midpoint drag keeps following the pointer across re-renders, then writes once', () => {
    const { doc, editor } = setup();
    // The midpoint of (160, 25) → (400, 225).
    down(screen.getByRole('button', { name: 'Add bend between points 1 and 2' }), 280, 125);
    for (const [x, y] of [
      [300, 160],
      [330, 190],
      [360, 230],
    ] as const) {
      move(x, y);
      expect(ui().bendPreview).toEqual({ edgeId: 'e', bends: [{ x, y }] });
    }
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
    up(360, 230);
    expect(toJSON(doc).edges[0]?.route?.waypoints).toHaveLength(1);
    expect(ui().bendPreview).toBeNull();
    expect(ui().canvasGesture).toBeNull();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
  });

  it('keeps the other midpoints mounted during a drag, hidden from assistive tech', () => {
    setup([{ x: 280, y: 25 }]);
    down(screen.getByRole('button', { name: 'Bend 1 of 1' }), 280, 25);
    move(300, 80);
    expect(screen.queryAllByRole('button', { name: /^Add bend/ })).toHaveLength(0);
    const hidden = document.querySelectorAll('[data-kind="midpoint"]');
    expect(hidden.length).toBeGreaterThan(0);
    for (const el of hidden) {
      expect(el).toHaveAttribute('aria-hidden', 'true');
      expect(el).toHaveAttribute('inert');
    }
    up(300, 80);
  });

  it('a press and release under 4 px on a midpoint writes nothing and leaves no undo step', () => {
    const { doc, editor } = setup();
    down(screen.getByRole('button', { name: 'Add bend between points 1 and 2' }), 280, 125);
    move(282, 127);
    expect(ui().bendPreview).toBeNull();
    expect(ui().canvasGesture).toBeNull();
    up(282, 127);
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
    expect(editor().canUndo()).toBe(false);
  });

  it('shows no midpoint on a run shorter than 24 screen px (FR-004)', () => {
    // Runs: (160, 25) → (170, 25) is 10 px long; the other two are long.
    setup([
      { x: 170, y: 25 },
      { x: 170, y: 225 },
    ]);
    expect(screen.getAllByRole('button', { name: /^Add bend/ })).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'Add bend between points 1 and 2' }),
    ).not.toBeInTheDocument();
  });

  it('Esc mid-drag restores the shape and writes nothing', () => {
    const { doc, editor } = setup([{ x: 280, y: 25 }]);
    down(screen.getByRole('button', { name: 'Bend 1 of 1' }), 280, 25);
    move(320, 90);
    expect(ui().bendPreview).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(ui().bendPreview).toBeNull();
    expect(ui().canvasGesture).toBeNull();
    up(320, 90);
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
    expect(editor().canUndo()).toBe(false);
    // The connector stays selected: the canvas did not also act on that Esc.
    expect(ui().announcement.text).toBe('Cancelled');
  });

  it('pointercancel clears the preview, the guides and the gesture', () => {
    const { doc } = setup([{ x: 280, y: 25 }]);
    down(screen.getByRole('button', { name: 'Bend 1 of 1' }), 280, 25);
    move(320, 90);
    act(() => {
      ui().setGuides([{ axis: 'x', at: 320, from: 0, to: 100 }]);
    });
    expect(ui().canvasGesture).toBe('bend');
    fireEvent.pointerCancel(window, { pointerId: 1 });
    expect(ui().bendPreview).toBeNull();
    expect(ui().guides).toHaveLength(0);
    expect(ui().canvasGesture).toBeNull();
    expect(ui().connectorReadout).toBeNull();
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
  });

  it('unmounting mid-drag cancels it', () => {
    const { unmount } = setup([{ x: 280, y: 25 }]);
    down(screen.getByRole('button', { name: 'Bend 1 of 1' }), 280, 25);
    move(320, 90);
    unmount();
    expect(ui().bendPreview).toBeNull();
    expect(ui().canvasGesture).toBeNull();
  });

  it('Esc on a handle with no drag still moves focus back to the connector', async () => {
    const edge = document.createElement('div');
    edge.className = 'react-flow__edge';
    edge.dataset.id = 'e';
    edge.tabIndex = 0;
    document.body.append(edge);
    setup([{ x: 280, y: 25 }]);
    screen.getByRole('button', { name: 'Bend 1 of 1' }).focus();
    await userEvent.setup().keyboard('{Escape}');
    expect(document.activeElement).toBe(edge);
    edge.remove();
  });
});

describe('RouteHandles clicks (050 US1)', () => {
  it("keeps a handle's click (⌘ held for no snap) from reaching the connector's own click", () => {
    // Through the portal, React bubbles a handle click to the edge, where ⌘-click toggles the
    // selection: a ⌘ drag of a handle would end with the connector deselected.
    const onEdgeClick = vi.fn();
    renderWithEditor(
      inCanvas(
        <div onClick={onEdgeClick}>
          <RouteHandles
            context={ctx([{ x: 280, y: 25 }])}
            anchors={{ fromSide: 'right', fromAt: 0.5, toSide: 'left', toAt: 0.5 }}
          />
        </div>,
      ),
      deck,
    );
    for (const name of ['Source end', 'Target end', 'Bend 1 of 1', /^Add bend/]) {
      for (const handle of screen.getAllByRole('button', { name })) {
        fireEvent.click(handle, { metaKey: true });
      }
    }
    expect(onEdgeClick).not.toHaveBeenCalled();
  });
});

describe('RouteHandles end drags (050 US2)', () => {
  const ui = () => useUiStore.getState();
  const down = (el: HTMLElement, x: number, y: number) =>
    fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: x, clientY: y });
  const move = (x: number, y: number) =>
    fireEvent.pointerMove(window, { pointerId: 1, clientX: x, clientY: y, metaKey: true });
  const up = (x: number, y: number) =>
    fireEvent.pointerUp(window, { pointerId: 1, clientX: x, clientY: y });

  // The drawn cards (A: 0,0 160×50; B: 400,200 160×50), so the target scene has boxes.
  const nodeTypes = { deck: () => null };
  const cards = [
    { id: 'a', type: 'deck', position: { x: 0, y: 0 }, width: 160, height: 50, data: {} },
    { id: 'b', type: 'deck', position: { x: 400, y: 200 }, width: 160, height: 50, data: {} },
  ];
  // Start on A's right side middle, end on B's left side middle.
  const endCtx: BendContext = {
    edgeId: 'e',
    fromCentre: { x: 80, y: 25 },
    toCentre: { x: 480, y: 225 },
    start: { x: 160, y: 25 },
    end: { x: 400, y: 225 },
    bends: [],
  };

  function withEnds(bendable = true) {
    return renderWithEditor(
      <ReactFlow nodes={cards} edges={[]} nodeTypes={nodeTypes}>
        <RouteHandles
          context={endCtx}
          anchors={{ fromSide: 'right', fromAt: 0.5, toSide: 'left', toAt: 0.5 }}
          ends={{ source: 'a', target: 'b' }}
          bendable={bendable}
        />
      </ReactFlow>,
      deck,
    );
  }

  it('the end drags while it sits under a card, and writes once on release', () => {
    const { doc, editor } = withEnds();
    const end = screen.getByRole('button', { name: 'Target end' });
    expect(end.closest('.react-flow__viewport-portal')).not.toBeNull();
    down(end, 400, 225);
    move(390, 215);
    move(390, 210);
    expect(ui().endpointPreview).toMatchObject({
      edgeId: 'e',
      end: 'target',
      targetId: 'b',
      side: 'left',
      at: 0.2,
    });
    expect(ui().canvasGesture).toBe('endpoint');
    expect(screen.getByTestId('route-readout')).toHaveTextContent('left side · 20 %');
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
    up(390, 210);
    expect(toJSON(doc).edges[0]?.route).toEqual({ toSide: 'left', toAt: 0.2 });
    expect(ui().endpointPreview).toBeNull();
    expect(ui().canvasGesture).toBeNull();
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
    expect(editor().canUndo()).toBe(false);
  });

  it('a press on an end without a drag writes nothing (FR-007)', () => {
    const { doc, editor } = withEnds();
    down(screen.getByRole('button', { name: 'Source end' }), 160, 25);
    move(162, 26);
    expect(ui().endpointPreview).toBeNull();
    up(162, 26);
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
    expect(editor().canUndo()).toBe(false);
  });

  it('Esc during an end drag drops the preview and writes nothing', () => {
    const { doc } = withEnds();
    down(screen.getByRole('button', { name: 'Target end' }), 400, 225);
    move(390, 210);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(ui().endpointPreview).toBeNull();
    up(390, 210);
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
    expect(ui().announcement.text).toBe('Cancelled');
  });

  it('a straight connector (not bendable) shows only the two ends', () => {
    withEnds(false);
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Source end',
      'Target end',
    ]);
  });

  it.each([
    ['{Shift>}{ArrowRight}{/Shift}', 0.51],
    ['{Shift>}{ArrowLeft}{/Shift}', 0.49],
    ['{ArrowRight}', 0.75],
  ])('%s on the source end moves it to %s, one undo step each', async (keys, at) => {
    const { doc, editor } = withEnds();
    screen.getByRole('button', { name: 'Source end' }).focus();
    await userEvent.setup().keyboard(keys);
    expect(toJSON(doc).edges[0]?.route).toEqual({ fromSide: 'right', fromAt: at });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
  });
});

describe('RouteHandles segment handles (050 US5)', () => {
  const ui = () => useUiStore.getState();
  const down = (el: HTMLElement, x: number, y: number) =>
    fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: x, clientY: y });
  // ⌘ held: no snapping, so the run lands exactly under the pointer.
  const move = (x: number, y: number) =>
    fireEvent.pointerMove(window, { pointerId: 1, clientX: x, clientY: y, metaKey: true });
  const up = (x: number, y: number) =>
    fireEvent.pointerUp(window, { pointerId: 1, clientX: x, clientY: y });

  // A (0,0 160×50) right side → B (400,200 160×50) left side. With no bends the elbow is
  // (160,25) → (280,25) → (280,225) → (400,225): segment 1 and 3 are the end runs, 2 the middle.
  const segCtx = (bends: SegmentContext['bends'] = []): SegmentContext => ({
    ...ctx(bends),
    fromBox: { x: 0, y: 0, width: 160, height: 50 },
    toBox: { x: 400, y: 200, width: 160, height: 50 },
    fromSide: 'right',
    toSide: 'left',
    fromAt: 0.5,
    toAt: 0.5,
  });

  function withSegments(bends: SegmentContext['bends'] = []) {
    const segment = segCtx(bends);
    return renderWithEditor(
      inCanvas(
        <RouteHandles
          context={ctx(bends)}
          segment={segment}
          anchors={{ fromSide: 'right', fromAt: 0.5, toSide: 'left', toAt: 0.5 }}
        />,
      ),
      deck,
    );
  }

  const segment = (n: number) => screen.getByRole('button', { name: `Move segment ${String(n)}` });

  it('replaces the midpoints with one "Move segment N" handle per run', () => {
    withSegments();
    expect(screen.queryAllByRole('button', { name: /^Add bend/ })).toHaveLength(0);
    expect(
      screen.getAllByRole('button', { name: /^Move segment/ }).map((b) => b.ariaLabel),
    ).toEqual(['Move segment 1', 'Move segment 2', 'Move segment 3']);
    expect(segment(2).closest('.react-flow__viewport-portal')).not.toBeNull();
    expect(segment(2)).toHaveAttribute('data-axis', 'x');
    expect(segment(1)).toHaveAttribute('data-axis', 'y');
  });

  it('shows no segment handle on a run shorter than 24 screen px (FR-004)', () => {
    // The first run (160,25) → (170,25) is 10 px long.
    withSegments([
      { x: 170, y: 25 },
      { x: 170, y: 225 },
    ]);
    expect(
      screen.getAllByRole('button', { name: /^Move segment/ }).map((b) => b.ariaLabel),
    ).toEqual(['Move segment 2', 'Move segment 3']);
  });

  it('drags the middle run along x across re-renders, then writes once (one undo step)', () => {
    const { doc, editor } = withSegments();
    down(segment(2), 280, 125);
    move(300, 140);
    move(320, 150);
    expect(ui().bendPreview).toEqual({
      edgeId: 'e',
      bends: [
        { x: 320, y: 25 },
        { x: 320, y: 225 },
      ],
    });
    expect(ui().canvasGesture).toBe('segment');
    expect(screen.getByTestId('route-readout')).toHaveTextContent('x 320');
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
    up(320, 150);
    const route = toJSON(doc).edges[0]?.route;
    expect(route?.waypoints).toHaveLength(2);
    expect(route).toMatchObject({ fromSide: 'right', toSide: 'left' });
    expect(ui().bendPreview).toBeNull();
    expect(ui().canvasGesture).toBeNull();
    expect(ui().announcement.text).toBe('Segment moved');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
  });

  it('a press and release under 4 px writes nothing and leaves no undo step', () => {
    const { doc, editor } = withSegments();
    down(segment(2), 280, 125);
    move(282, 126);
    expect(ui().bendPreview).toBeNull();
    up(282, 126);
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
    expect(editor().canUndo()).toBe(false);
  });

  it('keeps the other handles mounted but inert during a segment drag', () => {
    withSegments();
    down(segment(2), 280, 125);
    move(320, 150);
    const dragged = document.querySelector('[data-kind="segment"][data-active]');
    expect(dragged).not.toBeNull();
    expect(dragged).not.toHaveAttribute('inert');
    const others = [...document.querySelectorAll('.sd-route-handle')].filter(
      (el) => el !== dragged,
    );
    expect(others.length).toBeGreaterThan(0);
    for (const el of others) {
      expect(el).toHaveAttribute('aria-hidden', 'true');
      expect(el).toHaveAttribute('inert');
    }
    up(320, 150);
  });

  it('unmounting mid-drag cancels it', () => {
    const { unmount } = withSegments();
    down(segment(2), 280, 125);
    move(320, 150);
    unmount();
    expect(ui().bendPreview).toBeNull();
    expect(ui().canvasGesture).toBeNull();
  });

  it('dragging an end run slides that end along its side, without storing bends', () => {
    const { doc } = withSegments();
    down(segment(1), 220, 25);
    move(220, 40);
    expect(ui().bendPreview).toMatchObject({ edgeId: 'e', bends: [], fromAt: 0.8 });
    up(220, 40);
    expect(toJSON(doc).edges[0]?.route).toEqual({ fromSide: 'right', fromAt: 0.8 });
  });

  it.each([
    ['{ArrowRight}', 22],
    ['{ArrowLeft}', -22],
    ['{Shift>}{ArrowRight}{/Shift}', 1],
  ])('%s moves the middle run by %s px on its axis, one undo step', async (keys, px) => {
    const { doc, editor } = withSegments();
    segment(2).focus();
    await userEvent.setup().keyboard(keys);
    const waypoints = toJSON(doc).edges[0]?.route?.waypoints ?? [];
    const xs = decodeWaypoints(waypoints, { x: 80, y: 25 }, { x: 480, y: 225 }).map((p) => p.x);
    expect(xs).toHaveLength(2);
    for (const x of xs) expect(x).toBeCloseTo(280 + px, 3);
    expect(ui().announcement.text).toBe('Segment moved');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
  });

  it('arrows across the run axis do nothing', async () => {
    const { doc, editor } = withSegments();
    segment(2).focus();
    await userEvent.setup().keyboard('{ArrowUp}{ArrowDown}');
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
    expect(editor().canUndo()).toBe(false);
  });

  it('↓ on the first run slides the source end 22 px down its side', async () => {
    const { doc } = withSegments();
    segment(1).focus();
    await userEvent.setup().keyboard('{ArrowDown}');
    // 25 + 22 = 47 of 50.
    expect(toJSON(doc).edges[0]?.route).toEqual({ fromSide: 'right', fromAt: 0.94 });
  });

  it('⌫ and double-click reset the run', async () => {
    const bends = [
      { x: 320, y: 25 },
      { x: 320, y: 225 },
    ];
    const { doc, editor } = withSegments(bends);
    const stored = () => {
      act(() => {
        editor().setEdgeRoute('e', {
          fromSide: 'right',
          toSide: 'left',
          waypoints: [
            { x: 0.6, y: 0 },
            { x: 0.6, y: 1 },
          ],
        });
      });
    };
    stored();
    segment(2).focus();
    await userEvent.setup().keyboard('{Backspace}');
    expect(toJSON(doc).edges[0]?.route).not.toHaveProperty('waypoints');
    expect(toJSON(doc).edges).toHaveLength(1);
    expect(ui().announcement.text).toBe('Segment reset');
    stored();
    fireEvent.doubleClick(segment(2));
    expect(toJSON(doc).edges[0]?.route).not.toHaveProperty('waypoints');
  });

  it('a curved or straight connector (no segment context) keeps its midpoints', () => {
    setup();
    expect(screen.queryAllByRole('button', { name: /^Move segment/ })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /^Add bend/ })).toHaveLength(1);
  });
});
