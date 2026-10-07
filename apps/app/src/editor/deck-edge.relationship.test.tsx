import { render, screen } from '@testing-library/react';
import type * as XYFlow from '@xyflow/react';
import { Position, type EdgeProps } from '@xyflow/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_SELECTION, useUiStore } from '../state/ui-store';
import { encodeWaypoint } from './routing/connector-geometry';

import { DeckEdge } from './deck-edge';
import type { DeckEdgeData, DeckFlowEdge, RelationshipData } from './deck-to-flow';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof XYFlow>();
  return { ...actual, EdgeLabelRenderer: ({ children }: { children: ReactNode }) => children };
});
vi.mock('./routing/label-handle', () => ({ LabelHandle: () => null }));
vi.mock('./routing/route-handles', () => ({
  RouteHandles: ({
    context,
    segment,
    anchors,
    ends,
  }: {
    context: unknown;
    segment?: unknown;
    anchors?: unknown;
    ends?: unknown;
  }) => (
    <div
      data-testid="route-handles"
      data-context={JSON.stringify(context)}
      data-segment={segment === undefined ? undefined : JSON.stringify(segment)}
      data-anchors={String(anchors !== undefined || ends !== undefined)}
    />
  ),
  RelationshipEndHandles: () => (
    <>
      <div data-testid="relationship-end-from" />
      <div data-testid="relationship-end-to" />
    </>
  ),
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
  columns: { from: ['orders.customer_id'], to: ['customers.id'] },
  ...over,
});

/** `orders` at (0, 0), `customers` at (400, 100): handles at the side midpoints. */
function renderRel(
  data: Partial<DeckEdgeData>,
  geometry: Partial<EdgeProps> = {},
  selected = false,
) {
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
    selected,
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

describe('DeckEdge special shapes (042 US4)', () => {
  it('loops a self-reference on the right side', () => {
    const { container } = renderRel(
      {
        rel: rel({
          self: true,
          ends: {
            from: { offsets: [106], kind: 'row', mark: 'zero-many' },
            to: { offsets: [82], kind: 'row', mark: 'one' },
          },
        }),
      },
      // One table: both handles on its right side.
      { targetX: 240, targetY: 100, targetPosition: Position.Right },
    );
    const d = linePath(container);
    expect(d.startsWith('M 240 106 L 264 106 C')).toBe(true);
    expect(d.endsWith('L 240 82')).toBe(true);
  });

  it('draws composite member stubs joined by one bracket', () => {
    renderRel({
      rel: rel({
        ends: {
          from: { offsets: [82, 106], kind: 'row', mark: 'zero-many' },
          to: { offsets: [82, 106], kind: 'row', mark: 'one' },
        },
      }),
    });
    expect(screen.getByTestId('relationship-bracket').getAttribute('d')).toBe(
      'M 240 82 L 246 82 M 240 106 L 246 106 M 246 82 L 246 106 M 400 182 L 394 182 M 400 206 L 394 206 M 394 182 L 394 206',
    );
  });

  it('draws many marks at both ends of n–n with the label', () => {
    renderRel({
      label: 'n–n',
      showLabel: true,
      rel: rel({
        ends: {
          from: { offsets: [94], kind: 'row', mark: 'zero-many' },
          to: { offsets: [82], kind: 'row', mark: 'one-many' },
        },
      }),
    });
    expect(screen.getByRole('img', { name: 'zero or many' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'one or many' })).toBeInTheDocument();
    expect(screen.getByTestId('edge-label')).toHaveTextContent('n–n');
  });

  it('draws mismatched composite lengths without errors', () => {
    renderRel({
      rel: rel({
        ends: {
          from: { offsets: [82, 106, 130], kind: 'row' },
          to: { offsets: [82], kind: 'row' },
        },
      }),
    });
    expect(screen.getByTestId('relationship-bracket')).toBeInTheDocument();
  });
});

describe('DeckEdge relationship problems (047 US1)', () => {
  const mark = (severity: 'error' | 'warning', short?: string) => ({
    count: 1,
    titles: 'Type mismatch',
    label: '1 problem',
    severity,
    rows: new Map(),
    rowText: new Map(),
    ...(short === undefined ? {} : { short }),
  });
  const line = (container: HTMLElement) => container.querySelector('path.react-flow__edge-path');

  it('dashes the line in the severity colour and writes the short text in the pill', () => {
    const { container } = renderRel({ problems: mark('error', 'int → uuid') });
    expect(line(container)).toHaveStyle({
      stroke: 'var(--color-clay-ink)',
      strokeDasharray: '6 4',
    });
    expect(screen.getByTestId('problem-short')).toHaveTextContent('int → uuid');
    expect(screen.getByTestId('problem-short')).toHaveAttribute('data-severity', 'error');
    expect(screen.queryByTestId('problem-glyph')).toBeNull();
  });

  it('uses amber for a warning and keeps the glyph when there is no short text', () => {
    const { container } = renderRel({ problems: mark('warning') });
    expect(line(container)).toHaveStyle({ stroke: 'var(--color-amber-ink)' });
    expect(screen.getByTestId('problem-glyph')).toBeInTheDocument();
  });

  it('draws a relationship without problems as before', () => {
    const { container } = renderRel({});
    expect(line(container)).not.toHaveStyle({ strokeDasharray: '6 4' });
    expect(screen.queryByTestId('problem-short')).toBeNull();
  });
});

describe('DeckEdge relationship reshaping (064 US3)', () => {
  const select = () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['r1'] } });
  };
  afterEach(() => {
    useUiStore.setState({ selection: EMPTY_SELECTION, bendPreview: null });
  });
  const handles = () => screen.queryByTestId('route-handles');
  const json = (name: string) => {
    const raw = handles()?.getAttribute(name);
    return raw === null || raw === undefined ? null : (JSON.parse(raw) as Record<string, unknown>);
  };

  it('gives a selected elbow relationship path handles between its stub tips, ends kept', () => {
    select();
    renderRel({ shape: 'elbow', routable: true }, {}, true);
    expect(json('data-context')).toMatchObject({
      edgeId: 'r1',
      start: { x: 264, y: 94 },
      end: { x: 376, y: 182 },
      bends: [],
      fromCentre: { x: 120, y: 100 },
      toCentre: { x: 520, y: 200 },
    });
    expect(json('data-segment')).toMatchObject({
      mode: 'relationship',
      fromSide: 'right',
      toSide: 'left',
    });
    // No anchor handles: the row ends are the relationship end handles.
    expect(handles()).toHaveAttribute('data-anchors', 'false');
    expect(screen.getByTestId('relationship-end-from')).toBeInTheDocument();
    expect(screen.getByTestId('relationship-end-to')).toBeInTheDocument();
  });

  it('gives a curved relationship bend handles without segments', () => {
    select();
    renderRel({ shape: 'curved', routable: true }, {}, true);
    expect(handles()).toBeInTheDocument();
    expect(json('data-segment')).toBeNull();
  });

  it('shows no path handles on a straight relationship, a loop, or below the row zoom', () => {
    select();
    const straight = renderRel({ shape: 'straight', routable: true }, {}, true);
    expect(handles()).toBeNull();
    straight.unmount();
    const loop = renderRel(
      { shape: 'elbow', routable: true, rel: rel({ self: true }) },
      { targetX: 240, targetY: 100, targetPosition: Position.Right },
      true,
    );
    expect(handles()).toBeNull();
    loop.unmount();
    renderRel({ shape: 'elbow', routable: true, rel: rel({ rows: false }) }, {}, true);
    expect(handles()).toBeNull();
  });

  it('reshapes a composite relationship too', () => {
    select();
    renderRel(
      {
        shape: 'elbow',
        routable: true,
        rel: rel({
          ends: {
            from: { offsets: [82, 106], kind: 'row', mark: 'zero-many' },
            to: { offsets: [82], kind: 'row', mark: 'one' },
          },
          columns: { from: ['a', 'b'], to: ['customers.id'] },
        }),
      },
      {},
      true,
    );
    expect(json('data-context')).toMatchObject({ start: { x: 270, y: 94 } });
  });

  it('draws stored bends and keeps them relative when a table moves', () => {
    select();
    const waypoints = [
      encodeWaypoint({ x: 330, y: 94 }, { x: 120, y: 100 }, { x: 520, y: 200 }),
      encodeWaypoint({ x: 330, y: 182 }, { x: 120, y: 100 }, { x: 520, y: 200 }),
    ];
    const first = renderRel({ shape: 'elbow', routable: true, route: { waypoints } }, {}, true);
    const bends = (json('data-context')?.bends ?? []) as { x: number; y: number }[];
    expect(bends.map((p) => Math.round(p.x))).toEqual([330, 330]);
    expect(linePath(first.container)).toContain('330');
    first.unmount();
    // `customers` moved 100 px right: the bends follow the centres (FR-017).
    renderRel(
      { shape: 'elbow', routable: true, route: { waypoints } },
      { targetX: 500, targetY: 200 },
      true,
    );
    const moved = (json('data-context')?.bends ?? []) as { x: number; y: number }[];
    // x is stored as a fraction of the centre span: 120 + 0.525 × 500.
    expect(moved.map((p) => Math.round(p.x))).toEqual([383, 383]);
  });

  it('draws a straight relationship without its stored bends', () => {
    const waypoints = [{ x: 0.5, dy: -80 }];
    const { container } = renderRel({ shape: 'straight', route: { waypoints } });
    expect(linePath(container)).toBe('M 240 94 L 400 182');
  });
});
