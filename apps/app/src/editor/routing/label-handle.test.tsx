import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as XYFlow from '@xyflow/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { samplePath } from './connector-geometry';
import { LabelHandle } from './label-handle';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof XYFlow>();
  // Inline the portal, and an identity screen → canvas mapping.
  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => children,
    useReactFlow: () => ({ screenToFlowPosition: (p: { x: number; y: number }) => p }),
  };
});

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 0 } },
  ],
  edges: [{ id: 'e', from: 'a', to: 'b', label: 'call' }],
});
const samples = samplePath('M 0 0 L 400 0');

function setup(at = 0.5) {
  Element.prototype.setPointerCapture = () => undefined;
  return renderWithEditor(
    <LabelHandle
      edgeId="e"
      text="call"
      at={at}
      samples={samples}
      clamp={28.6}
      width={60}
      rest={{ x: 200, y: 0 }}
    />,
    deck,
  );
}

beforeEach(() => {
  useUiStore.getState().resetForDeck();
});

const labelAt = (doc: Parameters<typeof toJSON>[0]) => toJSON(doc).edges[0]?.labelAt;

describe('LabelHandle (022 US4)', () => {
  it('is a button named with the text and the position', () => {
    setup(0.2);
    expect(screen.getByRole('button', { name: 'Label call, 20 % along' })).toBeInTheDocument();
  });

  it('drags along the line: ticks and readout while down, one write on release', () => {
    const { doc, editor } = setup();
    const handle = screen.getByTestId('label-handle');
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1 });
    expect(useUiStore.getState().canvasGesture).toBe('label');
    expect(screen.getAllByTestId('label-tick')).toHaveLength(3);
    fireEvent.pointerMove(handle, { clientX: 100, clientY: 20, pointerId: 1 });
    expect(useUiStore.getState().labelPreview).toMatchObject({
      edgeId: 'e',
      at: 0.25,
      snapped: true,
    });
    expect(screen.getByTestId('label-readout')).toHaveTextContent('label 25 % · snapped');
    expect(labelAt(doc)).toBeUndefined();
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(labelAt(doc)).toBe(0.25);
    expect(useUiStore.getState().labelPreview).toBeNull();
    expect(useUiStore.getState().canvasGesture).toBeNull();
    act(() => {
      editor().undo();
    });
    expect(labelAt(doc)).toBeUndefined();
  });

  it('⌘ turns snapping off', () => {
    setup();
    const handle = screen.getByTestId('label-handle');
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 108, clientY: 0, metaKey: true, pointerId: 1 });
    expect(useUiStore.getState().labelPreview).toMatchObject({ at: 0.27, snapped: false });
  });

  it('a release where it started writes nothing', () => {
    const { editor } = setup();
    const handle = screen.getByTestId('label-handle');
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(editor().canUndo()).toBe(false);
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
