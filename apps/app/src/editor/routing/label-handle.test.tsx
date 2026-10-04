import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlow } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { hasActiveGesture } from '../editing/drag-session';
import { samplePath } from './connector-geometry';
import { LabelHandle } from './label-handle';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 0 } },
  ],
  edges: [{ id: 'e', from: 'a', to: 'b', label: 'call' }],
});
const samples = samplePath('M 0 0 L 400 0');

/** Inside a real canvas: the handle portals into its viewport (screen = canvas px in jsdom). */
function setup(at = 0.5) {
  return renderWithEditor(
    <ReactFlow nodes={[]} edges={[]}>
      <LabelHandle
        edgeId="e"
        text="call"
        at={at}
        samples={samples}
        clamp={28.6}
        width={60}
        rest={{ x: 200, y: 0 }}
      />
    </ReactFlow>,
    deck,
  );
}

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

const down = (el: HTMLElement, x = 200, y = 0) =>
  fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: x, clientY: y });
/** Moves land on the window: the pointer may be over a card, not over the handle. */
const move = (x: number, y: number, init: Record<string, unknown> = {}) =>
  fireEvent.pointerMove(window, { pointerId: 1, clientX: x, clientY: y, ...init });
const up = (x = 0, y = 0) => fireEvent.pointerUp(window, { pointerId: 1, clientX: x, clientY: y });

const labelAt = (doc: Parameters<typeof toJSON>[0]) => toJSON(doc).edges[0]?.labelAt;

describe('LabelHandle (022 US4)', () => {
  it('is a button named with the text and the position', () => {
    setup(0.2);
    expect(screen.getByRole('button', { name: 'Label call, 20 % along' })).toBeInTheDocument();
  });

  it('renders in the viewport portal, above the cards', () => {
    setup();
    expect(
      screen.getByTestId('label-handle').closest('.react-flow__viewport-portal'),
    ).not.toBeNull();
  });

  it('drags along the line: ticks and readout while dragging, one write on release', () => {
    const { doc, editor } = setup();
    const handle = screen.getByTestId('label-handle');
    down(handle);
    // A press alone is not a drag yet (050 FR-003).
    expect(useUiStore.getState().canvasGesture).toBeNull();
    expect(screen.queryAllByTestId('label-tick')).toHaveLength(0);
    move(100, 20);
    expect(useUiStore.getState().canvasGesture).toBe('label');
    expect(hasActiveGesture()).toBe(true);
    expect(screen.getAllByTestId('label-tick')).toHaveLength(3);
    expect(useUiStore.getState().labelPreview).toMatchObject({
      edgeId: 'e',
      at: 0.25,
      snapped: true,
    });
    expect(screen.getByTestId('label-readout')).toHaveTextContent('label 25 % · snapped');
    expect(labelAt(doc)).toBeUndefined();
    up(100, 20);
    expect(labelAt(doc)).toBe(0.25);
    expect(useUiStore.getState().labelPreview).toBeNull();
    expect(useUiStore.getState().canvasGesture).toBeNull();
    expect(hasActiveGesture()).toBe(false);
    act(() => {
      editor().undo();
    });
    expect(labelAt(doc)).toBeUndefined();
  });

  it('⌘ turns snapping off', () => {
    setup();
    down(screen.getByTestId('label-handle'));
    move(108, 0, { metaKey: true });
    expect(useUiStore.getState().labelPreview).toMatchObject({ at: 0.27, snapped: false });
  });

  it('a click (under 4 px) does not move it and writes nothing', () => {
    const { editor, doc } = setup();
    down(screen.getByTestId('label-handle'), 200, 0);
    move(202, 2);
    expect(useUiStore.getState().labelPreview).toBeNull();
    up(202, 2);
    expect(labelAt(doc)).toBeUndefined();
    expect(editor().canUndo()).toBe(false);
  });

  it('keeps following the pointer over a card, away from the handle', () => {
    const { doc } = setup();
    const card = document.createElement('div');
    card.className = 'react-flow__node';
    document.body.append(card);
    down(screen.getByTestId('label-handle'));
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 300, clientY: 40, metaKey: true });
    expect(useUiStore.getState().labelPreview).toMatchObject({ at: 0.75 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 300, clientY: 40 });
    expect(labelAt(doc)).toBe(0.75);
    card.remove();
  });

  it('Esc mid-drag puts it back and writes nothing', () => {
    const { doc } = setup();
    down(screen.getByTestId('label-handle'));
    move(100, 0);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useUiStore.getState().labelPreview).toBeNull();
    expect(useUiStore.getState().canvasGesture).toBeNull();
    up(100, 0);
    expect(labelAt(doc)).toBeUndefined();
  });

  it('← → move 5 %, Shift jumps ticks, Home / End clamp, each one undo step', async () => {
    const { doc } = setup();
    const handle = screen.getByTestId('label-handle');
    handle.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowRight}');
    expect(labelAt(doc)).toBe(0.55);
    expect(useUiStore.getState().announcement.text).toBe('label 55 %');
    await user.keyboard('{Home}');
    expect(labelAt(doc)).toBeCloseTo(28.6 / 400, 1);
    await user.keyboard('{End}');
    expect(labelAt(doc)).toBeGreaterThan(0.9);
  });

  it('Shift + → goes to the next tick', async () => {
    const { doc } = setup(0.55);
    screen.getByTestId('label-handle').focus();
    await userEvent.setup().keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(labelAt(doc)).toBe(0.75);
  });

  it('Enter opens the label text editor', async () => {
    setup();
    screen.getByTestId('label-handle').focus();
    await userEvent.setup().keyboard('{Enter}');
    expect(useUiStore.getState().selection.edges).toEqual(['e']);
  });
});
