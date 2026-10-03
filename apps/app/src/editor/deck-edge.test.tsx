import { render, screen } from '@testing-library/react';
import type * as XYFlow from '@xyflow/react';
import { Position, type EdgeProps } from '@xyflow/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeckEdge } from './deck-edge';
import { routedPath } from './routing/route-path';
import type { DeckEdgeData, DeckFlowEdge } from './deck-to-flow';
import { EMPTY_SELECTION, useUiStore } from '../state/ui-store';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof XYFlow>();
  // The real renderer portals into the React Flow viewport; inline it for the test.
  return { ...actual, EdgeLabelRenderer: ({ children }: { children: ReactNode }) => children };
});

// The handles themselves (pointer/keyboard drag, ReactFlow + editor context) are
// `route-handles.test.tsx`'s job; here only their render-gating in `deck-edge.tsx` is under test.
vi.mock('./routing/label-handle', () => ({
  LabelHandle: () => <div data-testid="label-handle" />,
}));

vi.mock('./routing/route-handles', () => ({
  RouteHandles: () => <div data-testid="route-handles" />,
}));

function renderEdge(
  data: Partial<DeckEdgeData>,
  selected = false,
  geometry: {
    sourceX?: number;
    sourceY?: number;
    targetX?: number;
    targetY?: number;
    sourcePosition?: Position;
    targetPosition?: Position;
  } = {},
) {
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
    ...geometry,
    selected,
    data: {
      label: 'POST /orders',
      protocol: 'http',
      direction: 'forward',
      showLabel: false,
      fromTitle: 'A',
      toTitle: 'B',
      focused: false,
      shape: 'elbow',
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
  it('shows a problem glyph on its pill, even with labels off (015 FR-022)', () => {
    renderEdge({ problems: { count: 1, titles: 'Duplicate connection', label: '1 problem' } });
    expect(screen.getByTestId('edge-label')).not.toHaveTextContent('POST /orders');
    expect(screen.getByTestId('problem-glyph')).toHaveAttribute('title', 'Duplicate connection');
  });

  it('keeps step badges first when a flow step and a problem share the pill (015 T030)', () => {
    renderEdge({
      flow: {
        badges: [{ label: '2', errorPath: false, current: false, chainBreak: false }],
        style: 'path',
        errorIcon: false,
      },
      problems: { count: 1, titles: 'Duplicate connection', label: '1 problem' },
    });
    const pill = screen.getByTestId('edge-label');
    const children = [...pill.children];
    expect(children.indexOf(screen.getByRole('img', { name: /Step 2/ }))).toBeLessThan(
      children.indexOf(screen.getByTestId('problem-glyph')),
    );
  });

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
    ['forward', { knobs: 1, arrows: 1 }],
    ['both', { knobs: 0, arrows: 2 }],
    ['none', { knobs: 2, arrows: 0 }],
  ] as const)('draws the end marks for direction %s (029)', (direction, expected) => {
    renderEdge({ direction });
    expect(screen.queryAllByTestId('edge-knob')).toHaveLength(expected.knobs);
    expect(screen.queryAllByTestId('edge-arrow')).toHaveLength(expected.arrows);
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

describe('DeckEdge Deck look (029 US1)', () => {
  const at = (x: number, y: number) => ({ x, y, width: 0, height: 0 });

  it('draws the connector from routedPath, 2 px in the Deck edge colour', () => {
    const { container } = renderEdge({ direction: 'forward' });
    const path = container.querySelector('.react-flow__edge-path');
    const expected = routedPath('elbow', at(0, 0), at(200, 40), ['right', 'left'], 0, {
      arrowAtStart: false,
      arrowAtEnd: true,
    }).path;
    expect(path?.getAttribute('d')).toBe(expected);
    expect(path).toHaveStyle({ stroke: 'var(--color-deck-edge)', strokeWidth: '2' });
  });

  it('stops the line short of the end that carries an arrow, by direction', () => {
    const none = renderEdge({ direction: 'none' }).container.querySelector(
      '.react-flow__edge-path',
    );
    expect(none?.getAttribute('d')).toBe(
      routedPath('elbow', at(0, 0), at(200, 40), ['right', 'left'], 0, {
        arrowAtStart: false,
        arrowAtEnd: false,
      }).path,
    );
  });

  it('gives a selected connector 2.5 px in Deck Orange', () => {
    const { container } = renderEdge({}, true);
    expect(container.querySelector('.react-flow__edge-path')).toHaveStyle({
      stroke: 'var(--color-deck-orange)',
      strokeWidth: '2.5',
    });
  });

  it('colours the end marks like the line', () => {
    renderEdge({ direction: 'forward' }, true);
    expect(screen.getByTestId('edge-arrow').closest('g')).toHaveStyle({
      color: 'var(--color-deck-orange)',
    });
  });
});

describe('DeckEdge routing (017 R6)', () => {
  it('shifts the label pill and the edge anchor to the offset labelX, for a horizontal pair', () => {
    const { container } = renderEdge({
      route: { offset: 60 },
      showLabel: true,
      flow: {
        badges: [{ label: '2', errorPath: false, current: true, chainBreak: false }],
        style: 'path',
        errorIcon: false,
        current: { speed: 1, number: '2' },
      },
    });
    const anchor = container.querySelector('[data-edge-anchor="e1"]');
    const label = screen.getByTestId('edge-label');
    const token = screen.getByTestId('flow-token');
    const anchorTransform = anchor?.getAttribute('style') ?? '';
    const labelTransform = label.getAttribute('style') ?? '';
    // Both sit at the same offset labelX (the anchor has no translate(-50%, -50%) prefix).
    const anchorMatch = /translate\((-?\d+(?:\.\d+)?)px/.exec(anchorTransform);
    const labelMatch = /translate\(-50%, -50%\) translate\((-?\d+(?:\.\d+)?)px/.exec(
      labelTransform,
    );
    expect(anchorMatch?.[1]).toBe(labelMatch?.[1]);
    expect(Number(anchorMatch?.[1])).not.toBe(100); // 100 is the unrouted midpoint for this fixture
    // The flow token draws the same `d` as the base edge path, so it follows the offset route.
    const tokenPath = token.querySelector('animateMotion')?.getAttribute('path');
    const basePath = container.querySelector('.react-flow__edge-path')?.getAttribute('d');
    expect(tokenPath).toBe(basePath);
  });

  // 017 R7 / T038: the three canvas-level scenarios (a selected connector between stacked cards
  // shows the slider; a perpendicular-sides one shows none; a flow-highlighted offset connector
  // draws its highlight on the shifted path) as `DeckEdge` unit tests, not a `canvas.test.tsx`
  // mount: React Flow never measures node size under jsdom, so `<Canvas>` draws nodes but no
  // edges at all (see the same note on "canvas in flow mode (007)" in `canvas.test.tsx`) — there
  // is nothing to query there. The gating tests below, and this one, cover the same three cases.
  it('draws the current step thicker on the shifted path, for a vertical (stacked) pair', () => {
    const { container } = renderEdge(
      {
        route: { offset: 30 },
        showLabel: true,
        flow: { badges: [], style: 'path', errorIcon: false, current: { speed: 1, number: '2' } },
      },
      false,
      {
        sourceX: 82,
        sourceY: 104,
        targetX: 82,
        targetY: 300,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
    );
    const path = container.querySelector('.react-flow__edge-path');
    expect(path).toHaveStyle({ strokeWidth: '3.25' });
    const token = screen.getByTestId('flow-token');
    const tokenPath = token.querySelector('animateMotion')?.getAttribute('path');
    expect(tokenPath).toBe(path?.getAttribute('d'));
    // 82 is the unrouted midpoint x for this vertical pair; the offset moves the segment's x.
    expect(path?.getAttribute('d')).not.toContain('82,');
  });
});

describe('DeckEdge line type (029 T044)', () => {
  const at = (x: number, y: number) => ({ x, y, width: 0, height: 0 });
  const arrows = { arrowAtStart: false, arrowAtEnd: true };

  it.each(['curved', 'elbow', 'straight'] as const)('draws the %s path', (shape) => {
    const { container } = renderEdge({ shape });
    expect(container.querySelector('.react-flow__edge-path')?.getAttribute('d')).toBe(
      routedPath(shape, at(0, 0), at(200, 40), ['right', 'left'], 0, arrows).path,
    );
  });

  it('draws a curved line as a bezier, not right angles', () => {
    const { container } = renderEdge({ shape: 'curved' });
    expect(container.querySelector('.react-flow__edge-path')?.getAttribute('d')).toContain('C');
  });

  it('shows the route handles for curved and elbow lines, not for a straight one (022)', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'] } });
    for (const shape of ['curved', 'elbow'] as const) {
      const { unmount } = renderEdge({ routable: true, shape }, true);
      expect(screen.getByTestId('route-handles')).toBeInTheDocument();
      unmount();
    }
    renderEdge({ routable: true, shape: 'straight' }, true);
    expect(screen.queryByTestId('route-handles')).toBeNull();
    useUiStore.setState({ selection: EMPTY_SELECTION });
  });
});

describe('DeckEdge route handles gating (022)', () => {
  afterEach(() => {
    useUiStore.setState({ selection: EMPTY_SELECTION, flowSession: null, activeFlow: null });
  });

  it('shows the handles for the single selected, routable connector', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'] } });
    renderEdge({ routable: true }, true);
    expect(screen.getByTestId('route-handles')).toBeInTheDocument();
  });

  it('hides the handles when the edge is not selected', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'] } });
    renderEdge({ routable: true }, false);
    expect(screen.queryByTestId('route-handles')).toBeNull();
  });

  it('hides the handles with other items in the selection', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'], nodes: ['n1'] } });
    renderEdge({ routable: true }, true);
    expect(screen.queryByTestId('route-handles')).toBeNull();
  });

  it('hides the handles in flow mode', () => {
    useUiStore.setState({
      selection: { ...EMPTY_SELECTION, edges: ['e1'] },
      activeFlow: {
        flowId: 'f1',
        stepId: null,
        branchId: null,
        alternativeId: null,
        playing: false,
        speed: 1,
      },
    });
    renderEdge({ routable: true }, true);
    expect(screen.queryByTestId('route-handles')).toBeNull();
  });

  it('hides the handles for a non-routable edge (a port or merged edge)', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'] } });
    renderEdge({ routable: false }, true);
    expect(screen.queryByTestId('route-handles')).toBeNull();
  });
});

