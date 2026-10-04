import { STICKY_DEFAULT_OFFSET, stickyCanvasPosition } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { EMPTY_SELECTION, useUiStore } from '../state/ui-store';
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
import { bundleEdges } from './bundles';
import { cardLayout } from './card-layout';
import { cardSize, groupBounds } from './canvas-geometry';
import { focusSet } from './focus-set';
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
    marks: { merged: new Map(), cards: new Map(), cardNumbers: new Map() },
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
      // 029: 184 wide, tall enough for the title and the "Go" description.
      width: 184,
      height: cardLayout({ title: 'A', description: 'Go' }).height,
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

  it('renders a sized node at its own size at every level (017)', () => {
    const sized: SododeckFile = {
      ...deck,
      nodes: deck.nodes.map((node) =>
        node.id === 'a' ? { ...node, size: { width: 240, height: 90 } } : node,
      ),
    };
    for (const level of ['system', 'container', 'component'] as const) {
      const [a] = toFlowNodes(sized, topLevelGraph(sized), view({ level })).filter(
        (n) => n.id === 'a',
      );
      expect(a).toMatchObject({ width: 240, height: 90 });
    }
  });

  it('returns a new node object when only size changes (017)', () => {
    const graph = topLevelGraph(deck);
    const first = toFlowNodes(deck, graph, view());
    const resized: SododeckFile = {
      ...deck,
      nodes: deck.nodes.map((node) =>
        node.id === 'a' ? { ...node, size: { width: 300, height: 120 } } : node,
      ),
    };
    const second = toFlowNodes(resized, topLevelGraph(resized), view());
    const a1 = first.find((n) => n.id === 'a');
    const a2 = second.find((n) => n.id === 'a');
    expect(a1).not.toBe(a2);
    expect(a2).toMatchObject({ width: 300, height: 120 });
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
      width: 184 + 48,
      height: cardLayout({ title: 'A', description: 'Go' }).height + 48,
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

  it('marks pinned-focus neighbours, not the focus card itself (034 T008)', () => {
    const graph = topLevelGraph(deck);
    const nodes = toFlowNodes(
      deck,
      graph,
      view({ focus: { focusId: 'a', members: new Set(['a', 'b']), edges: new Set(['e1']) } }),
    );
    expect(nodes.find((n) => n.id === 'a')?.className).toBe('in-focus');
    expect(nodes.find((n) => n.id === 'b')?.className).toBe('in-focus sd-focus-neighbour');
    const moved = toFlowNodes(
      deck,
      graph,
      view({ focus: { focusId: 'b', members: new Set(['a', 'b']), edges: new Set(['e1']) } }),
    );
    expect(moved.find((n) => n.id === 'a')?.className).toBe('in-focus sd-focus-neighbour');
    expect(moved.find((n) => n.id === 'b')?.className).toBe('in-focus');
  });

  it('returns the same React Flow objects while a hover focus changes (034 R1)', () => {
    const graph = topLevelGraph(deck);
    const canvasView = view();
    const nodes = toFlowNodes(deck, graph, canvasView);
    const edges = toFlowEdges(deck, graph, canvasView);
    useUiStore.getState().setHoverFocus({ id: 'a', source: 'pointer' });
    expect(toFlowNodes(deck, graph, canvasView)).toBe(nodes);
    expect(toFlowEdges(deck, graph, canvasView)).toBe(edges);
    useUiStore.getState().clearHoverFocus();
    expect(toFlowNodes(deck, graph, canvasView)).toBe(nodes);
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

  it('carries the node icon and rebuilds only the node whose icon changed (038)', () => {
    const graph = topLevelGraph(deck);
    const first = toFlowNodes(deck, graph, view());
    expect((first.find((n) => n.id === 'a') as DeckFlowNode).data.icon).toBeUndefined();
    const iconed: SododeckFile = {
      ...deck,
      nodes: [
        { ...deck.nodes[0], icon: 'lucide:search' } as SododeckFile['nodes'][number],
        deck.nodes[1] as SododeckFile['nodes'][number],
      ],
    };
    const second = toFlowNodes(iconed, topLevelGraph(iconed), view());
    const a = second.find((n) => n.id === 'a') as DeckFlowNode;
    expect(a.data.icon).toBe('lucide:search');
    expect(a).not.toBe(first.find((n) => n.id === 'a'));
    expect(second.find((n) => n.id === 'b')).toBe(first.find((n) => n.id === 'b'));
    expect(toFlowNodes(iconed, topLevelGraph(iconed), view()).find((n) => n.id === 'a')).toBe(a);
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
      chip: 'var(--color-card-green-chip)',
      ink: 'var(--color-card-green-ink)',
      dot: 'var(--color-card-green-dot)',
      text: 'default',
      namedFill: true,
      fillRef: 'green',
      strokeRef: undefined,
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

describe('tag colours (033)', () => {
  const tagged: SododeckFile = {
    ...emptySododeckFile(),
    tagColors: { PCI: 'violet', Lan: '#1f2a44' },
    nodes: [
      {
        id: 'a',
        type: 'service',
        title: 'A',
        style: { fill: 'green' },
        tags: ['pci', 'Lan', 'plain'],
      },
      { id: 'b', type: 'service', title: 'B' },
    ],
  };
  const lookOf = (file: SododeckFile, id: string) =>
    (toFlowNodes(file, topLevelGraph(file), view()).find((n) => n.id === id) as DeckFlowNode).data
      .tagLooks;

  it('gives each tag its own colour, matched by key, and an uncoloured tag slate (even on a coloured card)', () => {
    expect(lookOf(tagged, 'a')).toEqual([
      {
        text: 'pci',
        chip: 'var(--color-card-violet-chip)',
        ink: 'var(--color-card-violet-ink)',
        dot: 'var(--color-card-violet-dot)',
      },
      { text: 'Lan', chip: '#1f2a44', ink: 'var(--color-card-text-light)', dot: '#1f2a44' },
      {
        text: 'plain',
        chip: 'var(--color-card-slate-chip)',
        ink: 'var(--color-card-slate-ink)',
        dot: 'var(--color-card-slate-dot)',
      },
    ]);
    expect(lookOf(tagged, 'b')).toEqual([]);
  });

  it('carries the first ten tags only', () => {
    const many: SododeckFile = {
      ...tagged,
      nodes: [
        {
          id: 'm',
          type: 'service',
          title: 'M',
          tags: Array.from({ length: 12 }, (_, i) => `t${String(i)}`),
        },
      ],
    };
    expect(lookOf(many, 'm')).toHaveLength(10);
  });

  it('rebuilds a card whose tag colour changed and keeps the identity of cards it does not touch', () => {
    const file: SododeckFile = {
      ...tagged,
      nodes: [...tagged.nodes, { id: 'c', type: 'service', title: 'C', tags: ['other'] }],
    };
    const first = toFlowNodes(file, topLevelGraph(file), view());
    const recoloured: SododeckFile = { ...file, tagColors: { PCI: 'red', Lan: '#1f2a44' } };
    const second = toFlowNodes(recoloured, topLevelGraph(recoloured), view());
    const get = (list: typeof first, id: string) => list.find((n) => n.id === id) as DeckFlowNode;
    expect(get(second, 'a')).not.toBe(get(first, 'a'));
    expect(get(second, 'a').data.tagLooks[0]?.chip).toBe('var(--color-card-red-chip)');
    expect(get(second, 'b')).toBe(get(first, 'b'));
    expect(get(second, 'c')).toBe(get(first, 'c'));
  });

  it('removing the colour map returns the tags to slate', () => {
    const { tagColors: _removed, ...plain } = tagged;
    expect(lookOf(plain, 'a')[0]?.chip).toBe('var(--color-card-slate-chip)');
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

  it('connects the facing sides of the two nodes, comparing centres (017)', () => {
    const box = (x: number, y: number) => ({ x, y, width: 160, height: 50 });
    expect(facingSides(box(0, 0), box(200, 20))).toEqual(['right', 'left']);
    expect(facingSides(box(0, 0), box(-200, 20))).toEqual(['left', 'right']);
    expect(facingSides(box(0, 0), box(10, 200))).toEqual(['bottom', 'top']);
    expect(facingSides(box(0, 0), box(10, -200))).toEqual(['top', 'bottom']);
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

  it('pins a handle to the side named by edge.route (017)', () => {
    const routed: SododeckFile = {
      ...deck,
      edges: [{ id: 'e1', from: 'a', to: 'b', route: { fromSide: 'top', toSide: 'top' } }],
    };
    const graph = topLevelGraph(routed);
    const [edge] = toFlowEdges(routed, graph, view());
    // B sits below and to the right of A, so automatic routing would pick bottom/top-ish
    // sides facing each other; the pinned route forces both ends to "top" instead.
    expect(edge?.sourceHandle).toBe('top');
    expect(edge?.targetHandle).toBe('top');
  });

  it('breaks the edge cache when edge.route changes (017)', () => {
    const graph = topLevelGraph(deck);
    const routed: SododeckFile = {
      ...deck,
      edges: [{ id: 'e1', from: 'a', to: 'b', route: { offset: 20 } }],
    };
    const first = toFlowEdges(deck, graph, view());
    const second = toFlowEdges(routed, topLevelGraph(routed), view());
    expect(second[0]).not.toBe(first[0]);
  });
});

describe('toFlowEdges bends, sizes and style (022)', () => {
  it('faces the handles toward the first and last bend when sides are automatic', () => {
    const bent: SododeckFile = {
      ...deck,
      edges: [{ id: 'e1', from: 'a', to: 'b', route: { waypoints: [{ x: 0.5, dy: -400 }] } }],
    };
    const [edge] = toFlowEdges(bent, topLevelGraph(bent), view());
    expect(edge?.sourceHandle).toBe('top');
    expect(edge?.data?.fromSize).toBeDefined();
    expect(edge?.data?.toSize).toBeDefined();
  });

  it('a pinned side still wins over the bend', () => {
    const bent: SododeckFile = {
      ...deck,
      edges: [
        {
          id: 'e1',
          from: 'a',
          to: 'b',
          route: { fromSide: 'left', waypoints: [{ x: 0.5, dy: -400 }] },
        },
      ],
    };
    const [edge] = toFlowEdges(bent, topLevelGraph(bent), view());
    expect(edge?.sourceHandle).toBe('left');
  });

  it('carries the style and refreshes the edge when it changes', () => {
    const styled: SododeckFile = {
      ...deck,
      edges: [{ id: 'e1', from: 'a', to: 'b', style: { dash: 'dashed', width: 3 } }],
    };
    const [before] = toFlowEdges(deck, topLevelGraph(deck), view());
    const [after] = toFlowEdges(styled, topLevelGraph(styled), view());
    expect(after).not.toBe(before);
    expect(after?.data?.style).toEqual({ dash: 'dashed', width: 3 });
    expect(before?.data).not.toHaveProperty('style');
  });
});

describe('toFlowEdges line type (029 T044)', () => {
  const withEdge = (edge: SododeckFile['edges'][number]): SododeckFile => ({
    ...deck,
    edges: [edge],
  });

  it('puts the effective shape in the edge data', () => {
    const shapeOf = (edge: SododeckFile['edges'][number]) => {
      const file = withEdge(edge);
      return toFlowEdges(file, topLevelGraph(file), view())[0]?.data?.shape;
    };
    expect(shapeOf({ id: 'e1', from: 'a', to: 'b' })).toBe('curved');
    expect(shapeOf({ id: 'e1', from: 'a', to: 'b', route: { offset: 4 } })).toBe('elbow');
    expect(shapeOf({ id: 'e1', from: 'a', to: 'b', style: { shape: 'straight' } })).toBe(
      'straight',
    );
    expect(
      shapeOf({ id: 'e1', from: 'a', to: 'b', route: { offset: 4 }, style: { shape: 'curved' } }),
    ).toBe('curved');
  });

  it('breaks the edge cache when the shape changes', () => {
    const first = withEdge({ id: 'e1', from: 'a', to: 'b' });
    const second = withEdge({ id: 'e1', from: 'a', to: 'b', style: { shape: 'elbow' } });
    const a = toFlowEdges(first, topLevelGraph(first), view());
    const b = toFlowEdges(second, topLevelGraph(second), view());
    expect(b[0]).not.toBe(a[0]);
    expect(b[0]?.data?.shape).toBe('elbow');
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
    current: current ? { speed: 1, number: '1' } : null,
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

  it('carries the step mark of each card into node data and rebuilds the node when it changes', () => {
    const graph = topLevelGraph(chain);
    const marked = (state: 'played' | 'current', number: string | null): FlowOverlay => ({
      edges: new Map(),
      nodes: new Map<string, NodeFlowMark>([['a', { inPath: true, step: { state, number } }]]),
    });
    const first = toFlowNodes(chain, graph, view(), marked('current', '1'));
    expect(first[0]?.data.step).toEqual({ state: 'current', number: '1' });
    expect(first[1]?.data.step).toBeUndefined();
    const same = toFlowNodes(chain, graph, view(), marked('current', '1'));
    expect(same[0]).toBe(first[0]);
    const next = toFlowNodes(chain, graph, view(), marked('played', null));
    expect(next[0]).not.toBe(first[0]);
    expect(next[0]?.data.step).toEqual({ state: 'played', number: null });
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

describe('bundles and fanned connectors (034)', () => {
  const none = new Set<string>();
  const parallel: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [
      { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
      { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 0 } },
      { id: 'c', type: 'service', title: 'C', position: { x: 0, y: 300 } },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b', label: 'one' },
      { id: 'e2', from: 'a', to: 'b', label: 'two' },
      { id: 'e3', from: 'a', to: 'b', label: 'three' },
      { id: 'e4', from: 'a', to: 'c' },
    ],
  };
  const graph = topLevelGraph(parallel);
  const edgesFor = (fanned: string[] = [], file = parallel, focus: CanvasView['focus'] = null) => {
    const g = file === parallel ? graph : topLevelGraph(file);
    const bundles = bundleEdges(file, g, { exclude: none, fanned: new Set(fanned), off: false });
    return toFlowEdges(file, g, view({ focus }), undefined, bundles);
  };

  it('draws a bundle as one merged edge and leaves out the connectors it folds', () => {
    const edges = edgesFor();
    expect(edges.map((e) => e.id)).toEqual(['e4', 'bundle:a|b']);
    const bundle = edges.find((e) => e.id === 'bundle:a|b');
    expect(bundle).toMatchObject({
      type: 'merged',
      source: 'a',
      target: 'b',
      ariaLabel: '3 connections between A and B',
      data: { kind: 'bundle', count: 3, direction: 'a-to-b', fanned: false, level: 'system' },
    });
    expect(bundle?.data).toMatchObject({ edgeIds: ['e1', 'e2', 'e3'] });
  });

  it('draws a fanned bundle as plain connectors with their spread slots and the pill', () => {
    const edges = edgesFor(['bundle:a|b']);
    expect(edges.map((e) => e.id)).toEqual(['e1', 'e2', 'e3', 'e4', 'bundle:a|b']);
    expect((edges[0] as DeckFlowEdgeLike).data?.fan).toEqual({ index: 0, count: 3 });
    expect((edges[2] as DeckFlowEdgeLike).data?.fan).toEqual({ index: 2, count: 3 });
    expect((edges[3] as DeckFlowEdgeLike).data?.fan).toBeUndefined();
    expect((edges[0] as DeckFlowEdgeLike).data?.showLabel).toBe(true);
    expect(edges.find((e) => e.id === 'bundle:a|b')?.data).toMatchObject({ fanned: true });
  });

  it('keeps cached objects while inputs are equal, and rebuilds only what changed', () => {
    const first = edgesFor();
    const second = edgesFor();
    expect(second).toBe(first);
    const fanned = edgesFor(['bundle:a|b']);
    // The lone connector is the same object; the bundle is rebuilt for its new state.
    expect(fanned.find((e) => e.id === 'e4')).toBe(first.find((e) => e.id === 'e4'));
    expect(fanned.find((e) => e.id === 'bundle:a|b')).not.toBe(
      first.find((e) => e.id === 'bundle:a|b'),
    );
    const folded = edgesFor();
    expect(folded.find((e) => e.id === 'bundle:a|b')?.data).toMatchObject({ fanned: false });
  });

  it('edits one connector without rebuilding the others', () => {
    const edited: SododeckFile = {
      ...parallel,
      edges: parallel.edges.map((e) => (e.id === 'e4' ? { ...e, label: 'x' } : e)),
    };
    const before = edgesFor();
    const after = edgesFor([], edited);
    expect(after.find((e) => e.id === 'e4')).not.toBe(before.find((e) => e.id === 'e4'));
    expect(after.find((e) => e.id === 'bundle:a|b')?.data).toMatchObject({ count: 3 });
  });

  it('keeps a fanned bundle fanned and moves its spread connectors when a card moves', () => {
    const moved: SododeckFile = {
      ...parallel,
      nodes: parallel.nodes.map((n) => (n.id === 'b' ? { ...n, position: { x: 500, y: 40 } } : n)),
    };
    const edges = edgesFor(['bundle:a|b'], moved);
    expect(edges.map((e) => e.id)).toEqual(['e1', 'e2', 'e3', 'e4', 'bundle:a|b']);
    expect(edges.find((e) => e.id === 'bundle:a|b')?.data).toMatchObject({ fanned: true });
  });

  it('marks a bundle in pinned focus and dims it otherwise', () => {
    const bundles = bundleEdges(parallel, graph, { exclude: none, fanned: none, off: false });
    const set = focusSet(parallel, graph, 'c', bundles);
    const edges = toFlowEdges(parallel, graph, view({ focus: set }), undefined, bundles);
    const bundle = edges.find((e) => e.id === 'bundle:a|b');
    expect(bundle?.className).toBeUndefined();
    expect(bundle?.domAttributes).toEqual({ 'aria-hidden': true });
    const lit = focusSet(parallel, graph, 'a', bundles);
    const litEdges = toFlowEdges(parallel, graph, view({ focus: lit }), undefined, bundles);
    expect(litEdges.find((e) => e.id === 'bundle:a|b')?.className).toBe('in-focus');
  });

  it("draws every connector separately without a bundle result (today's behaviour)", () => {
    expect(toFlowEdges(parallel, graph, view()).map((e) => e.id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });
});

type DeckFlowEdgeLike = { data?: { fan?: { index: number; count: number }; showLabel?: boolean } };

describe('drill-in proxies and scope label (034 US3)', () => {
  const drilled = emptySododeckFile();
  const file: SododeckFile = {
    ...drilled,
    nodes: [
      { id: 'in1', type: 'service', title: 'In 1', group: 'core', position: { x: 0, y: 0 } },
      { id: 'in2', type: 'service', title: 'In 2', group: 'core', position: { x: 0, y: 200 } },
      { id: 'src', type: 'client', title: 'Source', position: { x: 900, y: 0 } },
      { id: 'dst', type: 'database', title: 'Dest', position: { x: 900, y: 200 } },
    ],
    groups: [{ id: 'core', title: 'Core' }],
    edges: [
      { id: 'a', from: 'src', to: 'in1' },
      { id: 'b', from: 'in2', to: 'dst' },
    ],
  };
  const scope = { node: null, group: 'core' };
  const graph = visibleGraph(file, scope, new Set());

  it('places proxies from proxyLayout and keeps them out of drag, selection and connections', () => {
    const nodes = toFlowNodes(file, graph, view({ scopeTitle: 'Core' }));
    const proxies = nodes.filter((n) => n.type === 'port');
    expect(proxies.map((p) => p.id).sort()).toEqual(['port:dst', 'port:src']);
    for (const proxy of proxies) {
      expect(proxy).toMatchObject({
        draggable: false,
        selectable: false,
        connectable: false,
        width: 150,
        height: 52,
      });
    }
    const src = proxies.find((p) => p.id === 'port:src');
    const dst = proxies.find((p) => p.id === 'port:dst');
    expect(src?.data).toMatchObject({
      outsideNodeId: 'src',
      outsideTitle: 'Source',
      kind: 'client',
      side: 'left',
    });
    expect(dst?.data).toMatchObject({ kind: 'database', side: 'right' });
    expect((src?.position.x ?? 0) < (dst?.position.x ?? 0)).toBe(true);
  });

  it('adds one scope label per drill-in, counting the cards inside, and none at the top', () => {
    const labels = toFlowNodes(file, graph, view({ scopeTitle: 'Core' })).filter(
      (n) => n.type === 'scope-label',
    );
    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatchObject({
      id: 'scope-label:core',
      draggable: false,
      selectable: false,
      focusable: false,
      data: { title: 'Core', count: 2 },
    });
    const top = visibleGraph(file, { node: null, group: null }, new Set());
    expect(toFlowNodes(file, top, view()).some((n) => n.type === 'scope-label')).toBe(false);
  });

  it('counts the members of collapsed cards in scope', () => {
    const nested: SododeckFile = {
      ...file,
      nodes: [...file.nodes.map((n) => (n.id === 'in2' ? { ...n, group: 'sub' } : n))],
      groups: [...file.groups, { id: 'sub', title: 'Sub', parent: 'core' }],
    };
    const g = visibleGraph(nested, scope, new Set(['sub']));
    const label = toFlowNodes(nested, g, view({ scopeTitle: 'Core' })).find(
      (n) => n.type === 'scope-label',
    );
    expect(label?.data).toMatchObject({ count: 2 });
  });

  it('keeps cached proxy and label objects while their inputs are equal', () => {
    const first = toFlowNodes(file, graph, view({ scopeTitle: 'Core' }));
    const second = toFlowNodes(file, graph, view({ scopeTitle: 'Core' }));
    expect(second).toBe(first);
    const renamed = toFlowNodes(file, graph, view({ scopeTitle: 'Core 2' }));
    expect(renamed.find((n) => n.type === 'scope-label')).not.toBe(
      first.find((n) => n.type === 'scope-label'),
    );
    expect(renamed.find((n) => n.id === 'port:src')).toBe(first.find((n) => n.id === 'port:src'));
  });

  it('draws connectors to a proxy with a handle on the facing side', () => {
    const edges = toFlowEdges(file, graph, view());
    const toProxy = edges.find((e) => e.id === 'a');
    expect(toProxy).toMatchObject({
      source: 'port:src',
      target: 'in1',
      sourceHandle: 'right',
      targetHandle: 'left',
    });
  });
});

describe('typed fields on cards (032)', () => {
  const fieldDeck: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [
      {
        id: 't',
        type: 'task',
        title: 'Write spec',
        position: { x: 0, y: 0 },
        values: { 'task.status': 'doing', 'task.due': '2026-10-14' },
      },
      {
        id: 'w',
        type: 'warehouse',
        title: 'HCM',
        position: { x: 300, y: 0 },
        values: { 'warehouse.sla': 24 },
      },
    ],
  };
  const card = (nodes: ReturnType<typeof toFlowNodes>, id: string) =>
    nodes.find((n) => n.id === id) as DeckFlowNode;

  it('puts the field view in node data and grows the card to fit it', () => {
    const nodes = toFlowNodes(fieldDeck, topLevelGraph(fieldDeck), view({ level: 'container' }));
    const task = card(nodes, 't');
    expect(task.data.fields.header?.name).toBe('Status: In progress');
    expect(task.data.fields.chips.map((c) => c.fieldId)).toEqual(['task.due']);
    expect(task.data.layout.fieldsHeight).toBeGreaterThan(0);
    expect(task.height).toBe(task.data.layout.height);
    expect(task.height).toBeGreaterThan(cardLayout({ title: 'Write spec' }).height);
  });

  it('rebuilds only the cards of a type whose "On card" choice changes', () => {
    const v = view({ level: 'container' });
    const first = toFlowNodes(fieldDeck, topLevelGraph(fieldDeck), v);
    const toggled: SododeckFile = {
      ...fieldDeck,
      fields: [
        { id: 'warehouse.capacity', name: 'Capacity', kind: 'progress', types: ['warehouse'] },
        { id: 'warehouse.sla', name: 'SLA', kind: 'number', unit: 'h', types: ['warehouse'] },
        { id: 'warehouse.region', name: 'Region', kind: 'select', types: ['warehouse'] },
      ],
      fieldDefaults: ['warehouse'],
    };
    const next = toFlowNodes(toggled, topLevelGraph(toggled), v);
    expect(card(next, 't')).toBe(card(first, 't'));
    expect(card(next, 'w')).not.toBe(card(first, 'w'));
    expect(card(next, 'w').data.fields.rows).toEqual([]);
    expect(card(next, 'w').data.fields.hidden).toBe(1);
  });

  it('keeps cards without values exactly as before', () => {
    const plain: SododeckFile = {
      ...emptySododeckFile(),
      nodes: [{ id: 's', type: 'service', title: 'Orders', tech: 'Go', owner: 'Lan' }],
    };
    const [node] = toFlowNodes(plain, topLevelGraph(plain), view({ level: 'container' }));
    expect((node as DeckFlowNode).data.layout.fieldsHeight).toBe(0);
    expect((node as DeckFlowNode).height).toBe(
      cardLayout({ title: 'Orders', description: 'Go' }).height,
    );
  });

  it('sizes the card the same through cardSize once the view state is derived', () => {
    viewStateOf(fieldDeck, null);
    const [node] = fieldDeck.nodes;
    const nodes = toFlowNodes(fieldDeck, topLevelGraph(fieldDeck), view({ level: 'container' }));
    if (node === undefined) throw new Error('no node');
    expect(card(nodes, 't').height).toBe(
      cardSize(node, 'container', { description: node.tech }).height,
    );
  });
});

describe('shapes (031)', () => {
  const shapes: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [
      { id: 'ok', type: 'diamond', title: 'OK?', position: { x: 0, y: 0 } },
      { id: 'db', type: 'database', title: 'Orders DB', position: { x: 400, y: 0 } },
      { id: 'svc', type: 'service', title: 'Svc', position: { x: 0, y: 300 } },
    ],
    edges: [{ id: 'e1', from: 'ok', to: 'db', route: { fromAt: 0.25 } }],
  };
  const flowNode = (file: SododeckFile, id: string) =>
    toFlowNodes(file, topLevelGraph(file), view()).find((n) => n.id === id) as DeckFlowNode;

  it('draws a shape-family node as node type `shape` at its default size, with its geometry', () => {
    expect(flowNode(shapes, 'ok')).toMatchObject({
      type: 'shape',
      width: 176,
      height: 112,
      data: { geometry: 'diamond', kind: 'diamond' },
    });
    expect(flowNode(shapes, 'svc').type).toBe('deck');
    expect(flowNode(shapes, 'svc').data.geometry).toBeUndefined();
    expect(flowNode(shapes, 'db').type).toBe('deck');
  });

  it('refreshes the cached object when display, type or size change; keeps it otherwise', () => {
    const before = flowNode(shapes, 'db');
    expect(flowNode(shapes, 'db')).toBe(before);
    const switched: SododeckFile = {
      ...shapes,
      nodes: shapes.nodes.map((n) => (n.id === 'db' ? { ...n, display: 'shape' as const } : n)),
    };
    const after = flowNode(switched, 'db');
    expect(after).toMatchObject({ type: 'shape', width: 152, height: 104 });
    expect(after.data.geometry).toBe('cylinder');
    // Unchanged neighbours keep their objects.
    expect(flowNode(switched, 'ok')).toBe(flowNode(shapes, 'ok'));
    const resized: SododeckFile = {
      ...switched,
      nodes: switched.nodes.map((n) =>
        n.id === 'db' ? { ...n, size: { width: 300, height: 200 } } : n,
      ),
    };
    expect(flowNode(resized, 'db')).toMatchObject({ width: 300, height: 200 });
  });

  it('gives connectors the geometry of each shape end, refreshed when it changes', () => {
    const [edge] = toFlowEdges(shapes, topLevelGraph(shapes), view());
    expect(edge?.data).toMatchObject({ fromGeometry: 'diamond' });
    expect(edge?.data?.toGeometry).toBeUndefined();
    const switched: SododeckFile = {
      ...shapes,
      nodes: shapes.nodes.map((n) => (n.id === 'db' ? { ...n, display: 'shape' as const } : n)),
    };
    const [next] = toFlowEdges(switched, topLevelGraph(switched), view());
    expect(next?.data?.toGeometry).toBe('cylinder');
  });
});

describe('switching form keeps the object (031 US3, SC-003)', () => {
  const base: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [
      {
        id: 'db',
        type: 'database',
        title: 'Orders DB',
        description: 'Holds orders.',
        tags: ['pci'],
        style: { fill: 'blue' },
        group: 'g',
        position: { x: 10, y: 20 },
      },
    ],
    groups: [{ id: 'g', title: 'Data' }],
  };
  const drawn = (file: SododeckFile) =>
    toFlowNodes(file, topLevelGraph(file), view()).find((n) => n.id === 'db') as DeckFlowNode;
  const withNode = (patch: Partial<SododeckFile['nodes'][number]>): SododeckFile => ({
    ...base,
    nodes: base.nodes.map((n) => ({ ...n, ...patch })),
  });

  it('each form uses its own default size when none is stored', () => {
    expect(drawn(base)).toMatchObject({ type: 'deck', width: 184 });
    expect(drawn(withNode({ display: 'shape' }))).toMatchObject({
      type: 'shape',
      width: 152,
      height: 104,
      position: { x: 10, y: 20 },
    });
  });

  it('a size the user set is kept in both forms', () => {
    const size = { width: 240, height: 160 };
    expect(drawn(withNode({ size }))).toMatchObject({ type: 'deck', ...size });
    expect(drawn(withNode({ size, display: 'shape' }))).toMatchObject({ type: 'shape', ...size });
  });

  it('carries title, colour and id unchanged into the shape', () => {
    const shape = drawn(withNode({ display: 'shape' }));
    expect(shape.id).toBe('db');
    expect(shape.data.title).toBe('Orders DB');
    expect(shape.data.look).toEqual(drawn(base).data.look);
  });
});

describe('flow playback through shapes (031 US5)', () => {
  const file: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [
      { id: 'start', type: 'pill', title: 'Start', position: { x: 0, y: 0 } },
      { id: 'ok', type: 'diamond', title: 'OK?', position: { x: 300, y: 0 } },
      { id: 'db', type: 'database', display: 'shape', title: 'DB', position: { x: 600, y: 0 } },
    ],
  };

  it('marks the current, played and upcoming shapes like cards', () => {
    const overlay: FlowOverlay = {
      edges: new Map(),
      nodes: new Map<string, NodeFlowMark>([
        ['start', { inPath: true, step: { state: 'played', number: '1' } }],
        ['ok', { inPath: true, currentStep: true, step: { state: 'current', number: '2' } }],
        ['db', { inPath: true, step: { state: 'upcoming', number: '3' } }],
      ]),
    };
    const nodes = toFlowNodes(file, topLevelGraph(file), view(), overlay);
    const byId = (id: string) => nodes.find((n) => n.id === id) as DeckFlowNode;
    expect(byId('ok')).toMatchObject({
      type: 'shape',
      className: 'in-flow',
      data: { currentStep: true, step: { state: 'current' } },
    });
    expect(byId('start').data.step?.state).toBe('played');
    expect(byId('db')).toMatchObject({ type: 'shape', data: { step: { state: 'upcoming' } } });
  });
});

describe('group connector ends (050 US4)', () => {
  const grouped: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [
      { id: 'free', type: 'service', title: 'Free', position: { x: 600, y: 0 } },
      { id: 'a', type: 'service', title: 'A', group: 'core', position: { x: 40, y: 60 } },
      { id: 'o', type: 'service', title: 'O', group: 'other', position: { x: 40, y: 600 } },
    ],
    groups: [
      { id: 'core', title: 'Core', position: { x: 0, y: 0 }, size: { width: 400, height: 300 } },
      { id: 'other', title: 'Other' },
    ],
    edges: [
      { id: 'toCore', from: 'free', to: 'core', label: 'reads' },
      { id: 'own', from: 'core', to: 'a' },
      { id: 'groups', from: 'core', to: 'other' },
    ],
  };

  it('draws a connector to a shown group from its frame box', () => {
    const graph = topLevelGraph(grouped);
    const edges = toFlowEdges(grouped, graph, view());
    const toCore = edges.find((e) => e.id === 'toCore');
    expect(toCore).toMatchObject({
      source: 'free',
      target: 'group:core',
      ariaLabel: 'Free to Core: reads',
      data: { toTitle: 'Core', toSize: { width: 400, height: 300 }, routable: true },
    });
    const frame = groupBounds(grouped).get('other');
    expect(edges.find((e) => e.id === 'groups')).toMatchObject({
      source: 'group:core',
      target: 'group:other',
      data: { toSize: { width: frame?.width, height: frame?.height } },
    });
    // A group and its own member: allowed in a file, so it is drawn.
    expect(edges.find((e) => e.id === 'own')).toMatchObject({
      source: 'group:core',
      target: 'a',
    });
  });

  it('ends a connector to a collapsed group on its card', () => {
    const graph = visibleGraph(grouped, { node: null, group: null }, new Set(['core']));
    const edges = toFlowEdges(grouped, graph, view());
    expect(edges.find((e) => e.id === 'merged:collapsed:core|free')).toMatchObject({
      source: 'collapsed:core',
      target: 'free',
    });
    expect(edges.find((e) => e.id === 'merged:collapsed:core|group:other')).toMatchObject({
      source: 'collapsed:core',
      target: 'group:other',
      ariaLabel: '1 connections between Core and Other',
    });
  });

  it('ends a connector to a group out of the drill scope on a proxy', () => {
    const graph = visibleGraph(grouped, { node: null, group: 'core' }, new Set());
    const nodes = toFlowNodes(grouped, graph, view());
    expect(nodes.find((n) => n.id === 'port:core')).toMatchObject({
      type: 'port',
      data: { outsideNodeId: 'core', outsideTitle: 'Core', kind: 'group' },
    });
    const edges = toFlowEdges(grouped, graph, view());
    expect(edges.find((e) => e.id === 'own')).toMatchObject({
      source: 'port:core',
      target: 'a',
    });
  });

  it('bundles parallel group connectors between the frames they are drawn on', () => {
    const deck: SododeckFile = {
      ...grouped,
      edges: [
        { id: 'g1', from: 'core', to: 'other' },
        { id: 'g2', from: 'other', to: 'core' },
      ],
    };
    const graph = topLevelGraph(deck);
    const bundles = bundleEdges(deck, graph, { exclude: new Set(), fanned: new Set(), off: false });
    expect(bundles.bundles).toMatchObject([{ a: 'group:core', b: 'group:other' }]);
    const edges = toFlowEdges(deck, graph, view(), undefined, bundles);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      source: 'group:core',
      target: 'group:other',
      ariaLabel: '2 connections between Core and Other',
    });
  });

  it("puts a card's group connector and the frame in the card's focus set", () => {
    const graph = topLevelGraph(grouped);
    expect(focusSet(grouped, graph, 'free')).toMatchObject({
      members: new Set(['free', 'group:core']),
      edges: new Set(['toCore']),
    });
  });
});
