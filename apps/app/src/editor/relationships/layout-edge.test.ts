import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { tableContextOf } from '../table-keys';
import { layoutEdgeOf } from './layout-edge';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    {
      id: 'users',
      type: 'db-table',
      title: 'users',
      columns: [{ id: 'u-id', name: 'id', type: 'uuid', pk: true }],
    },
    {
      id: 'orders',
      type: 'db-table',
      title: 'orders',
      columns: [
        { id: 'o-id', name: 'id', type: 'uuid', pk: true },
        { id: 'o-user', name: 'user_id', type: 'uuid' },
      ],
    },
    { id: 'api', type: 'service', title: 'API' },
  ],
  edges: [
    {
      id: 'fk',
      from: 'orders',
      to: 'users',
      fromColumns: ['o-user'],
      toColumns: ['u-id'],
      cardinality: 'n-1',
    },
    { id: 'plain', from: 'api', to: 'users' },
  ],
};
const nodesById = new Map(deck.nodes.map((n) => [n.id, n]));
const context = tableContextOf(deck);
const edge = (id: string) => {
  const found = deck.edges.find((e) => e.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};
describe('layoutEdgeOf', () => {
  it('runs a relationship from the referenced table, with the rows it links', () => {
    const out = layoutEdgeOf(edge('fk'), nodesById, context);
    expect(out).toMatchObject({ id: 'fk', source: 'users', target: 'orders' });
    expect(out.sourceY).toBeGreaterThan(0);
    expect(out.targetY).toBeGreaterThan(out.sourceY ?? Infinity);
  });

  it('keeps the direction of a one-to-many read from its first end', () => {
    const oneToMany = { ...edge('fk'), cardinality: '1-n' as const };
    expect(layoutEdgeOf(oneToMany, nodesById, context)).toMatchObject({
      source: 'orders',
      target: 'users',
    });
  });

  it('leaves a plain connector, or one drawn as something else, as it is', () => {
    expect(layoutEdgeOf(edge('plain'), nodesById, context)).toEqual({
      id: 'plain',
      source: 'api',
      target: 'users',
    });
    expect(layoutEdgeOf(edge('fk'), nodesById, context, 'collapsed:g', 'users')).toEqual({
      id: 'fk',
      source: 'collapsed:g',
      target: 'users',
    });
  });
});