describe('DeckEdge label position (022 US4)', () => {
  afterEach(() => {
    useUiStore.setState({ labelPreview: null, selection: EMPTY_SELECTION });
  });
  /** The pill's transform, with the render removed again so renders can be compared. */
  const pillTransform = (
    data: Partial<DeckEdgeData>,
    geometry: Parameters<typeof renderEdge>[2] = {},
  ) => {
    const view = renderEdge(
      { shape: 'straight', showLabel: true, routable: true, ...data },
      false,
      geometry,
    );
    const transform = view.getByTestId('edge-label').style.transform;
    view.unmount();
    return transform;
  };

  it('puts the label at labelAt along the line, never rotated', () => {
    // straight line from (0, 0) to (200, 40) minus the arrow: the pill is moved with labelAt
    const middle = pillTransform({});
    const early = pillTransform({ labelAt: 0.2 });
    expect(early).not.toBe(middle);
    expect(early).not.toMatch(/rotate/);
  });

  it('keeps the label at that fraction after the cards move', () => {
    const x = (offset: number) => {
      const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)$/.exec(
        pillTransform({ labelAt: 0.25 }, { sourceX: offset, targetX: offset + 200 }),
      );
      return Number(m?.[1]);
    };
    expect(x(100) - x(0)).toBeCloseTo(100, 6);
  });

  it('follows a label drag from the UI store', () => {
    const rest = pillTransform({ labelAt: 0.5 });
    useUiStore.setState({ labelPreview: { edgeId: 'e1', at: 0.2, snapped: false } });
    expect(pillTransform({ labelAt: 0.5 })).not.toBe(rest);
  });

  it('offers the draggable label only for the selected, routable, labelled connector', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'] } });
    renderEdge({ shape: 'straight', showLabel: true, routable: true }, true);
    expect(screen.getByTestId('label-handle')).toBeInTheDocument();
  });

  it('hides it when the label is off, or the edge is not selected', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'] } });
    renderEdge({ shape: 'straight', showLabel: false, routable: true }, true);
    expect(screen.queryByTestId('label-handle')).toBeNull();
    renderEdge({ shape: 'straight', showLabel: true, routable: true }, false);
    expect(screen.queryByTestId('label-handle')).toBeNull();
  });
});

