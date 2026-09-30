import { STICKY_DEFAULT_OFFSET, stickyCanvasPosition } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { EMPTY_SELECTION } from '../state/ui-store';
import {
  type CanvasView,
  type DeckFlowNode,
  facingSides,
  toFlowEdges,
  toFlowNodes,
  toLeaderEdges,
  toStickyNodes,
} from './deck-to-flow';
import type { EdgeFlowMark, FlowOverlay, NodeFlowMark } from './flows/flow-overlay';
import { visibleGraph } from './visible-graph';
import { viewStateOf } from './views/view-state';

function topLevelGraph(file: SododeckFile) {
  return visibleGraph(file, { node: null, group: null }, new Set());
}

function view(partial: Partial<CanvasView> = {}): CanvasView {
  return {
    selection: EMPTY_SELECTION,
    focusedId: null,
    focusedEdgeId: null,
    labelsOn: false,
    level: 'system',
    focus: null,
    marks: { merged: new Map(), cards: new Map() },
    ...partial,
  };
}

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    {
      id: 'a',
      type: 'service',
      title: 'A',
      tech: 'Go',
      rules: ['R'],
      group: 'g',
      position: { x: 5, y: 6 },
    },
    { id: 'b', type: 'database', title: 'B' },
  ],
  groups: [{ id: 'g', title: 'Core' }],
  edges: [
    { id: 'e1', from: 'a', to: 'b', label: 'calls', protocol: 'http' },
    { id: 'e3', from: 'b', to: 'a', label: '' },
    // References are not checked by the schema, so a dangling edge can still reach the canvas.
    { id: 'e2', from: 'a', to: 'missing' },
  ],
  rules: { R: { title: 'R', hitPolicy: 'first', inputs: [], outputs: [], rows: [] } },
  stickies: [
    { id: 'st-free', text: 'Free note', position: { x: 30, y: 40 } },
    { id: 'st-pinned', text: 'Pinned note', anchor: 'b' },
    { id: 'st-foreign', text: 'Foreign note', anchor: 'e1', position: { x: 10, y: 12 } },
    { id: 'st-missing', text: 'Missing note', anchor: 'gone', position: { x: 50, y: 60 } },
  ],
};

