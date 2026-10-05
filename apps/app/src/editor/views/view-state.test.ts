import { VIEW_PRESETS } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile, type View } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { groupBounds, tableLayoutOf } from '../canvas-geometry';
import { visibleGraph } from '../visible-graph';
import { subtitleOf, viewDeck, viewStateOf } from './view-state';

const deck: SododeckFile = deckOf({
  nodes: [
    { id: 'a', type: 'client', title: 'A', position: { x: 0, y: 0 }, tech: 'React', owner: 'Web' },
    { id: 'b', type: 'service', title: 'B', group: 'g', host: 'k8s', owner: ' ' },
    { id: 'c', type: 'external', title: 'C', group: 'g', position: { x: 300, y: 0 } },
    { id: 'd', type: 'database', title: 'D', parent: 'b', position: { x: 50, y: 50 } },
  ],
  groups: [{ id: 'g', title: 'G' }],
  edges: [
    { id: 'ab', from: 'a', to: 'b' },
    { id: 'bc', from: 'b', to: 'c' },
    { id: 'db', from: 'd', to: 'c' },
  ],
  stickies: [
    { id: 'on-c', text: 'On C', anchor: 'c' },
    { id: 'free', text: 'Free', position: { x: 9, y: 9 } },
  ],
  flows: [
    { id: 'f', title: 'F', steps: [{ id: 's', edge: 'ab' }] },
    { id: 'f2', title: 'F2', steps: [{ id: 's2', edge: 'ab' }] },
  ],
});
const none = new Set<string>();
const view = (patch: Partial<View> = {}): View => ({
  id: 'v',
  type: 'custom',
  title: 'V',
  ...patch,
});

describe('viewDeck: the deck as a view draws it (ADR 0012 §6)', () => {
  it('returns the snapshot itself when the view changes nothing', () => {
    expect(viewDeck(deck, view(), none)).toBe(deck);
    expect(viewDeck(deck, view({ positions: {} }), none)).toBe(deck);
  });

  it('places components at their view position and keeps the others', () => {
    const v = view({ positions: { a: { x: 7, y: 8 } } });
    const projected = viewDeck(deck, v, none);
    expect(projected.nodes[0]?.position).toEqual({ x: 7, y: 8 });
    expect(projected.nodes[1]).toBe(deck.nodes[1]);
    expect(projected.edges).toBe(deck.edges);
    // Memoized: same inputs, same objects.
    expect(viewDeck(deck, v, none)).toBe(projected);
    expect(viewDeck({ ...deck }, v, none).nodes).toBe(projected.nodes);
  });

  it('leaves hidden components and their notes out, keeping grid slots of the full list', () => {
    const hidden = new Set(['a', 'c']);
    const projected = viewDeck(deck, view(), hidden);
    expect(projected.nodes.map((n) => n.id)).toEqual(['b', 'd']);
    // b had no position: it keeps the grid slot of index 1, not 0.
    expect(projected.nodes[0]?.position).toEqual({ x: 220, y: 0 });
    expect(projected.stickies.map((s) => s.id)).toEqual(['free']);
  });

  it('gives group bounds of the visible members only', () => {
    const projected = viewDeck(deck, view(), new Set(['c']));
    const bounds = groupBounds(projected).get('g');
    expect(bounds?.x).toBeLessThan(300);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThan(300 + 164);
  });
});

