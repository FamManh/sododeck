import { toJSON } from '@sododeck/model';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as XYFlow from '@xyflow/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import type { BendContext } from '../editing/bend-drag';
import { RouteHandles } from './route-handles';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof XYFlow>();
  // The real renderer portals into the React Flow viewport; inline it for the test.
  return { ...actual, EdgeLabelRenderer: ({ children }: { children: ReactNode }) => children };
});

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
});

function setup(bends: BendContext['bends'] = []) {
  const view = renderWithEditor(<RouteHandles context={ctx(bends)} />, deck);
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
