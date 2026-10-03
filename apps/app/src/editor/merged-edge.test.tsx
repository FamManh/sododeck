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

  it('lets focus rules recolour and thicken a plain bundle line (034 R2)', () => {
    const { container } = renderEdge('a-to-b');
    const style = container.querySelector('.react-flow__edge-path')?.getAttribute('style');
    expect(style).toContain('var(--sd-edge-hl-stroke, var(--color-deck-edge))');
    expect(style).toContain('var(--sd-edge-hl-width, 2)');
    expect(screen.getByTestId('edge-arrow').closest('g')).toHaveStyle({
      color: 'var(--sd-edge-hl-stroke, var(--color-deck-edge))',
    });
  });

  it('names the pill so hover rules can reach the HTML layer (034)', () => {
    renderEdge('both');
    expect(screen.getByTestId('merged-edge-label')).toHaveAttribute(
      'data-edge-label-for',
      'merged:a|b',
    );
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
          state: 'current',
          current: { speed: 2, number: '5' },
        },
      },
    } as unknown as EdgeProps<MergedFlowEdge>;

    render(
      <svg>
        <MergedEdge {...props} />
      </svg>,
    );

    expect(screen.getByRole('img', { name: 'Step 4' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Step 5' })).toBeInTheDocument();
    expect(screen.getByTestId('merged-edge-label')).toHaveAttribute('data-in-flow', '');
    expect(screen.getByTestId('merged-edge-label')).toHaveAttribute('data-step-state', 'current');
    expect(screen.getByTestId('merged-edge-label')).toHaveClass('bg-primary');
    // The token carries the number of the current step the bundle folds in.
    expect(screen.getByTestId('flow-token')).toHaveTextContent('5');
  });

  describe('playback states (035)', () => {
    const flowOf = (
      state: 'played' | 'current' | 'upcoming',
      style: 'path' | 'error' = 'path',
    ) => ({
      badges: [
        {
          label: '4',
          errorPath: style === 'error',
          current: state === 'current',
          chainBreak: false,
        },
      ],
      style,
      errorIcon: style === 'error',
      inPath: true,
      state,
      current: state === 'current' ? { speed: 1 as const, number: '4' } : null,
    });
    function draw(flow: ReturnType<typeof flowOf>) {
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
          direction: 'a-to-b',
          edgeIds: ['e1', 'e2'],
          focused: false,
          inFocus: false,
          flow,
        },
      } as unknown as EdgeProps<MergedFlowEdge>;
      return render(
        <svg>
          <MergedEdge {...props} />
        </svg>,
      );
    }

    it('strokes played, current and upcoming like a plain connector', () => {
      const played = draw(flowOf('played'));
      expect(played.container.querySelector('.react-flow__edge-path')).toHaveStyle({
        stroke: 'var(--color-ink-secondary)',
        strokeWidth: '2.5',
      });
      played.unmount();
      const current = draw(flowOf('current'));
      expect(current.container.querySelector('.react-flow__edge-path')).toHaveStyle({
        stroke: 'var(--color-deck-orange)',
        strokeWidth: '3.25',
      });
      expect(screen.getByTestId('edge-halo')).toBeInTheDocument();
      current.unmount();
      const upcoming = draw(flowOf('upcoming'));
      expect(upcoming.container.querySelector('.react-flow__edge-path')).toHaveStyle({
        strokeDasharray: '2 6',
      });
    });

    it('ends an all-error bundle in × with no arrow, and no token when not current', () => {
      draw(flowOf('played', 'error'));
      expect(screen.getByTestId('edge-cross')).toBeInTheDocument();
      expect(screen.queryByTestId('edge-arrow')).toBeNull();
      expect(screen.queryByTestId('flow-token')).toBeNull();
    });
  });
});