describe('viewDeck: group frames of a view (016, R4)', () => {
  const framed: SododeckFile = {
    ...deck,
    groups: [{ id: 'g', title: 'G', position: { x: 0, y: 0 }, size: { width: 500, height: 300 } }],
  };
  const own = { position: { x: 40, y: 50 }, size: { width: 600, height: 400 } };

  it('projects the view’s own frame onto the group, keeping the other fields', () => {
    const v = view({ groupFrames: { g: own } });
    const projected = viewDeck(framed, v, none);
    expect(projected.groups[0]).toEqual({ id: 'g', title: 'G', ...own });
    expect(groupBounds(projected).get('g')).toEqual({ x: 40, y: 50, width: 600, height: 400 });
    expect(projected.nodes).toBe(framed.nodes);
    expect(viewDeck({ ...framed }, v, none).groups).toBe(projected.groups);
  });

  it('leaves base frames alone when the view has none', () => {
    expect(viewDeck(framed, view(), none)).toBe(framed);
    expect(viewDeck(framed, view({ groupFrames: {} }), none)).toBe(framed);
    const [base] = viewStateOf(framed, null).deck.groups;
    expect(base).toBe(framed.groups[0]);
  });
});

describe('visibleGraph over a view deck (FR-012)', () => {
  const top = { node: null, group: null };

  it('drops a hidden component and its connections, without merging them', () => {
    // `viewFilter` hides d with its parent b.
    const graph = visibleGraph(viewDeck(deck, view(), new Set(['b', 'd'])), top, none);
    expect(graph.nodes).toEqual(['a', 'c']);
    expect(graph.edges).toEqual([]);
    expect(graph.merged).toEqual([]);
    expect(graph.ports).toEqual([]);
  });

  it('counts only visible members in a collapsed group', () => {
    const graph = visibleGraph(viewDeck(deck, view(), new Set(['c'])), top, new Set(['g']));
    expect(graph.cards).toEqual([
      expect.objectContaining({ groupId: 'g', nodeCount: 1, edgeCount: 0 }),
    ]);
    expect(graph.merged.map((m) => m.edgeIds)).toEqual([['ab']]);
  });

  it('does not turn a hidden end outside the scope into a port pill', () => {
    const scope = { node: 'b', group: null };
    expect(visibleGraph(deck, scope, none).ports.map((p) => p.outsideNodeId)).toEqual(['c']);
    expect(visibleGraph(viewDeck(deck, view(), new Set(['c'])), scope, none).ports).toEqual([]);
  });
});

describe('subtitleOf (FR-010, FR-011)', () => {
  const counts = new Map([
    ['a', 3],
    ['b', 1],
  ]);
  const render = (subtitleField: View['subtitleField'] & string) => ({
    subtitleField,
    flowCounts: counts,
  });
  const [a, b, c] = deck.nodes as [
    SododeckFile['nodes'][number],
    SododeckFile['nodes'][number],
    SododeckFile['nodes'][number],
  ];

  it('shows the chosen field', () => {
    expect(subtitleOf(a, render('tech'))).toBe('React');
    expect(subtitleOf(b, render('host'))).toBe('k8s');
    expect(subtitleOf(a, render('owner'))).toBe('Web');
    expect(subtitleOf(a, render('none'))).toBeUndefined();
  });

  it('reads "<n> flows · <owner>", singular for one, owner omitted when blank', () => {
    expect(subtitleOf(a, render('flows'))).toBe('3 flows · Web');
    expect(subtitleOf(b, render('flows'))).toBe('1 flow');
    expect(subtitleOf(c, render('flows'))).toBe('0 flows');
  });
});