describe('toFlowNodes', () => {
  it('maps components with position, selection, focus and data', () => {
    const nodes = toFlowNodes(
      deck,
      topLevelGraph(deck),
      view({ selection: { nodes: ['b'], edges: [], groups: [], stickies: [] }, focusedId: 'a' }),
    );
    const [a, b] = nodes.filter((n) => n.type === 'deck');
    expect(a).toMatchObject({
      id: 'a',
      width: 164,
      height: 50,
      position: { x: 5, y: 6 },
      selected: false,
      data: {
        title: 'A',
        kind: 'service',
        subtitle: 'Go',
        hasRules: true,
        level: 'system',
        childCount: 0,
        dimmed: false,
        focused: true,
      },
    });
    expect(b).toMatchObject({
      id: 'b',
      position: { x: 220, y: 0 },
      selected: true,
      data: {
        title: 'B',
        kind: 'database',
        subtitle: undefined,
        hasRules: false,
        level: 'system',
        childCount: 0,
        dimmed: false,
        focused: false,
      },
    });
  });

  describe('toStickyNodes', () => {
    it('maps notes with position, selection and data', () => {
      const stickyNodes = toStickyNodes(deck, {
        nodes: [],
        edges: [],
        groups: [],
        stickies: ['st-free'],
      });
      const freeSticky = deck.stickies[0];
      if (freeSticky === undefined) throw new Error('Missing free sticky fixture');
      expect(stickyNodes.map((node) => node.id)).toEqual([
        'sticky:st-free',
        'sticky:st-pinned',
        'sticky:st-foreign',
        'sticky:st-missing',
      ]);
      expect(stickyNodes[0]).toMatchObject({
        id: 'sticky:st-free',
        type: 'sticky',
        position: stickyCanvasPosition(deck, freeSticky).point,
        selected: true,
        data: {
          stickyId: 'st-free',
          label: 'Free note',
          text: 'Free note',
          status: 'free',
          pinnedToTitle: null,
          collapsed: false,
        },
      });
      expect(stickyNodes[1]).toMatchObject({
        id: 'sticky:st-pinned',
        position: { x: 220 + STICKY_DEFAULT_OFFSET.x, y: STICKY_DEFAULT_OFFSET.y },
        data: {
          status: 'pinned',
          pinnedTo: 'b',
          pinnedToTitle: 'B',
        },
      });
    });

    it('reuses sticky objects when the sticky and its anchor did not change', () => {
      const first = toStickyNodes(deck, EMPTY_SELECTION);
      const moved: SododeckFile = {
        ...deck,
        nodes: [
          deck.nodes[0] as SododeckFile['nodes'][number],
          { ...deck.nodes[1], position: { x: 500, y: 25 } } as SododeckFile['nodes'][number],
        ],
        stickies: deck.stickies,
      };
      const second = toStickyNodes(moved, EMPTY_SELECTION);
      expect(second.find((n) => n.id === 'sticky:st-free')).toBe(
        first.find((n) => n.id === 'sticky:st-free'),
      );
      expect(second.find((n) => n.id === 'sticky:st-pinned')).not.toBe(
        first.find((n) => n.id === 'sticky:st-pinned'),
      );
    });

    it('dims or shows notes in flow mode, hides them when requested, and makes them non-draggable', () => {
      const playbackOverlay: FlowOverlay = {
        edges: new Map(),
        nodes: new Map<string, NodeFlowMark>([['b', { currentStep: true }]]),
      };
      const shown = toStickyNodes(deck, EMPTY_SELECTION, playbackOverlay, {
        flowMode: true,
        notesDisplay: 'dimmed',
        emptyFlow: false,
        brokenCurrentStep: false,
      });
      expect(shown.find((node) => node.id === 'sticky:st-free')).toMatchObject({
        className: 'sd-note-dimmed',
        draggable: false,
      });
      expect(shown.find((node) => node.id === 'sticky:st-pinned')).toMatchObject({
        className: 'in-flow sd-note-shown',
        draggable: false,
      });
      const repeated = toStickyNodes(deck, EMPTY_SELECTION, playbackOverlay, {
        flowMode: true,
        notesDisplay: 'dimmed',
        emptyFlow: false,
        brokenCurrentStep: false,
      });
      expect(repeated.find((node) => node.id === 'sticky:st-free')).toBe(
        shown.find((node) => node.id === 'sticky:st-free'),
      );
      const hidden = toStickyNodes(deck, EMPTY_SELECTION, playbackOverlay, {
        flowMode: true,
        notesDisplay: 'hidden',
        emptyFlow: false,
        brokenCurrentStep: false,
      });
      expect(hidden.every((node) => node.hidden === true)).toBe(true);
    });
  });

  it('adds group frames below the components, dragged by their handles only (016 R5)', () => {
    const [group] = toFlowNodes(deck, topLevelGraph(deck), view());
    expect(group).toMatchObject({
      id: 'group:g',
      type: 'group-boundary',
      position: { x: 5 - 24, y: 6 - 24 },
      width: 164 + 48,
      height: 50 + 48,
      selectable: true,
      draggable: true,
      dragHandle: '.sd-group-handle',
      // Empty space inside the frame lets the pointer through to the pane (FR-017).
      style: { pointerEvents: 'none' },
      focusable: false,
      zIndex: -1,
      data: { title: 'Core', count: 1, level: 'system' },
    });
  });

  it('follows a change to the groups alone: a rename or a resized frame (016)', () => {
    const graph = topLevelGraph(deck);
    const first = toFlowNodes(deck, graph, view());
    const renamed = {
      ...deck,
      groups: deck.groups.map((g) => ({
        ...g,
        title: 'Renamed',
        position: { x: 0, y: 0 },
        size: { width: 500, height: 400 },
      })),
    };
    const next = toFlowNodes(renamed, topLevelGraph(renamed), view());
    const frame = next.find((n) => n.id === 'group:g');
    expect(frame).not.toBe(first.find((n) => n.id === 'group:g'));
    expect(frame).toMatchObject({ width: 500, height: 400, data: { title: 'Renamed' } });
  });

  it('marks a selected group frame, and rebuilds only that frame', () => {
    const graph = topLevelGraph(deck);
    const first = toFlowNodes(deck, graph, view());
    const selected = toFlowNodes(
      deck,
      graph,
      view({ selection: { ...EMPTY_SELECTION, groups: ['g'] } }),
    );
    const frame = selected.find((n) => n.id === 'group:g');
    // In data, not React Flow's `selected`: that would lift the frame above its members.
    expect(frame?.data).toMatchObject({ selected: true });
    expect(frame?.selected).toBeUndefined();
    expect(frame).not.toBe(first.find((n) => n.id === 'group:g'));
    expect(selected.find((n) => n.id === 'b')).toBe(first.find((n) => n.id === 'b'));
  });

  it('returns the same object when level is unchanged and rebuilds when level or dimming changes', () => {
    const graph = topLevelGraph(deck);
    const first = toFlowNodes(deck, graph, view());
    const same = toFlowNodes(deck, graph, view());
    expect(same.find((n) => n.id === 'b')).toBe(first.find((n) => n.id === 'b'));

    const nextLevel = toFlowNodes(deck, graph, view({ level: 'container' }));
    expect(nextLevel.find((n) => n.id === 'a')).not.toBe(first.find((n) => n.id === 'a'));

    const dimmed = toFlowNodes(
      deck,
      graph,
      view({ focus: { focusId: 'a', members: new Set(['a']), edges: new Set() } }),
    );
    expect(dimmed.find((n) => n.id === 'b')).not.toBe(first.find((n) => n.id === 'b'));
    expect(dimmed.find((n) => n.id === 'b')?.data).toMatchObject({ dimmed: true });
  });

  it('carries problem marks and rebuilds only when they change (015 FR-022)', () => {
    const graph = topLevelGraph(deck);
    const mark = { count: 1, titles: 'Duplicate connection', label: '1 problem' };
    const plain = toFlowNodes(deck, graph, view());
    const marked = toFlowNodes(deck, graph, view({ problems: new Map([['b', mark]]) }));
    const b = marked.find((n) => n.id === 'b') as DeckFlowNode;
    expect(b.data.problems).toEqual(mark);
    expect(b).not.toBe(plain.find((n) => n.id === 'b'));
    expect(marked.find((n) => n.id === 'a')).toBe(plain.find((n) => n.id === 'a'));
    const again = toFlowNodes(deck, graph, view({ problems: new Map([['b', { ...mark }]]) }));
    expect(again.find((n) => n.id === 'b')).toBe(b);

    const edges = toFlowEdges(deck, graph, view({ problems: new Map([['e1', mark]]) }));
    const e1 = edges.find((e) => e.id === 'e1');
    expect(e1?.data?.problems).toEqual(mark);
    expect(e1?.ariaLabel).toMatch(/, 1 problem$/);
  });

  it('returns the same object for a node whose source did not change', () => {
    const graph = topLevelGraph(deck);
    const first = toFlowNodes(deck, graph, view());
    const moved: SododeckFile = {
      ...deck,
      nodes: [
        { ...deck.nodes[0], position: { x: 50, y: 60 } } as SododeckFile['nodes'][number],
        deck.nodes[1] as SododeckFile['nodes'][number],
      ],
    };
    const second = toFlowNodes(moved, topLevelGraph(moved), view());
    expect(second.find((n) => n.id === 'b')).toBe(first.find((n) => n.id === 'b'));
    expect(second.find((n) => n.id === 'a')).not.toBe(first.find((n) => n.id === 'a'));
    expect(toFlowNodes(deck, graph, view()).find((n) => n.id === 'a')).toBe(
      first.find((n) => n.id === 'a'),
    );
  });

  it("keeps an unchanged node's identity across a snapshot where another node's style changed (020)", () => {
    const graph = topLevelGraph(deck);
    const first = toFlowNodes(deck, graph, view());
    const styled: SododeckFile = {
      ...deck,
      nodes: [
        { ...deck.nodes[0], style: { fill: 'green' } } as SododeckFile['nodes'][number],
        deck.nodes[1] as SododeckFile['nodes'][number],
      ],
    };
    const second = toFlowNodes(styled, topLevelGraph(styled), view());
    expect(second.find((n) => n.id === 'b')).toBe(first.find((n) => n.id === 'b'));
    const a = second.find((n) => n.id === 'a') as DeckFlowNode;
    expect(a).not.toBe(first.find((n) => n.id === 'a'));
    expect(a.data.look).toEqual({
      fill: 'var(--color-card-green-fill)',
      stroke: undefined,
      text: 'default',
      namedFill: true,
    });
  });

  it('applies a style preview only to selected nodes (020 R9)', () => {
    const graph = topLevelGraph(deck);
    const preview = toFlowNodes(
      deck,
      graph,
      view({
        selection: { ...EMPTY_SELECTION, nodes: ['a'] },
        stylePreview: { channel: 'fill', value: 'green' },
      }),
    );
    const a = preview.find((n) => n.id === 'a') as DeckFlowNode;
    const b = preview.find((n) => n.id === 'b') as DeckFlowNode;
    expect(a.data.look?.fill).toBe('var(--color-card-green-fill)');
    expect(b.data.look).toBeUndefined();
  });
});