describe('DeckEdge anchors (022 US3)', () => {
  const sizes = { fromSize: { width: 160, height: 50 }, toSize: { width: 160, height: 50 } };

  it('starts the line at fromAt along the pinned side and follows the card', () => {
    // source handle = right-side midpoint of a 160 × 50 card whose top-left is (0, 0)
    const at = (y: number) =>
      renderEdge({ shape: 'straight', ...sizes, route: { fromSide: 'right', fromAt: 0 } }, false, {
        sourceX: 160,
        sourceY: 25 + y,
        targetX: 400,
        targetY: 25 + y,
      })
        .container.querySelector('.react-flow__edge-path')
        ?.getAttribute('d');
    expect(at(0)).toMatch(/^M ?160[ ,]0 /);
    // moving the card down moves the end with it
    expect(at(100)).toMatch(/^M ?160[ ,]100 /);
  });
});

describe('DeckEdge bends (022 US2)', () => {
  const sizes = { fromSize: { width: 160, height: 50 }, toSize: { width: 160, height: 50 } };
  // Handles are the side midpoints: right of the source box, left of the target box.
  const geometry = { sourceX: 160, sourceY: 25, targetX: 400, targetY: 25 };
  const pathOf = (data: Partial<DeckEdgeData>, geo = geometry) =>
    renderEdge({ shape: 'elbow', ...sizes, ...data }, false, geo)
      .container.querySelector('.react-flow__edge-path')
      ?.getAttribute('d');

  afterEach(() => {
    useUiStore.setState({ bendPreview: null, selection: EMPTY_SELECTION });
  });

  it('draws a path through the stored bends, relative to both cards', () => {
    const plain = pathOf({});
    const bent = pathOf({ route: { waypoints: [{ x: 0.5, dy: -80 }] } });
    expect(bent).not.toBe(plain);
  });

  it('moving both cards by the same delta translates the path exactly', () => {
    const route = { waypoints: [{ x: 0.5, dy: -80 }] };
    const a = pathOf({ route });
    const b = pathOf({ route }, { sourceX: 210, sourceY: 75, targetX: 450, targetY: 75 });
    const numbers = (d: string | null | undefined) => d?.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    expect(numbers(b).length).toBe(numbers(a).length);
    numbers(a).forEach((n, i) => {
      expect(numbers(b)[i]).toBeCloseTo(n + 50, 6);
    });
  });

  it('draws the same bends with each shape, and none for straight', () => {
    const route = { waypoints: [{ x: 0.5, dy: -80 }] };
    const curved = pathOf({ shape: 'curved', route });
    const straight = pathOf({ shape: 'straight', route });
    expect(curved).toContain('C');
    expect(straight).toBe(pathOf({ shape: 'straight' }));
  });

  it('draws the live bends of a drag, and the previous route as a 40 % ghost', () => {
    useUiStore.setState({
      selection: { ...EMPTY_SELECTION, edges: ['e1'] },
      bendPreview: { edgeId: 'e1', bends: [{ x: 280, y: -100 }] },
    });
    const route = { waypoints: [{ x: 0.5, dy: -80 }] };
    const { container } = renderEdge(
      { shape: 'elbow', ...sizes, routable: true, route },
      true,
      geometry,
    );
    expect(screen.getByTestId('edge-route-ghost')).toBeInTheDocument();
    const live = container.querySelector('.react-flow__edge-path')?.getAttribute('d');
    expect(live).not.toBe(screen.getByTestId('edge-route-ghost').getAttribute('d'));
  });

  it("draws no ghost without a bend gesture or for another connector's gesture", () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'] } });
    renderEdge({ routable: true, route: { offset: 40 } }, true);
    expect(screen.queryByTestId('edge-route-ghost')).toBeNull();
    useUiStore.setState({ bendPreview: { edgeId: 'other', bends: [] } });
    renderEdge({ routable: true, route: { offset: 40 } }, true);
    expect(screen.queryByTestId('edge-route-ghost')).toBeNull();
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
      strokeDasharray: '7 4',
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
  const mark = (current: { speed: 1 | 2; number: string } | null, inPath = true) => ({
    badges: [{ label: '2', errorPath: false, current: current !== null, chainBreak: false }],
    style: 'path' as const,
    errorIcon: false,
    inPath,
    current,
  });

  it('draws the current edge thicker with a filled label and a looping token', () => {
    const { container } = renderEdge({ flow: mark({ speed: 1, number: '2' }) });
    expect(container.querySelector('.react-flow__edge-path')).toHaveStyle({ strokeWidth: '3.25' });
    const label = screen.getByTestId('edge-label');
    expect(label).toHaveClass('bg-primary');
    expect(label).toHaveAttribute('data-in-flow');
    expect(label).toHaveAttribute('aria-current', 'step');
    const token = screen.getByTestId('flow-token');
    expect(token.querySelector('animateMotion')).toHaveAttribute('dur', '1400ms');
  });

  it('loops twice as fast at 2×', () => {
    renderEdge({ flow: mark({ speed: 2, number: '2' }) });
    expect(screen.getByTestId('flow-token').querySelector('animateMotion')).toHaveAttribute(
      'dur',
      '700ms',
    );
  });

  it('draws no token on other edges, and dims labels off the path', () => {
    renderEdge({ flow: mark(null, false) });
    expect(screen.queryByTestId('flow-token')).toBeNull();
    expect(screen.getByTestId('edge-label')).not.toHaveAttribute('data-in-flow');
    expect(screen.getByTestId('edge-label')).not.toHaveAttribute('aria-current');
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
    renderEdge({ flow: mark({ speed: 1, number: '2' }) });
    const token = screen.getByTestId('flow-token');
    expect(token.querySelector('animateMotion')).toBeNull();
    expect(token.getAttribute('transform')).toMatch(/^translate\(/);
    spy.mockRestore();
  });
});

describe('DeckEdge playback states (035)', () => {
  const stateMark = (
    state: 'played' | 'current' | 'upcoming',
    patch: Partial<NonNullable<DeckEdgeData['flow']>> = {},
  ): NonNullable<DeckEdgeData['flow']> => ({
    badges: [{ label: '2', errorPath: false, current: state === 'current', chainBreak: false }],
    style: 'path',
    errorIcon: false,
    inPath: true,
    state,
    current: state === 'current' ? { speed: 1, number: '2' } : null,
    ...patch,
  });
  const edgePath = (container: HTMLElement) => container.querySelector('.react-flow__edge-path');

  it('draws played in Secondary at 2.5px, solid', () => {
    const { container } = renderEdge({ flow: stateMark('played') });
    expect(edgePath(container)).toHaveStyle({
      stroke: 'var(--color-ink-secondary)',
      strokeWidth: '2.5',
    });
    expect(edgePath(container)?.getAttribute('style')).not.toContain('stroke-dasharray');
    expect(screen.getByTestId('edge-label')).toHaveAttribute('data-step-state', 'played');
  });

  it('draws current in Deck Orange at 3.25px over an 8px halo at 18 %', () => {
    const { container } = renderEdge({ flow: stateMark('current') });
    expect(edgePath(container)).toHaveStyle({
      stroke: 'var(--color-deck-orange)',
      strokeWidth: '3.25',
    });
    const halo = screen.getByTestId('edge-halo');
    expect(halo).toHaveAttribute('stroke-width', '8');
    expect(halo).toHaveAttribute('stroke-opacity', '0.18');
    expect(halo.getAttribute('d')).toBe(edgePath(container)?.getAttribute('d'));
    expect(halo).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws upcoming dashed "2 6" with round caps and no halo', () => {
    const { container } = renderEdge({ flow: stateMark('upcoming') });
    expect(edgePath(container)).toHaveStyle({ strokeDasharray: '2 6', strokeLinecap: 'round' });
    expect(screen.queryByTestId('edge-halo')).toBeNull();
  });

  it('keeps the selection colour on a selected connector', () => {
    const { container } = renderEdge({ flow: stateMark('played') }, true);
    expect(edgePath(container)).toHaveStyle({ stroke: 'var(--color-deck-orange)' });
  });

  it.each(['curved', 'elbow', 'straight'] as const)(
    'puts the numbered token on the current %s connector, on its path',
    (shape) => {
      const { container } = renderEdge({ shape, flow: stateMark('current') });
      const token = screen.getByTestId('flow-token');
      expect(token).toHaveTextContent('2');
      expect(token.querySelector('animateMotion')?.getAttribute('path')).toBe(
        edgePath(container)?.getAttribute('d'),
      );
    },
  );

  it('puts the token on a self-loop step', () => {
    renderEdge({ shape: 'curved', flow: stateMark('current') }, false, {
      sourceX: 100,
      sourceY: 0,
      targetX: 100,
      targetY: 0,
      targetPosition: Position.Right,
    });
    expect(screen.getAllByTestId('flow-token')).toHaveLength(1);
  });

  it.each(['played', 'upcoming'] as const)('draws no token on a %s connector', (state) => {
    renderEdge({ flow: stateMark(state) });
    expect(screen.queryByTestId('flow-token')).toBeNull();
  });

  describe('error paths', () => {
    const error = (state: 'played' | 'current' | 'upcoming') =>
      stateMark(state, {
        style: 'error',
        errorIcon: true,
        badges: [{ label: '4b', errorPath: true, current: state === 'current', chainBreak: false }],
      });

    it.each(['played', 'current', 'upcoming'] as const)(
      'is Clay, 2.5px, dashed "7 4" and ends in × with no arrow when %s',
      (state) => {
        const { container } = renderEdge({ flow: error(state) });
        expect(edgePath(container)).toHaveStyle({
          stroke: 'var(--color-clay-ink)',
          strokeWidth: '2.5',
          strokeDasharray: '7 4',
        });
        expect(screen.getByTestId('edge-cross')).toBeInTheDocument();
        expect(screen.queryByTestId('edge-arrow')).toBeNull();
      },
    );

    it('keeps the arrow on other connectors, in every line type', () => {
      for (const shape of ['curved', 'elbow', 'straight'] as const) {
        const { unmount } = renderEdge({ shape, flow: stateMark('played') });
        expect(screen.getByTestId('edge-arrow')).toBeInTheDocument();
        expect(screen.queryByTestId('edge-cross')).toBeNull();
        unmount();
      }
    });
  });

  describe('label pill (FR-010)', () => {
    it('is 20px tall with Surface fill, a 1.5px Border-strong border and Secondary text', () => {
      renderEdge({ flow: stateMark('played') });
      const label = screen.getByTestId('edge-label');
      expect(label).toHaveClass('h-5');
      expect(label).toHaveClass('border-[1.5px]');
      expect(label).toHaveClass('border-border-strong');
      expect(label).toHaveClass('bg-surface');
      expect(label).toHaveClass('text-ink-secondary');
    });

    it('is solid orange with On Primary text when current, and says so for AT', () => {
      renderEdge({ flow: stateMark('current') });
      const label = screen.getByTestId('edge-label');
      expect(label).toHaveClass('bg-primary');
      expect(label).toHaveClass('text-on-primary');
      expect(label).toHaveAttribute('aria-current', 'step');
      expect(label).toHaveTextContent('2');
    });

    it('is Clay Soft with a Clay border and text on an error path, with the step number', () => {
      renderEdge({
        flow: stateMark('played', {
          style: 'error',
          errorIcon: true,
          badges: [{ label: '4b', errorPath: true, current: false, chainBreak: false }],
        }),
      });
      const label = screen.getByTestId('edge-label');
      expect(label).toHaveClass('bg-clay-soft');
      expect(label).toHaveClass('border-clay-ink');
      expect(label).toHaveClass('text-clay-ink');
      expect(label).toHaveTextContent('4b');
      expect(
        screen.getByRole('img', { name: 'Step 4b, error path' }).querySelector('svg'),
      ).not.toBeNull();
    });
  });
});

describe('DeckEdge own style (022 US1)', () => {
  const edgePath = (container: HTMLElement) => container.querySelector('.react-flow__edge-path');

  it("draws no style attributes beyond today's for a connector without style", () => {
    const el = edgePath(renderEdge({}).container);
    expect(el).toHaveStyle({ stroke: 'var(--color-deck-edge)', strokeWidth: '2' });
    expect((el as HTMLElement).style.strokeDasharray).toBe('');
    expect((el as HTMLElement).style.strokeLinecap).toBe('');
  });

  it('draws the chosen dash, weight and colour', () => {
    const el = edgePath(
      renderEdge({ style: { dash: 'dashed', width: 3, color: 'blue' } }).container,
    ) as HTMLElement;
    expect(el).toHaveStyle({ stroke: 'var(--color-card-blue-stroke)', strokeWidth: '3' });
    expect(el.style.strokeDasharray).toBe('12 10.5');
  });

  it('draws dots with round caps and a custom hex that is visible enough', () => {
    const el = edgePath(
      renderEdge({ style: { dash: 'dotted', color: '#7a3cff' } }).container,
    ) as HTMLElement;
    expect(el.style.strokeDasharray).toBe('0 6');
    expect(el.style.strokeLinecap).toBe('round');
    expect(el.style.stroke).toBe('rgb(122, 60, 255)');
  });

  it('keeps selection orange and 2.5 px over the own colour and weight', () => {
    const el = edgePath(
      renderEdge({ style: { color: 'blue', width: 4 } }, true).container,
    ) as HTMLElement;
    expect(el).toHaveStyle({ stroke: 'var(--color-deck-orange)', strokeWidth: '2.5' });
  });

  it('lets a flow stroke replace the own colour and dash', () => {
    const el = edgePath(
      renderEdge({
        style: { color: 'blue', dash: 'dotted' },
        flow: { badges: [], style: 'error', errorIcon: true },
      }).container,
    ) as HTMLElement;
    expect(el.style.stroke).not.toBe('var(--color-card-blue-stroke)');
    expect(el.style.strokeDasharray).not.toBe('0 6');
  });

  it('shows the state look while it lasts and the own colour and dash again after (T044)', () => {
    const own = { color: 'blue', dash: 'dashed' } as const;
    const stroke = (data: Partial<DeckEdgeData>, selected = false) => {
      const el = edgePath(renderEdge(data, selected).container) as HTMLElement;
      const result = { stroke: el.style.stroke, dash: el.style.strokeDasharray };
      document.body.innerHTML = '';
      return result;
    };
    const flow = (style: 'path' | 'error' | 'preview' | 'invalid') => ({
      badges: [],
      style,
      errorIcon: style === 'error',
    });
    const ownLook = stroke({ style: own });
    for (const style of ['path', 'error', 'preview', 'invalid'] as const) {
      const during = stroke({ style: own, flow: flow(style) });
      expect(during.stroke).not.toBe(ownLook.stroke);
    }
    expect(stroke({ style: own, flow: flow('path') }).dash).not.toBe(ownLook.dash);
    expect(stroke({ style: own }, true).stroke).toBe('var(--color-deck-orange)');
    expect(stroke({ style: own })).toEqual(ownLook);
  });

  it('grows the arrow with the weight', () => {
    const small = renderEdge({}).container.querySelector('[data-testid="edge-arrow"]');
    const big = renderEdge({ style: { width: 4 } }).container.querySelector(
      '[data-testid="edge-arrow"]',
    );
    expect(small?.getAttribute('d')).not.toBe(big?.getAttribute('d'));
  });
});
