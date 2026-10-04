import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { EMPTY_SELECTION } from '../../state/ui-store';
import { toFlowEdges, toFlowNodes, type CanvasView } from '../deck-to-flow';
import { visibleGraph } from '../visible-graph';
import { viewStateOf } from './view-state';

const file = deckOf({
  nodes: [
    { id: 'p', type: 'db-table', title: 'payments', schema: 'billing', position: { x: 0, y: 0 } },
    { id: 'i', type: 'db-table', title: 'invoices', schema: 'billing', position: { x: 300, y: 0 } },
    { id: 'c', type: 'db-table', title: 'customers', schema: 'crm', position: { x: 0, y: 300 } },
    { id: 'o', type: 'db-table', title: 'orders', schema: 'sales', position: { x: 300, y: 300 } },
    { id: 's', type: 'service', title: 'Svc', position: { x: 600, y: 0 } },
  ],
  edges: [
    { id: 'pc', from: 'p', to: 'c' },
    { id: 'ic', from: 'i', to: 'c' },
    { id: 'po', from: 'o', to: 'p' },
    { id: 'pi', from: 'p', to: 'i' },
    { id: 'ps', from: 'p', to: 's' },
  ],
  views: [
    { id: 'base', type: 'system', title: 'All' },
    { id: 'v', type: 'custom', title: 'Billing', schemas: ['billing'] },
  ],
});

const canvas: CanvasView = {
  selection: EMPTY_SELECTION,
  focusedId: null,
  focusedEdgeId: null,
  labelsOn: false,
  level: 'component',
  focus: null,
  marks: { merged: new Map(), cards: new Map(), cardNumbers: new Map() },
};

describe('hidden tables as Outside proxies (048 US5)', () => {
  const state = viewStateOf(file, 'v');
  const graph = visibleGraph(
    state.deck,
    { node: null, group: null },
    state.collapsed,
    state.outside,
  );

  it('lists the hidden tables, not the other hidden components', () => {
    expect([...state.outside.keys()].sort()).toEqual(['c', 'o']);
    expect(viewStateOf(file, null).outside.size).toBe(0);
  });

  it('draws one proxy per hidden table that a visible table connects to', () => {
    const nodes = toFlowNodes(state.deck, graph, { ...canvas, render: state.render });
    const ports = nodes.filter((node) => node.type === 'port');
    expect(ports.map((port) => port.id).sort()).toEqual(['port:c', 'port:o']);
    expect(ports.find((port) => port.id === 'port:c')?.data).toMatchObject({
      outsideTitle: 'customers',
      kind: 'db-table',
    });
  });

  it('ends each connector on its proxy, one per relationship', () => {
    const edges = toFlowEdges(state.deck, graph, { ...canvas, render: state.render });
    const to = (id: string) => edges.find((edge) => edge.id === id);
    expect([to('pc')?.source, to('pc')?.target]).toEqual(['p', 'port:c']);
    expect([to('ic')?.source, to('ic')?.target]).toEqual(['i', 'port:c']);
    expect([to('po')?.source, to('po')?.target]).toEqual(['port:o', 'p']);
    expect(to('pi')?.source).toBe('p');
  });
});
