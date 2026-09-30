import { act, render, screen } from '@testing-library/react';
import { toJSON } from '@sododeck/model';
import { ReactFlow } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { deckOf, editorWrapper } from '../../test/render-canvas';
import { middleSegment, resolveSides, routedStepPath } from './route-path';
import { SegmentHandle } from './segment-handle';

// Vertical stack: n1 above n2, both default component size (164 × 104).
const deck = deckOf({
  nodes: [
    { id: 'n1', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'n2', type: 'service', title: 'B', position: { x: 0, y: 300 } },
  ],
  edges: [{ id: 'e1', from: 'n1', to: 'n2' }],
});

function segmentOf() {
  const fromBox = { x: 0, y: 0, width: 164, height: 104 };
  const toBox = { x: 0, y: 300, width: 164, height: 104 };
  const sides = resolveSides(fromBox, toBox);
  const axis = middleSegment(sides);
  if (axis === null) throw new Error('no segment');
  const routed = routedStepPath({
    sourceX: 82,
    sourceY: 104,
    targetX: 82,
    targetY: 300,
    sides,
  });
  if (routed.segment === null) throw new Error('no segment');
  return routed.segment;
}

function setup(offset = 0) {
  const env = editorWrapper(deck);
  const result = render(
    <ReactFlow nodes={[]} edges={[]}>
      <SegmentHandle edgeId="e1" level="component" segment={segmentOf()} offset={offset} />
    </ReactFlow>,
    { wrapper: env.wrapper },
  );
  return { ...env, ...result };
}

describe('SegmentHandle (017 R7, FR-012)', () => {
  it('is a focusable slider naming the gesture, with the offset and orientation', () => {
    setup(60);
    const handle = screen.getByRole('slider', { name: 'Move middle segment' });
    expect(handle).toHaveAttribute('aria-valuenow', '60');
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('tabIndex', '0');
  });

  it('nudges the offset down by 1 px on ArrowDown, 10 with ⇧, one undo step each', () => {
    const { doc, editor: getEditor } = setup(0);
    const editor = getEditor();
    const handle = screen.getByRole('slider', { name: 'Move middle segment' });
    act(() => {
      handle.focus();
    });
    act(() => {
      handle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      );
    });
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route?.offset).toBe(1);
    act(() => {
      handle.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route?.offset).toBe(11);
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route?.offset).toBe(1);
  });

  it('ignores arrows along the segment (perpendicular to its moving axis)', () => {
    const { doc } = setup(0);
    const handle = screen.getByRole('slider', { name: 'Move middle segment' });
    act(() => {
      handle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
      );
      handle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      );
    });
    expect(toJSON(doc).edges.find((e) => e.id === 'e1')?.route).toBeUndefined();
  });
});
