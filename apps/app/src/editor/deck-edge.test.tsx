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

// The handle itself (pointer/keyboard drag, ReactFlow + editor context) is `segment-handle.test.tsx`'s
// job; here only its render-gating in `deck-edge.tsx` is under test (017 R7, T035).
vi.mock('./routing/segment-handle', () => ({
  SegmentHandle: () => <div data-testid="segment-handle" />,
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
        current: { speed: 1 },
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
        flow: { badges: [], style: 'path', errorIcon: false, current: { speed: 1 } },
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
    expect(path).toHaveStyle({ strokeWidth: '3' });
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

  it('shows the segment handle only for an elbow line', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'] } });
    for (const shape of ['curved', 'straight'] as const) {
      const { unmount } = renderEdge({ routable: true, shape }, true);
      expect(screen.queryByTestId('segment-handle')).toBeNull();
      unmount();
    }
    renderEdge({ routable: true, shape: 'elbow' }, true);
    expect(screen.getByTestId('segment-handle')).toBeInTheDocument();
    useUiStore.setState({ selection: EMPTY_SELECTION });
  });
});

describe('DeckEdge segment handle (017 R7, T035)', () => {
  afterEach(() => {
    useUiStore.setState({ selection: EMPTY_SELECTION, flowSession: null, activeFlow: null });
  });

  it('shows the handle for the single selected, routable connector with a movable segment', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'] } });
    renderEdge({ routable: true }, true);
    expect(screen.getByTestId('segment-handle')).toBeInTheDocument();
  });

  it('hides the handle when the edge is not selected', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'] } });
    renderEdge({ routable: true }, false);
    expect(screen.queryByTestId('segment-handle')).toBeNull();
  });

  it('hides the handle with other items in the selection', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'], nodes: ['n1'] } });
    renderEdge({ routable: true }, true);
    expect(screen.queryByTestId('segment-handle')).toBeNull();
  });

  it('hides the handle in flow mode', () => {
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
    expect(screen.queryByTestId('segment-handle')).toBeNull();
  });

  it('hides the handle for a non-routable edge (a port or merged edge)', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'] } });
    renderEdge({ routable: false }, true);
    expect(screen.queryByTestId('segment-handle')).toBeNull();
  });

  it('hides the handle when the resolved sides have no movable segment (an L shape)', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'] } });
    const props = {
      id: 'e1',
      source: 'a',
      target: 'b',
      sourceX: 0,
      sourceY: 0,
      targetX: 200,
      targetY: 40,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Left,
      selected: true,
      data: {
        label: 'POST /orders',
        protocol: 'http',
        direction: 'forward',
        showLabel: false,
        fromTitle: 'A',
        toTitle: 'B',
        focused: false,
        routable: true,
      },
    } as unknown as EdgeProps<DeckFlowEdge>;
    render(
      <svg>
        <DeckEdge {...props} />
      </svg>,
    );
    expect(screen.queryByTestId('segment-handle')).toBeNull();
  });
});

describe('DeckEdge automatic-route ghost (017 R7, T036)', () => {
  afterEach(() => {
    useUiStore.setState({
      selection: EMPTY_SELECTION,
      flowSession: null,
      activeFlow: null,
      canvasGesture: null,
    });
  });

  it('draws the ghost only for the single selected edge mid segment-drag', () => {
    useUiStore.setState({
      selection: { ...EMPTY_SELECTION, edges: ['e1'] },
      canvasGesture: 'segment',
    });
    renderEdge({ routable: true, route: { offset: 40 } }, true);
    expect(screen.getByTestId('edge-route-ghost')).toBeInTheDocument();
  });

  it('draws no ghost outside a segment gesture', () => {
    useUiStore.setState({ selection: { ...EMPTY_SELECTION, edges: ['e1'] } });
    renderEdge({ routable: true, route: { offset: 40 } }, true);
    expect(screen.queryByTestId('edge-route-ghost')).toBeNull();
  });

  it('draws no ghost on a different, unselected edge while a segment gesture is active', () => {
    useUiStore.setState({
      selection: { ...EMPTY_SELECTION, edges: ['e2'] },
      canvasGesture: 'segment',
    });
    renderEdge({ routable: true, route: { offset: 40 } }, false);
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
    expect(label).toHaveAttribute('aria-current', 'step');
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
    renderEdge({ flow: mark({ speed: 1 }) });
    const token = screen.getByTestId('flow-token');
    expect(token.querySelector('animateMotion')).toBeNull();
    expect(token.getAttribute('transform')).toMatch(/^translate\(/);
    spy.mockRestore();
  });
});