describe('viewStateOf', () => {
  it('resolves the presets and falls back to the first view', () => {
    const state = viewStateOf(deck, null);
    expect(state.view).toBe(VIEW_PRESETS[0]);
    expect(state.isBase).toBe(true);
    expect(state.deck).toBe(deck);
    expect(viewStateOf(deck, 'gone').view.id).toBe('system');
    expect(viewStateOf(deck, null)).toBe(state);
  });

  it('Infra: host subtitles and dimmed clients; Feature: flow counts', () => {
    // Infra is no longer a preset (054); a deck can still store one.
    const withInfra = {
      ...deck,
      views: [
        ...VIEW_PRESETS,
        {
          id: 'infra',
          type: 'infra' as const,
          title: 'Infra',
          subtitleField: 'host' as const,
          dimKinds: ['client' as const],
        },
      ],
    };
    const infra = viewStateOf(withInfra, 'infra');
    expect(infra.isBase).toBe(false);
    expect(infra.render.subtitleField).toBe('host');
    expect([...infra.render.dimmed]).toEqual(['a']);
    const feature = viewStateOf(withInfra, 'feature');
    expect(feature.render.flowCounts.get('a')).toBe(2);
  });

  it('reads pins and collapsed groups of the view, and marks revealed components', () => {
    const file = {
      ...deck,
      views: [view({ excludeKinds: ['external'], pinned: ['a'], collapsed: ['g'] })],
    };
    const state = viewStateOf(file, 'v', new Set(['c']));
    expect([...state.render.pinned]).toEqual(['a']);
    expect([...state.collapsed]).toEqual(['g']);
    expect(state.hidden.size).toBe(0);
    expect([...state.render.revealedHidden]).toEqual(['c']);
    expect(viewStateOf(file, 'v').hidden).toEqual(new Set(['c']));
  });
});

describe('collapsed groups of a view keep their identity', () => {
  it('returns the same set while the view’s list is unchanged', () => {
    const file = { ...deck, views: [view({ collapsed: ['g'] })] };
    const a = viewStateOf(file, 'v').collapsed;
    const b = viewStateOf({ ...file, nodes: [...file.nodes] }, 'v').collapsed;
    expect(b).toBe(a);
    expect([...a]).toEqual(['g']);
    expect(viewStateOf(deck, null).collapsed.size).toBe(0);
  });
});

describe('empty groups and hidden members (031)', () => {
  const file: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [{ id: 'q', type: 'queue', title: 'Q', group: 'full' }],
    groups: [
      { id: 'full', title: 'Full', position: { x: 0, y: 0 }, size: { width: 300, height: 200 } },
      {
        id: 'empty',
        title: 'Empty',
        position: { x: 400, y: 0 },
        size: { width: 300, height: 200 },
      },
    ],
    views: [{ id: 'v', title: 'No queues', type: 'custom', excludeKinds: ['queue'] }],
  };

  it('draws a group with no members, but not one whose members the view hides', () => {
    const state = viewStateOf(file, 'v');
    const graph = visibleGraph(state.deck, { node: null, group: null }, new Set());
    expect(graph.groups).toEqual(['empty']);
    const all = visibleGraph(file, { node: null, group: null }, new Set());
    expect(all.groups).toEqual(['full', 'empty']);
  });
});

describe('row editing shows its table at All (043 R4, FR-010a)', () => {
  const tables: SododeckFile = deckOf({
    nodes: [
      {
        id: 't1',
        type: 'db-table',
        title: 'orders',
        detail: 'keys',
        columns: [{ id: 'c1', name: 'id', type: 'int', pk: true }],
      },
      { id: 't2', type: 'db-table', title: 'items', detail: 'keys', columns: [] },
    ],
  });

  it('patches detail: all on the row-editing table only, and never the document', () => {
    const editing = viewStateOf(tables, null, none, { tableId: 't1', newRowAt: null });
    expect(editing.deck.nodes[0]?.detail).toBe('all');
    // Opened too (048), so the edited row is never behind the row limit.
    expect(editing.deck.nodes[0]?.expanded).toBe(true);
    expect(tables.nodes[0]?.expanded).toBeUndefined();
    expect(editing.deck.nodes[1]).toBe(tables.nodes[1]);
    expect(tables.nodes[0]?.detail).toBe('keys');
  });

  it('restores the projection when row editing ends', () => {
    viewStateOf(tables, null, none, { tableId: 't1', newRowAt: null });
    const after = viewStateOf(tables, null, none, null);
    expect(after.deck.nodes[0]).toBe(tables.nodes[0]);
    expect(after.deck.nodes[0]?.detail).toBe('keys');
  });

  it('gives the canvas layout the new-row slot, so the card grows by one row', () => {
    const before = tableLayoutOf(tables.nodes[0] ?? { title: '' });
    const node = viewStateOf(tables, null, none, { tableId: 't1', newRowAt: 1 }).deck.nodes[0];
    if (node === undefined) throw new Error('no table');
    const after = tableLayoutOf(node);
    expect(after.newRowIndex).toBe(1);
    expect(after.height).toBe(before.height + 24);
  });

  it('keeps the same projected deck for the same row-editing state', () => {
    const a = viewStateOf(tables, null, none, { tableId: 't1', newRowAt: null });
    const b = viewStateOf(tables, null, none, { tableId: 't1', newRowAt: null });
    expect(b.deck).toBe(a.deck);
  });
});