describe('view render (011)', () => {
  const file: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [
      { id: 'a', type: 'client', title: 'A', tech: 'Swift', host: 'App Store', owner: 'Mobile' },
      { id: 'b', type: 'service', title: 'B', tech: 'Go', position: { x: 10, y: 20 } },
    ],
    edges: [{ id: 'e', from: 'a', to: 'b' }],
    flows: [{ id: 'f', title: 'F', steps: [{ id: 's', edge: 'e' }] }],
    views: [
      { id: 'sys', type: 'system', title: 'System' },
      {
        id: 'inf',
        type: 'infra',
        title: 'Infra',
        subtitleField: 'host',
        dimKinds: ['client'],
        positions: { b: { x: 400, y: 50 } },
        pinned: ['b'],
      },
    ],
  };
  const nodesIn = (viewId: string) => {
    const state = viewStateOf(file, viewId);
    return toFlowNodes(
      state.deck,
      topLevelGraph(state.deck),
      view({ render: state.render }),
    ) as DeckFlowNode[];
  };

  it.each([
    ['tech', 'Swift'],
    ['host', 'App Store'],
    ['owner', 'Mobile'],
    ['flows', '1 flow · Mobile'],
    ['none', undefined],
  ] as const)('shows the %s subtitle', (subtitleField, expected) => {
    const render = { ...viewStateOf(file, 'sys').render, subtitleField };
    const withCounts = { ...render, flowCounts: new Map([['a', 1]]) };
    const nodes = toFlowNodes(file, topLevelGraph(file), view({ render: withCounts }));
    expect((nodes[0] as DeckFlowNode).data.subtitle).toBe(expected);
  });

  it('keeps tech subtitles without a render (System defaults)', () => {
    const nodes = toFlowNodes(file, topLevelGraph(file), view()) as DeckFlowNode[];
    expect(nodes.map((n) => n.data.subtitle)).toEqual(['Swift', 'Go']);
  });

  it('uses the view position over the base position, and base positions elsewhere', () => {
    expect(nodesIn('sys')[1]?.position).toEqual({ x: 10, y: 20 });
    expect(nodesIn('inf')[1]?.position).toEqual({ x: 400, y: 50 });
  });

  it('dims and pins per view, and rebuilds the node when that changes', () => {
    const infra = nodesIn('inf');
    expect(infra[0]?.data.viewDimmed).toBe(true);
    expect(infra[0]?.className).toBe('view-dimmed');
    expect(infra[1]?.data.pinned).toBe(true);
    const system = nodesIn('sys');
    expect(system[0]?.data.viewDimmed).toBeUndefined();
    expect(system[0]).not.toBe(infra[0]);
    expect(nodesIn('sys')[0]).toBe(system[0]);
  });
});

