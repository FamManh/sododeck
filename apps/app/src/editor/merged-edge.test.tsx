import { render, screen } from '@testing-library/react';
import type * as XYFlow from '@xyflow/react';
import { Position, type EdgeProps } from '@xyflow/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { MergedFlowEdge } from './deck-to-flow';
import { MergedEdge } from './merged-edge';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof XYFlow>();
  return { ...actual, EdgeLabelRenderer: ({ children }: { children: ReactNode }) => children };
});

function renderEdge(direction: 'a-to-b' | 'b-to-a' | 'both' = 'both') {
  const props = {
    id: 'merged:a|b',
    source: 'a',
    target: 'b',
    sourceX: 0,
    sourceY: 0,
    targetX: 200,
    targetY: 40,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      count: 12,
      direction,
      edgeIds: Array.from({ length: 12 }, (_, index) => `e${String(index)}`),
      focused: false,
    },
  } as unknown as EdgeProps<MergedFlowEdge>;
  return render(
    <svg>
      <MergedEdge {...props} />
    </svg>,
  );
}

describe('MergedEdge', () => {
  it('renders the ×N pill with a direction icon', () => {
    renderEdge('both');
    expect(screen.getByTestId('merged-edge-label')).toHaveTextContent('×12');
    expect(screen.getByRole('img', { name: 'Both directions' })).toBeInTheDocument();
  });

  it('shows a single-direction icon when the connections only go one way', () => {
    renderEdge('a-to-b');
    expect(screen.getByRole('img', { name: 'Forward direction' })).toBeInTheDocument();
  });
});
