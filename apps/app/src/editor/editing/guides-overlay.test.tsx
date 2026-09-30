import { act, render, screen } from '@testing-library/react';
import { ReactFlow } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { GuidesOverlay } from './guides-overlay';

const ui = () => useUiStore.getState();

const deck = deckOf({
  nodes: [{ id: 'a', type: 'service', title: 'A', group: 'g', position: { x: 0, y: 0 } }],
  groups: [{ id: 'g', title: 'G', position: { x: 100, y: 40 }, size: { width: 300, height: 200 } }],
});

function setup() {
  const env = editorWrapper(deck);
  const result = render(
    <ReactFlow nodes={[]} edges={[]}>
      <GuidesOverlay />
    </ReactFlow>,
    { wrapper: env.wrapper },
  );
  return { ...env, ...result };
}

describe('GuidesOverlay (016 US3 / US2 / US4)', () => {
  it('draws nothing at rest', () => {
    const { container } = setup();
    expect(container.querySelector('[data-guide]')).toBeNull();
  });

  it('draws guides with distance and equal-gap labels, hidden from assistive tech', () => {
    const { container } = setup();
    act(() => {
      ui().setGuides([
        {
          axis: 'x',
          at: 50,
          from: 0,
          to: 300,
          distance: { value: 40, at: { x: 50, y: 150 } },
          equalGaps: [{ value: 24, at: { x: 10, y: 10 } }],
        },
        { axis: 'y', at: 20, from: 0, to: 200 },
      ]);
    });
    expect(container.querySelectorAll('[data-guide="x"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-guide="y"]')).toHaveLength(1);
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(container.querySelector('[data-guide]')?.closest('[aria-hidden]')).not.toBeNull();
  });

  it('shows the start ghost and the signed offset readout during a group drag', () => {
    setup();
    act(() => {
      ui().select({ groups: ['g'] });
      ui().setCanvasGesture('group-drag');
      ui().setDragReadout({ dx: 100, dy: -40 });
    });
    const ghost = screen.getByTestId('drag-ghost');
    expect(ghost.style.left).toBe('0px');
    expect(ghost.style.top).toBe('80px');
    expect(screen.getByText('+100, −40')).toBeInTheDocument();
  });

  it('shows the landing slot of a card dropped into a group', () => {
    setup();
    act(() => {
      ui().select({ nodes: ['a'] });
      ui().setCanvasGesture('drag');
      ui().setDropTarget('g');
    });
    expect(screen.getByTestId('landing-slot')).toBeInTheDocument();
  });

  it('sizes the landing slot to a resized card’s own stored size (017 R2)', () => {
    const resized = deckOf({
      nodes: [
        {
          id: 'a',
          type: 'service',
          title: 'A',
          group: 'g',
          position: { x: 0, y: 0 },
          size: { width: 300, height: 100 },
        },
      ],
      groups: [
        { id: 'g', title: 'G', position: { x: 100, y: 40 }, size: { width: 400, height: 300 } },
      ],
    });
    const env = editorWrapper(resized);
    render(
      <ReactFlow nodes={[]} edges={[]}>
        <GuidesOverlay />
      </ReactFlow>,
      { wrapper: env.wrapper },
    );
    act(() => {
      useUiStore.getState().select({ nodes: ['a'] });
      useUiStore.getState().setCanvasGesture('drag');
      useUiStore.getState().setDropTarget('g');
    });
    const slot = screen.getByTestId('landing-slot');
    expect(slot.style.width).toBe(`${300 + 8}px`);
    expect(slot.style.height).toBe(`${100 + 8}px`);
  });

  it('shows the W × H readout during a card resize (017 R4)', () => {
    setup();
    act(() => {
      ui().setCanvasGesture('card-resize');
      ui().setResizeReadout({ width: 244, height: 80, x: 0, y: 0 });
    });
    expect(screen.getByTestId('resize-readout')).toHaveTextContent('244 × 80');
  });
});
