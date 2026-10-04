import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen } from '@testing-library/react';
import type * as XYFlow from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../state/ui-store';
import { deckOf, renderWithEditor } from '../test/render-canvas';
import { ResizeControls } from './component-node-parts';
import { hasActiveGesture } from './editing/drag-session';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof XYFlow>();
  // jsdom can't run React Flow's resize drag: a button stands in, starting a resize on click.
  return {
    ...actual,
    NodeResizeControl: ({
      position,
      onResizeStart,
    }: {
      position: string;
      onResizeStart: () => void;
    }) => <button type="button" aria-label={`Resize ${position}`} onClick={onResizeStart} />,
  };
});

const deck = deckOf({
  nodes: [{ id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } }],
});

beforeEach(() => {
  useUiStore.getState().resetForDeck();
});

describe('ResizeControls (050 R9)', () => {
  it('unmounting mid-resize cancels it and clears the guides', () => {
    const { unmount, doc, editor } = renderWithEditor(
      <ResizeControls id="a" level="component" />,
      deck,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Resize bottom-right' }));
    expect(useUiStore.getState().canvasGesture).toBe('card-resize');
    expect(hasActiveGesture()).toBe(true);
    act(() => {
      useUiStore.getState().setGuides([{ axis: 'x', at: 1, from: 0, to: 10 }]);
      useUiStore.getState().setResizeReadout({ width: 200, height: 90, x: 0, y: 0 });
    });
    unmount();
    const ui = useUiStore.getState();
    expect(ui.guides).toHaveLength(0);
    expect(ui.resizeReadout).toBeNull();
    expect(ui.canvasGesture).toBeNull();
    expect(hasActiveGesture()).toBe(false);
    expect(editor().canUndo()).toBe(false);
    expect(toJSON(doc).nodes[0]).not.toHaveProperty('size');
  });
});
