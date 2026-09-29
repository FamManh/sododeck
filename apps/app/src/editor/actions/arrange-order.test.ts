import { describe, expect, it } from 'vitest';

import { arrangeOrder, reorderSteps } from './arrange-order';

describe('arrangeOrder', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];

  it('brings the moved ids to the front (end of the list), keeping their order', () => {
    expect(arrangeOrder(ids, ['d', 'b'], 'front')).toEqual(['a', 'c', 'e', 'b', 'd']);
  });

  it('sends the moved ids to the back (start of the list), keeping their order', () => {
    expect(arrangeOrder(ids, ['d', 'b'], 'back')).toEqual(['b', 'd', 'a', 'c', 'e']);
  });

  it('ignores unknown ids and leaves an arranged list as it is', () => {
    expect(arrangeOrder(ids, ['x'], 'front')).toEqual(ids);
    expect(arrangeOrder(ids, ['e'], 'front')).toEqual(ids);
  });
});

describe('reorderSteps', () => {
  it('lists the moves that turn one order into the other', () => {
    const from = ['a', 'b', 'c', 'd'];
    const to = ['a', 'c', 'd', 'b'];
    const steps = reorderSteps(from, to);
    const result = [...from];
    for (const { id, index } of steps) {
      result.splice(result.indexOf(id), 1);
      result.splice(index, 0, id);
    }
    expect(result).toEqual(to);
    expect(reorderSteps(from, from)).toEqual([]);
  });
});