describe('touched rows of the current flow step (049 R3)', () => {
  const file: SododeckFile = {
    ...emptySododeckFile(),
    tableDisplay: { detail: 'keys' },
    nodes: [
      {
        id: 'orders',
        type: 'db-table',
        title: 'orders',
        columns: [
          { id: 'o-id', name: 'id', type: 'int', pk: true },
          { id: 'o-total', name: 'total', type: 'int' },
        ],
      },
      { id: 'svc', type: 'service', title: 'Svc' },
    ],
  };

  it('marks only the touched tables, keeps the rest, and reuses the projection', () => {
    const rows = new Map([['orders', new Set(['o-total'])]]);
    const state = viewStateOf(file, null, none, null, null, rows);
    const [orders, svc] = state.deck.nodes;
    if (orders === undefined) throw new Error('orders expected');
    expect(orders).not.toBe(file.nodes[0]);
    expect(svc).toBe(file.nodes[1]);
    expect(tableLayoutOf(orders).rows.map((r) => r.columnId)).toEqual(['o-id', 'o-total']);
    expect(viewStateOf(file, null, none, null, null, rows)).toBe(state);
    expect(viewStateOf(file, null, none).deck.nodes[0]).toBe(file.nodes[0]);
  });
});

describe('column filter projection (048 R4)', () => {
  const tables: SododeckFile = deckOf({
    nodes: [
      {
        id: 't1',
        type: 'db-table',
        title: 'orders',
        columns: [
          { id: 'c1', name: 'id', type: 'int', pk: true },
          { id: 'c2', name: 'invoice_id', type: 'int' },
        ],
      },
      { id: 't2', type: 'db-table', title: 'items', columns: [] },
    ],
  });
  const filter = (text: string) => ({ tableId: 't1', text });

  it('marks only the filtered table so its layout folds, and never writes the document', () => {
    const state = viewStateOf(tables, null, none, null, filter('invoice'));
    const node = state.deck.nodes[0];
    if (node === undefined) throw new Error('no table');
    expect(tableLayoutOf(node).rows.map((r) => r.columnId)).toEqual(['c2']);
    expect(state.deck.nodes[1]).toBe(tables.nodes[1]);
    expect(tables.nodes[0]).not.toBe(node);
  });

  it('is the same deck for blank text and after the filter closes', () => {
    expect(viewStateOf(tables, null, none, null, filter('  ')).deck).toBe(tables);
    viewStateOf(tables, null, none, null, filter('id'));
    expect(viewStateOf(tables, null, none, null, null).deck.nodes[0]).toBe(tables.nodes[0]);
  });

  it('keeps node identity for the same text so the layout cache holds', () => {
    const a = viewStateOf(tables, null, none, null, filter('id')).deck.nodes[0];
    viewStateOf(tables, null, none, null, null);
    const b = viewStateOf(tables, null, none, null, filter('id')).deck.nodes[0];
    expect(b).toBe(a);
  });

  it('combines with row editing on the same table', () => {
    const state = viewStateOf(tables, null, none, { tableId: 't1', newRowAt: null }, filter('inv'));
    const node = state.deck.nodes[0];
    if (node === undefined) throw new Error('no table');
    expect(tableLayoutOf(node).rows.map((r) => r.columnId)).toEqual(['c2']);
  });
});
