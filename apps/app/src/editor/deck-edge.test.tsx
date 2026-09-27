import { render, screen } from '@testing-library/react';
import type * as XYFlow from '@xyflow/react';
import { Position, type EdgeProps } from '@xyflow/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DeckEdge } from './deck-edge';
import type { DeckEdgeData, DeckFlowEdge } from './deck-to-flow';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof XYFlow>();
  // The real renderer portals into the React Flow viewport; inline it for the test.
  return { ...actual, EdgeLabelRenderer: ({ children }: { children: ReactNode }) => children };
});

function renderEdge(data: Partial<DeckEdgeData>, selected = false) {
  const props = {
    id: 'e1',
    source: 'a',
    target: 'b',
    sourceX: 0,
    sourceY: 0,
    targetX: 200,
    targetY: 40,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    selected,
    data: {
      label: 'POST /orders',
      protocol: 'http',
      direction: 'forward',
      showLabel: false,
      fromTitle: 'A',
      toTitle: 'B',
      focused: false,
      ...data,
    },
  } as unknown as EdgeProps<DeckFlowEdge>;
  return render(
    <svg>
      <DeckEdge {...props} />
    </svg>,
  );
}

describe('DeckEdge', () => {
  it('shows the label pill only when Labels is on', () => {
    renderEdge({ showLabel: true });
    expect(screen.getByTestId('edge-label')).toHaveTextContent('POST /orders');
  });

  it('hides the pill when Labels is off', () => {
    renderEdge({ showLabel: false });
    expect(screen.queryByTestId('edge-label')).not.toBeInTheDocument();
  });

  it('shows no pill for an empty label', () => {
    renderEdge({ showLabel: true, label: '' });
    expect(screen.queryByTestId('edge-label')).not.toBeInTheDocument();
  });

  it.each([
    ['forward', 1],
    ['both', 2],
    ['none', 0],
  ] as const)('draws end dots for direction %s', (direction, count) => {
    renderEdge({ direction });
    expect(screen.queryAllByTestId('edge-dot')).toHaveLength(count);
  });

  it('draws a focus ring for the keyboard-focused edge', () => {
    renderEdge({ focused: true });
    expect(screen.getByTestId('edge-focus-ring')).toBeInTheDocument();
  });

  it('places a popover anchor when selected', () => {
    const { container } = renderEdge({}, true);
    expect(container.querySelector('[data-edge-anchor="e1"]')).not.toBeNull();
  });
});
