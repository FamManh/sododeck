import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { visibleGraph } from '../visible-graph';
import { viewStateOf } from './view-state';

const base: Partial<SododeckFile> = {
  nodes: [
    { id: 'p', type: 'db-table', title: 'payments', schema: 'billing', group: 'g' },
    { id: 'i', type: 'db-table', title: 'invoices', schema: 'billing' },
    { id: 'u', type: 'db-table', title: 'users', schema: 'auth' },
    { id: 'x', type: 'service', title: 'X' },
  ],
  groups: [{ id: 'g', title: 'G' }],
  edges: [
    { id: 'pi', from: 'p', to: 'i' },
    { id: 'iu', from: 'i', to: 'u' },
  ],
};

describe('viewStateOf grouping mode (048)', () => {
  it('By group is today: the deck is the snapshot itself', () => {
    const file = deckOf(base);
    expect(viewStateOf(file, null).deck).toBe(file);
  });

  it('By schema draws a group per schema and collapses it from the view list', () => {
    const file = deckOf({
      ...base,
      groupingMode: 'schema',
      views: [{ id: 'v', type: 'custom', title: 'V', collapsed: ['schema:billing'] }],
    });
    const state = viewStateOf(file, 'v');
    expect(state.deck.groups.map((g) => g.id)).toEqual(['schema:billing', 'schema:auth']);
    const graph = visibleGraph(state.deck, { node: null, group: null }, state.collapsed);
    expect(graph.cards.map((c) => [c.groupId, c.nodeCount, c.edgeCount])).toEqual([
      ['schema:billing', 2, 1],
    ]);
    expect(graph.merged).toHaveLength(1);
    // The stored deck still has every table and no derived group (FR-015).
    expect(file.groups.map((g) => g.id)).toEqual(['g']);
  });

  it('keeps each mode collapse state in the one list', () => {
    const file = deckOf({
      ...base,
      views: [{ id: 'v', type: 'custom', title: 'V', collapsed: ['g', 'schema:billing'] }],
    });
    const byGroup = viewStateOf(file, 'v');
    expect(
      visibleGraph(byGroup.deck, { node: null, group: null }, byGroup.collapsed).cards.map(
        (c) => c.groupId,
      ),
    ).toEqual(['g']);
  });
});
