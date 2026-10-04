import { describe, expect, it } from 'vitest';

import { generateBenchDeck } from '../bench/generate-deck';
import { deckOf } from '../test/render-canvas';
import { bundleEdges } from './bundles';
import {
  columnFocusSet,
  connectionCount,
  connectionsText,
  focusSet,
  relationshipRows,
} from './focus-set';
import { visibleGraph } from './visible-graph';

describe('focusSet', () => {
  it('returns the focused node, its visible neighbours, and the connecting edges', () => {
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A' },
        { id: 'b', type: 'service', title: 'B' },
        { id: 'c', type: 'service', title: 'C' },
      ],
      edges: [
        { id: 'ab', from: 'a', to: 'b' },
        { id: 'bc', from: 'b', to: 'c' },
      ],
    });
    const graph = visibleGraph(deck, { node: null, group: null }, new Set());
    expect(focusSet(deck, graph, 'b')).toEqual({
      focusId: 'b',
      members: new Set(['a', 'b', 'c']),
      edges: new Set(['ab', 'bc']),
    });
  });

  it('focuses a collapsed card and its merged neighbours', () => {
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'core' },
        { id: 'b', type: 'service', title: 'B', group: 'core' },
        { id: 'c', type: 'service', title: 'C' },
      ],
      groups: [{ id: 'core', title: 'Core' }],
      edges: [
        { id: 'ac', from: 'a', to: 'c' },
        { id: 'bc', from: 'b', to: 'c' },
      ],
    });
    const graph = visibleGraph(deck, { node: null, group: null }, new Set(['core']));
    expect(focusSet(deck, graph, 'collapsed:core')).toEqual({
      focusId: 'collapsed:core',
      members: new Set(['collapsed:core', 'c']),
      edges: new Set(['merged:c|collapsed:core']),
    });
  });

  it('returns null for an element not visible in the graph', () => {
    const deck = deckOf({
      nodes: [
        { id: 'parent', type: 'service', title: 'Parent' },
        { id: 'child', type: 'service', title: 'Child', parent: 'parent' },
      ],
    });
    const graph = visibleGraph(deck, { node: null, group: null }, new Set());
    expect(focusSet(deck, graph, 'child')).toBeNull();
  });
});

describe('connection counts (034)', () => {
  it('counts every connector a merged connector folds, and words the announcement', () => {
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'core' },
        { id: 'b', type: 'service', title: 'B', group: 'core' },
        { id: 'c', type: 'service', title: 'C' },
        { id: 'd', type: 'service', title: 'D' },
      ],
      groups: [{ id: 'core', title: 'Core' }],
      edges: [
        { id: 'ac', from: 'a', to: 'c' },
        { id: 'bc', from: 'b', to: 'c' },
        { id: 'cd', from: 'c', to: 'd' },
      ],
    });
    const graph = visibleGraph(deck, { node: null, group: null }, new Set(['core']));
    const set = focusSet(deck, graph, 'c');
    expect(set === null ? 0 : connectionCount(set, graph)).toBe(3);
    expect(connectionsText('C', 3)).toBe('C: 3 connections');
    expect(connectionsText('C', 1)).toBe('C: 1 connection');
    expect(connectionsText('C', 0)).toBe('C: 0 connections');
  });
});

