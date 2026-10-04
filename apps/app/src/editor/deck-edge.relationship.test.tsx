import { render, screen } from '@testing-library/react';
import type * as XYFlow from '@xyflow/react';
import { Position, type EdgeProps } from '@xyflow/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DeckEdge } from './deck-edge';
import type { DeckEdgeData, DeckFlowEdge, RelationshipData } from './deck-to-flow';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof XYFlow>();
  return { ...actual, EdgeLabelRenderer: ({ children }: { children: ReactNode }) => children };
});
vi.mock('./routing/label-handle', () => ({ LabelHandle: () => null }));
vi.mock('./routing/route-handles', () => ({
  RouteHandles: () => <div data-testid="route-handles" />,
}));

const SIZE = { width: 240, height: 200 };

const rel = (over: Partial<RelationshipData> = {}): RelationshipData => ({
  ends: {
    from: { offsets: [94], kind: 'row', mark: 'zero-many' },
    to: { offsets: [82], kind: 'row', mark: 'one' },
  },
  rows: true,
  self: false,
  notation: 'crow',
  hideEnds: false,
  ...over,
});

/** `orders` at (0, 0), `customers` at (400, 100): handles at the side midpoints. */
function renderRel(data: Partial<DeckEdgeData>, geometry: Partial<EdgeProps> = {}) {
  const props = {
    id: 'r1',
    source: 'orders',
    target: 'customers',
    sourceX: 240,
    sourceY: 100,
    targetX: 400,
    targetY: 200,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    ...geometry,
    selected: false,
    data: {
      label: undefined,
      direction: 'forward',
      showLabel: false,
      fromTitle: 'orders',
      toTitle: 'customers',
      focused: false,
      shape: 'curved',
      fromSize: SIZE,
      toSize: SIZE,
      rel: rel(),
      ...data,
    },
  } as unknown as EdgeProps<DeckFlowEdge>;
  return render(
    <svg>
      <DeckEdge {...props} />
    </svg>,
  );
}

const linePath = (container: HTMLElement) =>
  container.querySelector('path.react-flow__edge-path')?.getAttribute('d') ?? '';

describe('DeckEdge relationship (042 US1)', () => {
  it('draws from the row anchors on 24 px stubs', () => {
    const { container } = renderRel({});
    expect(linePath(container).startsWith('M 240 94 L 264 94')).toBe(true);
    expect(linePath(container).endsWith('L 400 182')).toBe(true);
  });

  it('names its ends and draws no knob or arrow', () => {
    renderRel({});
    expect(screen.getByRole('img', { name: 'zero or many' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'exactly one' })).toBeInTheDocument();
    expect(screen.queryByTestId('edge-knob')).toBeNull();
    expect(screen.queryByTestId('edge-arrow')).toBeNull();
  });

  it('draws line and marks in the palette colour', () => {
    const { container } = renderRel({ style: { color: 'violet' } });
    const stroke = (container.querySelector('path.react-flow__edge-path') as SVGElement).style
      .stroke;
    expect(stroke).not.toBe('');
    expect((screen.getByTestId('relationship-ends') as unknown as SVGElement).style.color).toBe(
      stroke,
    );
  });

  it('draws plain ends without a cardinality, or with ends hidden', () => {
    renderRel({
      rel: rel({
        ends: { from: { offsets: [94], kind: 'row' }, to: { offsets: [82], kind: 'row' } },
      }),
    });
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(screen.queryByTestId('edge-arrow')).toBeNull();
  });

  it('draws 1 / n text marks', () => {
    renderRel({ rel: rel({ notation: 'numeric' }) });
    expect(screen.getByText('0..n')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('switches sides live when the tables swap', () => {
    const { container } = renderRel(
      {},
      { sourceX: 800, sourceY: 100, sourcePosition: Position.Left },
    );
    // `orders` now sits right of `customers`: it leaves its left side.
    expect(linePath(container).startsWith('M 800 94 L 776 94')).toBe(true);
  });

  it('keeps a hover-only label hidden by class until lit', () => {
    renderRel({ label: 'placed by', hoverLabel: true });
    expect(screen.getByTestId('edge-label')).toHaveClass('sd-rel-hover-label');
    expect(screen.getByTestId('edge-label')).toHaveTextContent('placed by');
  });
});
