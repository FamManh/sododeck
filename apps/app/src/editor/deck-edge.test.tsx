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

describe('DeckEdge flow marks (006 research R6)', () => {
  const badge = (label: string, errorPath = false) => ({
    label,
    errorPath,
    current: false,
    chainBreak: false,
  });

  it('draws numbered badges on a solid path with the connection label', () => {
    renderEdge({ flow: { badges: [badge('2'), badge('5')], style: 'path', errorIcon: false } });
    expect(screen.getByRole('img', { name: 'Step 2' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Step 5' })).toBeInTheDocument();
    expect(screen.getByTestId('edge-label')).toHaveTextContent('POST /orders');
    expect(screen.getByTestId('edge-label')).toHaveAttribute('data-flow-style', 'path');
  });

  it('marks an error path with an icon and its name, not by color alone', () => {
    const { container } = renderEdge({
      flow: { badges: [badge('4b', true)], style: 'error', errorIcon: true },
    });
    expect(screen.getByRole('img', { name: 'Step 4b, error path' })).toBeInTheDocument();
    expect(container.querySelector('.react-flow__edge-path')).toHaveStyle({
      strokeDasharray: '6 4',
    });
  });

  it('marks a refused edge with the ban icon and a dashed line', () => {
    const { container } = renderEdge({ flow: { badges: [], style: 'invalid', errorIcon: false } });
    expect(screen.getByRole('img', { name: "Can't add this edge" })).toBeInTheDocument();
    expect(container.querySelector('.react-flow__edge-path')).toHaveStyle({
      strokeDasharray: '6 4',
    });
  });

  it('draws candidates dotted and keeps an anchor for the popover', () => {
    const { container } = renderEdge({
      flow: { badges: [], style: 'candidate', errorIcon: false },
    });
    expect(container.querySelector('.react-flow__edge-path')).toHaveStyle({
      strokeDasharray: '2 4',
    });
    expect(container.querySelector('[data-edge-anchor="e1"]')).not.toBeNull();
  });
});

describe('DeckEdge in flow mode (007)', () => {
  const mark = (current: { speed: 1 | 2 } | null, inPath = true) => ({
    badges: [{ label: '2', errorPath: false, current: current !== null, chainBreak: false }],
    style: 'path' as const,
    errorIcon: false,
    inPath,
    current,
  });

  it('draws the current edge thicker with a filled label and a looping token', () => {
    const { container } = renderEdge({ flow: mark({ speed: 1 }) });
    expect(container.querySelector('.react-flow__edge-path')).toHaveStyle({ strokeWidth: '3' });
    const label = screen.getByTestId('edge-label');
    expect(label).toHaveClass('bg-primary');
    expect(label).toHaveAttribute('data-in-flow');
    const token = screen.getByTestId('flow-token');
    expect(token.querySelector('animateMotion')).toHaveAttribute('dur', '1400ms');
  });

  it('loops twice as fast at 2×', () => {
    renderEdge({ flow: mark({ speed: 2 }) });
    expect(screen.getByTestId('flow-token').querySelector('animateMotion')).toHaveAttribute(
      'dur',
      '700ms',
    );
  });

  it('draws no token on other edges, and dims labels off the path', () => {
    renderEdge({ flow: mark(null, false) });
    expect(screen.queryByTestId('flow-token')).toBeNull();
    expect(screen.getByTestId('edge-label')).not.toHaveAttribute('data-in-flow');
  });

  it('keeps the token static at the midpoint under reduced motion', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('reduce'),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    renderEdge({ flow: mark({ speed: 1 }) });
    const token = screen.getByTestId('flow-token');
    expect(token.querySelector('animateMotion')).toBeNull();
    expect(token.getAttribute('transform')).toMatch(/^translate\(/);
    spy.mockRestore();
  });
});