describe('focus sets with bundles and proxies (034 T020)', () => {
  const deck = deckOf({
    nodes: [
      { id: 'a', type: 'service', title: 'A' },
      { id: 'b', type: 'service', title: 'B' },
      { id: 'c', type: 'service', title: 'C' },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b' },
      { id: 'e2', from: 'a', to: 'b' },
      { id: 'e3', from: 'a', to: 'c' },
    ],
  });
  const graph = visibleGraph(deck, { node: null, group: null }, new Set());
  const none = new Set<string>();

  it('counts a folded bundle as one connection, by its bundle id', () => {
    const bundles = bundleEdges(deck, graph, { exclude: none, fanned: none, off: false });
    const set = focusSet(deck, graph, 'a', bundles);
    expect(set?.edges).toEqual(new Set(['bundle:a|b', 'e3']));
    expect(set?.members).toEqual(new Set(['a', 'b', 'c']));
    expect(set === null ? 0 : connectionCount(set, graph, bundles)).toBe(3);
  });

  it('lists the connectors of a fanned bundle by their own ids, and keeps the pill', () => {
    const bundles = bundleEdges(deck, graph, {
      exclude: none,
      fanned: new Set(['bundle:a|b']),
      off: false,
    });
    const set = focusSet(deck, graph, 'a', bundles);
    expect(set?.edges).toEqual(new Set(['e1', 'e2', 'e3', 'bundle:a|b']));
    expect(set === null ? 0 : connectionCount(set, graph, bundles)).toBe(4);
  });

  it('makes the outside proxy a neighbour of the inside cards it connects to', () => {
    const drilled = deckOf({
      nodes: [
        { id: 'in', type: 'service', title: 'In', group: 'core' },
        { id: 'other', type: 'service', title: 'Other', group: 'core' },
        { id: 'out', type: 'service', title: 'Out' },
      ],
      groups: [{ id: 'core', title: 'Core' }],
      edges: [
        { id: 'p1', from: 'out', to: 'in' },
        { id: 'p2', from: 'in', to: 'out' },
      ],
    });
    const g = visibleGraph(drilled, { node: null, group: 'core' }, new Set());
    const bundles = bundleEdges(drilled, g, { exclude: none, fanned: none, off: false });
    expect(focusSet(drilled, g, 'in', bundles)).toEqual({
      focusId: 'in',
      members: new Set(['in', 'port:out']),
      edges: new Set(['bundle:in|port:out']),
    });
    expect(focusSet(drilled, g, 'other', bundles)?.members).toEqual(new Set(['other']));
    expect(focusSet(drilled, g, 'in')?.edges).toEqual(new Set(['p1', 'p2']));
  });
});

describe('columnFocusSet (042 R14)', () => {
  const deck = deckOf({
    nodes: [
      { id: 'orders', type: 'db-table', title: 'orders' },
      { id: 'customers', type: 'db-table', title: 'customers' },
      { id: 'invoices', type: 'db-table', title: 'invoices' },
      { id: 'lines', type: 'db-table', title: 'lines' },
    ],
    edges: [
      { id: 'r1', from: 'orders', to: 'customers', fromColumns: ['o.cid'], toColumns: ['c.id'] },
      { id: 'r2', from: 'invoices', to: 'customers', fromColumns: ['i.cid'], toColumns: ['c.id'] },
      {
        id: 'r3',
        from: 'lines',
        to: 'customers',
        fromColumns: ['l.a', 'l.cid'],
        toColumns: ['c.x', 'c.id'],
      },
    ],
  });

  it('lights one relationship, its other table and the rows at both ends', () => {
    expect(columnFocusSet(deck, 'orders', 'o.cid')).toEqual({
      focusId: 'orders',
      members: new Set(['orders', 'customers']),
      edges: new Set(['r1']),
      rows: new Set(['orders:o.cid', 'customers:c.id']),
    });
  });

  it('lights every relationship on a referenced key, composite members included', () => {
    const set = columnFocusSet(deck, 'customers', 'c.id');
    expect(set?.edges).toEqual(new Set(['r1', 'r2', 'r3']));
    expect(set?.members).toEqual(new Set(['customers', 'orders', 'invoices', 'lines']));
    expect(set?.rows).toEqual(
      new Set([
        'orders:o.cid',
        'customers:c.id',
        'invoices:i.cid',
        'lines:l.a',
        'lines:l.cid',
        'customers:c.x',
      ]),
    );
  });

  it('is undefined for a column without relationships', () => {
    expect(columnFocusSet(deck, 'orders', 'o.id')).toBeUndefined();
  });

  it('gives a relationship its end rows', () => {
    expect(relationshipRows(deck, 'r1')).toEqual(new Set(['orders:o.cid', 'customers:c.id']));
    expect(relationshipRows(deck, 'gone')).toEqual(new Set());
  });
});

