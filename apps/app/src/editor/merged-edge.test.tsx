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
      inFocus: false,
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

  it('draws a curved line with a knob and an arrow for one direction (029 US5)', () => {
    const { container } = renderEdge('a-to-b');
    expect(container.querySelector('path.react-flow__edge-path')?.getAttribute('d')).toContain('C');
    expect(screen.getAllByTestId('edge-arrow')).toHaveLength(1);
    expect(screen.getAllByTestId('edge-knob')).toHaveLength(1);
  });

  it('draws arrows at both ends for both directions', () => {
    renderEdge('both');
    expect(screen.getAllByTestId('edge-arrow')).toHaveLength(2);
    expect(screen.queryByTestId('edge-knob')).not.toBeInTheDocument();
  });

  it('puts the arrow at the first card when the connections run b to a', () => {
    renderEdge('b-to-a');
    // The first card's side midpoint is x = 0; the arrow path's tip starts there.
    expect(screen.getByTestId('edge-arrow').getAttribute('d')).toMatch(/^M 0 /);
  });

  it('renders folded flow badges in order and marks the current step', () => {
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
        count: 2,
        direction: 'both',
        edgeIds: ['e1', 'e2'],
        focused: false,
        inFocus: false,
        flow: {
          badges: [
            { label: '4', errorPath: false, current: false, chainBreak: false },
            { label: '5', errorPath: false, current: true, chainBreak: false },
          ],
          style: 'path',
          errorIcon: false,
          inPath: true,
          current: { speed: 2 },
        },
      },
    } as unknown as EdgeProps<MergedFlowEdge>;

    render(
      <svg>
        <MergedEdge {...props} />
      </svg>,
    );

    expect(screen.getByRole('img', { name: 'Step 4' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Step 5' })).toHaveClass('ring-2');
    expect(screen.getByTestId('merged-edge-label')).toHaveAttribute('data-in-flow', '');
    expect(screen.getByTestId('flow-token')).toBeInTheDocument();
  });
});
