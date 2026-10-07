import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { reconcileOrder } from '../src/apply-lists';
import { appendAll, orderedIds, ORDER_KEY, type ListMap } from '../src/layout';
import { createObject } from '../src/write';

/** A list of plain items `ids` in a fresh doc, and a counter of `$order` writes on kept items. */
function setup(ids: readonly string[]) {
  const doc = new Y.Doc();
  const list = doc.getMap('list') as unknown as ListMap;
  doc.transact(() => {
    appendAll(
      list,
      ids.map((id) => [id, createObject('nodes', { id, type: 'service', title: id }, '')] as const),
    );
  });
  const writes: string[] = [];
  list.observeDeep((events) => {
    for (const event of events) {
      if (event.target === list) continue;
      if ((event as Y.YMapEvent<unknown>).keysChanged.has(ORDER_KEY)) {
        writes.push(String(event.path[0]));
      }
    }
  });
  const run = (target: readonly string[], onUpdate: string[] = [], onCreate: string[] = []) =>
    doc.transact(() =>
      reconcileOrder(
        list,
        target,
        (id, key) => {
          onCreate.push(id);
          return createObject('nodes', { id, type: 'service', title: id }, key);
        },
        (id) => {
          onUpdate.push(id);
        },
      ),
    );
  return { doc, list, writes, run };
}

describe('reconcileOrder (066 R3)', () => {
  it('writes no order key when the order is the same', () => {
    const { list, writes, run } = setup(['a', 'b', 'c', 'd']);
    const result = run(['a', 'b', 'c', 'd']);
    expect(writes).toEqual([]);
    expect(result.moved).toEqual([]);
    expect(orderedIds(list)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('writes exactly one order key when one item moved', () => {
    const { list, writes, run } = setup(['a', 'b', 'c', 'd', 'e']);
    const result = run(['a', 'd', 'b', 'c', 'e']);
    expect(writes).toEqual(['d']);
    expect(result.moved).toEqual(['d']);
    expect(orderedIds(list)).toEqual(['a', 'd', 'b', 'c', 'e']);
  });

  it('reverses five items with four writes (the longest run keeps one)', () => {
    const { list, writes, run } = setup(['a', 'b', 'c', 'd', 'e']);
    run(['e', 'd', 'c', 'b', 'a']);
    expect(writes).toHaveLength(4);
    expect(orderedIds(list)).toEqual(['e', 'd', 'c', 'b', 'a']);
  });

  it('deletes absent ids and creates new ones at their target position', () => {
    const { list, writes, run } = setup(['a', 'b', 'c']);
    const created: string[] = [];
    const result = run(['x', 'a', 'y', 'c', 'z'], [], created);
    expect(orderedIds(list)).toEqual(['x', 'a', 'y', 'c', 'z']);
    expect(created).toEqual(['x', 'y', 'z']);
    expect(result).toEqual({ added: ['x', 'y', 'z'], removed: ['b'], moved: [] });
    expect(writes).toEqual([]);
  });

  it('ends in the target order with tied and malformed keys (re-key fallback)', () => {
    const { doc, list, run } = setup(['a', 'b', 'c', 'd']);
    doc.transact(() => {
      list.get('a')?.set(ORDER_KEY, 'a0');
      list.get('b')?.set(ORDER_KEY, 'a0');
      list.get('c')?.set(ORDER_KEY, '!!');
    });
    run(['b', 'n', 'a', 'd', 'c']);
    expect(orderedIds(list)).toEqual(['b', 'n', 'a', 'd', 'c']);
    run(['c', 'a', 'b', 'd', 'n']);
    expect(orderedIds(list)).toEqual(['c', 'a', 'b', 'd', 'n']);
  });

  it('calls update for every kept id and create for every new one', () => {
    const { run } = setup(['a', 'b', 'c']);
    const updated: string[] = [];
    const created: string[] = [];
    run(['c', 'q', 'a'], updated, created);
    expect(updated.sort()).toEqual(['a', 'c']);
    expect(created).toEqual(['q']);
  });

  it('keeps the stored map of every kept item', () => {
    const { list, run } = setup(['a', 'b', 'c']);
    const before = list.get('b');
    run(['c', 'b', 'a']);
    expect(list.get('b')).toBe(before);
  });
});
