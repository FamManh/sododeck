import { VIEW_PRESETS } from '@sododeck/model';
import type { SododeckFile, View } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { groupBounds } from '../canvas-geometry';
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
    const infra = viewStateOf(deck, 'infra');
    expect(infra.isBase).toBe(false);
    expect(infra.render.subtitleField).toBe('host');
    expect([...infra.render.dimmed]).toEqual(['a']);
    const feature = viewStateOf(deck, 'feature');
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