describe('focusSet on tables (048 US6)', () => {
  const top = { node: null, group: null };
  const table = (id: string, group?: string) => ({
    id,
    type: 'db-table' as const,
    title: id,
    ...(group === undefined ? {} : { group }),
  });
  // t has four related tables (n1, n2 outgoing; n3, n4 incoming), n1 and n3 also relate to each
  // other, x is only related to n2, and t references itself.
  const nodes = ['t', 'n1', 'n2', 'n3', 'n4', 'x', 'far'].map((id) =>
    id === 't'
      ? {
          ...table(id),
          columns: [
            { id: 'c1', name: 'id', type: 'int' },
            { id: 'c2', name: 'parent', type: 'int' },
          ],
        }
      : table(id),
  );
  const edges = [
    { id: 'tn1', from: 't', to: 'n1' },
    { id: 'tn2', from: 't', to: 'n2' },
    { id: 'n3t', from: 'n3', to: 't' },
    { id: 'n4t', from: 'n4', to: 't' },
    { id: 'self', from: 't', to: 't', fromColumns: ['c2'], toColumns: ['c1'] },
    { id: 'n1n3', from: 'n1', to: 'n3' },
    { id: 'n2x', from: 'n2', to: 'x' },
    { id: 'xfar', from: 'x', to: 'far' },
  ];

  it('keeps the table and its four neighbours, either direction, a self-reference adding none', () => {
    const deck = deckOf({ nodes, edges });
    const set = focusSet(deck, visibleGraph(deck, top, new Set()), 't');
    expect([...(set?.members ?? [])].sort()).toEqual(['n1', 'n2', 'n3', 'n4', 't']);
  });

  it('highlights the relationships among the kept tables, and only those', () => {
    const deck = deckOf({ nodes, edges });
    const set = focusSet(deck, visibleGraph(deck, top, new Set()), 't');
    expect([...(set?.edges ?? [])].sort()).toEqual(['n1n3', 'n3t', 'n4t', 'self', 'tn1', 'tn2']);
  });

  it('keeps the card of a collapsed group strong, and lights the merged connector among kept', () => {
    const deck = deckOf({
      nodes: [table('t'), table('n1', 'g'), table('n2', 'g'), table('n3')],
      groups: [{ id: 'g', title: 'G' }],
      edges: [
        { id: 'tn1', from: 't', to: 'n1' },
        { id: 'tn2', from: 't', to: 'n2' },
        { id: 'tn3', from: 't', to: 'n3' },
        { id: 'n2n3', from: 'n2', to: 'n3' },
      ],
    });
    const set = focusSet(deck, visibleGraph(deck, top, new Set(['g'])), 't');
    expect([...(set?.members ?? [])].sort()).toEqual(['collapsed:g', 'n3', 't']);
    expect(set?.edges.has('merged:collapsed:g|n3')).toBe(true);
    expect(set?.edges.has('merged:collapsed:g|t')).toBe(true);
    expect(set?.edges.has('tn3')).toBe(true);
  });

  it('counts the neighbours of a table on the 150-table deck', () => {
    const { deck } = generateBenchDeck(150, 250, 42, { tables: 150, rel: true });
    const ids = new Set(deck.nodes.filter((n) => n.type === 'db-table').map((n) => n.id));
    const related = (id: string) =>
      new Set(
        deck.edges.flatMap((e) =>
          e.from === id && e.to !== id && ids.has(e.to)
            ? [e.to]
            : e.to === id && e.from !== id && ids.has(e.from)
              ? [e.from]
              : [],
        ),
      );
    const focus = [...ids].find((id) => related(id).size >= 3);
    if (focus === undefined) throw new Error('The fixture has no connected table');
    const set = focusSet(deck, visibleGraph(deck, top, new Set()), focus);
    expect(set?.members).toEqual(new Set([focus, ...related(focus)]));
    // Every highlighted relationship has both ends among the kept tables.
    for (const id of set?.edges ?? []) {
      const edge = deck.edges.find((e) => e.id === id);
      expect(set?.members.has(edge?.from ?? '')).toBe(true);
      expect(set?.members.has(edge?.to ?? '')).toBe(true);
    }
  });
});