describe('toFlowEdges', () => {
  it('keeps only edges with existing endpoints, with data for the edge view', () => {
    const edges = toFlowEdges(
      deck,
      topLevelGraph(deck),
      view({ selection: { nodes: [], edges: ['e1'], groups: [], stickies: [] } }),
    );
    expect(edges.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(edges[0]).toMatchObject({
      type: 'deck',
      source: 'a',
      target: 'b',
      selected: true,
      interactionWidth: 12,
      ariaLabel: 'A to B: calls',
      data: {
        label: 'calls',
        protocol: 'http',
        direction: 'forward',
        showLabel: false,
        fromTitle: 'A',
        toTitle: 'B',
      },
    });
  });

  it('shows label pills only with Labels on and a non-empty label', () => {
    const edges = toFlowEdges(deck, topLevelGraph(deck), view({ labelsOn: true }));
    expect(edges.map((e) => e.data?.showLabel)).toEqual([true, false]);

    const focused = toFlowEdges(
      deck,
      topLevelGraph(deck),
      view({ focus: { focusId: 'a', members: new Set(['a', 'b']), edges: new Set(['e1']) } }),
    );
    expect(focused.find((edge) => edge.id === 'e1')?.data?.showLabel).toBe(true);
  });

  it('connects the facing sides of the two nodes', () => {
    expect(facingSides({ x: 0, y: 0 }, { x: 200, y: 20 })).toEqual(['right', 'left']);
    expect(facingSides({ x: 0, y: 0 }, { x: -200, y: 20 })).toEqual(['left', 'right']);
    expect(facingSides({ x: 0, y: 0 }, { x: 10, y: 200 })).toEqual(['bottom', 'top']);
    expect(facingSides({ x: 0, y: 0 }, { x: 10, y: -200 })).toEqual(['top', 'bottom']);
  });

  it('reuses edge objects when nothing about them changed', () => {
    const graph = topLevelGraph(deck);
    const first = toFlowEdges(deck, graph, view());
    const second = toFlowEdges(deck, graph, view());
    expect(second[0]).toBe(first[0]);
    // The list itself too, so React Flow does not re-sync its edges during a drag.
    expect(second).toBe(first);
    expect(toFlowEdges(deck, graph, view({ labelsOn: true }))[0]).not.toBe(first[0]);
  });

  it('rebuilds edges when dimming changes', () => {
    const graph = topLevelGraph(deck);
    const first = toFlowEdges(deck, graph, view());
    const next = toFlowEdges(
      deck,
      graph,
      view({ focus: { focusId: 'a', members: new Set(['a']), edges: new Set() } }),
    );
    expect(next[0]).not.toBe(first[0]);
    expect(next[0]?.data).toMatchObject({ dimmed: true });
  });
});

describe('toLeaderEdges', () => {
  it('maps pinned notes only as non-interactive leader edges', () => {
    const leaders = toLeaderEdges(deck);
    expect(leaders).toEqual([
      expect.objectContaining({
        id: 'sticky-leader:st-pinned',
        type: 'sticky-leader',
        source: 'b',
        target: 'sticky:st-pinned',
        selectable: false,
        focusable: false,
      }),
    ]);
  });
});

describe('flow overlay (006)', () => {
  const mark = (label: string): EdgeFlowMark => ({
    badges: [{ label, errorPath: false, current: false, chainBreak: false }],
    style: 'path',
    errorIcon: false,
  });
  const overlay = (edges: [string, EdgeFlowMark][], nodes: [string, string][] = []) => ({
    edges: new Map(edges),
    nodes: new Map(nodes.map(([id, startsHere]) => [id, { startsHere }])),
  });

  it('puts the mark on the edge and the start tag on the node', () => {
    const [e1] = toFlowEdges(deck, topLevelGraph(deck), view(), overlay([['e1', mark('1')]]));
    expect(e1?.data?.flow).toEqual(mark('1'));
    const nodes = toFlowNodes(
      deck,
      topLevelGraph(deck),
      view(),
      overlay([], [['b', 'Step 2 starts here']]),
    );
    expect(nodes.find((n) => n.id === 'b')?.data).toMatchObject({
      flowStart: 'Step 2 starts here',
    });
  });

  it('keeps edge identity for untouched edges and for equal marks', () => {
    const graph = topLevelGraph(deck);
    const first = toFlowEdges(deck, graph, view(), overlay([['e1', mark('1')]]));
    const same = toFlowEdges(deck, graph, view(), overlay([['e1', mark('1')]]));
    expect(same).toBe(first);
    const other = toFlowEdges(deck, graph, view(), overlay([['e1', mark('2')]]));
    expect(other[0]).not.toBe(first[0]);
    expect(other[1]).toBe(first[1]);
  });
});

describe('flow mode marks (007)', () => {
  const chain: SododeckFile = {
    ...emptySododeckFile(),
    nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id, type: 'service', title: id.toUpperCase() })),
    edges: [
      { id: 'ab', from: 'a', to: 'b' },
      { id: 'bc', from: 'b', to: 'c' },
      { id: 'cd', from: 'c', to: 'd' },
    ],
  };
  const edge = (inPath: boolean, current: boolean): EdgeFlowMark => ({
    badges: [{ label: '1', errorPath: false, current, chainBreak: false }],
    style: 'path',
    errorIcon: false,
    inPath,
    current: current ? { speed: 1 } : null,
  });
  /** Steps ab, bc played (cd off path), `current` the current edge. */
  const overlay = (current: 'ab' | 'bc'): FlowOverlay => {
    const node = (id: string): NodeFlowMark => ({
      inPath: true,
      currentStep: current === 'ab' ? id !== 'c' : id !== 'a',
    });
    return {
      edges: new Map([
        ['ab', edge(true, current === 'ab')],
        ['bc', edge(true, current === 'bc')],
        ['cd', edge(false, false)],
      ]),
      nodes: new Map(['a', 'b', 'c'].map((id) => [id, node(id)])),
    };
  };

  it('sets in-flow on members only and carries the current step to nodes', () => {
    const graph = topLevelGraph(chain);
    const nodes = toFlowNodes(chain, graph, view(), overlay('ab'));
    expect(nodes.map((n) => n.className)).toEqual(['in-flow', 'in-flow', 'in-flow', undefined]);
    expect(nodes.map((n) => n.data.currentStep === true)).toEqual([true, true, false, false]);
    const edges = toFlowEdges(chain, graph, view(), overlay('ab'));
    expect(edges.map((e) => e.className)).toEqual(['in-flow', 'in-flow', undefined]);
  });

  it('rebuilds only the old and new current edges and their nodes', () => {
    const graph = topLevelGraph(chain);
    const nodes = toFlowNodes(chain, graph, view(), overlay('ab'));
    const edges = toFlowEdges(chain, graph, view(), overlay('ab'));
    const nextNodes = toFlowNodes(chain, graph, view(), overlay('bc'));
    const nextEdges = toFlowEdges(chain, graph, view(), overlay('bc'));
    expect(nextEdges.map((e, i) => e === edges[i])).toEqual([false, false, true]);
    // a leaves the step, c joins it, b stays in it, d is untouched.
    expect(nextNodes.map((n, i) => n === nodes[i])).toEqual([false, true, false, true]);
  });
});

describe('draw order (019 FR-037)', () => {
  it('draws components in deck.nodes order, so later ones sit on top', () => {
    const file = {
      ...emptySododeckFile(),
      nodes: [
        { id: 'z', type: 'service' as const, title: 'Z', position: { x: 0, y: 0 } },
        { id: 'a', type: 'service' as const, title: 'A', position: { x: 10, y: 10 } },
      ],
    };
    const ids = toFlowNodes(file, topLevelGraph(file), view()).map((node) => node.id);
    expect(ids.indexOf('z')).toBeLessThan(ids.indexOf('a'));
  });
});
