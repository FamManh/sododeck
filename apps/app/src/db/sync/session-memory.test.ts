import { emptySododeckFile, type Node } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  clearMemory,
  createSessionMemory,
  forget,
  memoryKey,
  recall,
  rememberTables,
} from './session-memory';

const table = (id: string, title: string, schema?: string): Node => ({
  id,
  type: 'db-table',
  title,
  ...(schema === undefined ? {} : { schema }),
  position: { x: 5, y: 6 },
  columns: [{ id: `${id}.c`, name: 'id', type: 'int' }],
});

const deck = {
  ...emptySododeckFile(),
  nodes: [table('a', 'Orders'), table('b', 'items', 'public'), table('c', 'x', 'billing')],
  edges: [
    { id: 'e1', from: 'a', to: 'b' },
    { id: 'e2', from: 'b', to: 'c' },
  ],
};

describe('session memory', () => {
  it('keys by lower-cased schema.name, ignoring public', () => {
    expect(memoryKey(table('a', ' Orders '))).toBe('orders');
    expect(memoryKey(table('b', 'items', 'public'))).toBe('items');
    expect(memoryKey(table('c', 'X', 'Billing'))).toBe('billing.x');
  });

  it('captures the node and every relationship touching it', () => {
    const memory = createSessionMemory();
    rememberTables(memory, deck, ['a', 'b']);
    expect(recall(memory, 'orders')?.node.position).toEqual({ x: 5, y: 6 });
    expect(recall(memory, 'orders')?.edges.map((e) => e.id)).toEqual(['e1']);
    expect(recall(memory, 'items')?.edges.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(recall(memory, 'x')).toBeUndefined();
  });

  it('copies, so later deck changes do not leak in', () => {
    const memory = createSessionMemory();
    rememberTables(memory, deck, ['a']);
    const first = deck.nodes[0];
    if (first === undefined) throw new Error('no node');
    first.title = 'changed';
    expect(recall(memory, 'orders')?.node.title).toBe('Orders');
    first.title = 'Orders';
  });

  it('forgets one table or all', () => {
    const memory = createSessionMemory();
    rememberTables(memory, deck, ['a', 'b']);
    forget(memory, 'orders');
    expect(recall(memory, 'orders')).toBeUndefined();
    clearMemory(memory);
    expect(memory.size).toBe(0);
  });
});
