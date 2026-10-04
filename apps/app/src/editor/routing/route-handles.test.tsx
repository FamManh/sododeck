import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlow } from '@xyflow/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import type { BendContext } from '../editing/bend-drag';
import { RouteHandles } from './route-handles';

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
