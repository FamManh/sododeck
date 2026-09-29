import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { membershipChanges } from './membership-changes';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', group: 'pay' },
    { id: 'b', type: 'service', title: 'B' },
    { id: 'm', type: 'service', title: 'Member', group: 'inner' },
  ],
  groups: [
    { id: 'pay', title: 'Payments' },
    { id: 'shop', title: 'Shop' },
    { id: 'inner', title: 'Inner', parent: 'shop' },
  ],
});

describe('membershipChanges (016 R6, FR-018–020)', () => {
  it('moves each dragged top-level item into the target', () => {
    expect(
      membershipChanges(
        deck,
        { nodes: ['a', 'b'], groups: [] },
        { target: 'shop', scope: undefined, keep: false },
      ),
    ).toEqual([
      { kind: 'node', id: 'a', from: 'pay', to: 'shop' },
      { kind: 'node', id: 'b', from: undefined, to: 'shop' },
    ]);
  });

  it('falls back to the drill scope, then to none (leaving the group)', () => {
    expect(
      membershipChanges(
        deck,
        { nodes: ['a'], groups: [] },
        { target: null, scope: 'shop', keep: false },
      ),
    ).toEqual([{ kind: 'node', id: 'a', from: 'pay', to: 'shop' }]);
    expect(
      membershipChanges(
        deck,
        { nodes: ['a'], groups: [] },
        { target: null, scope: undefined, keep: false },
      ),
    ).toEqual([{ kind: 'node', id: 'a', from: 'pay', to: undefined }]);
  });

  it('changes nothing when the target is the current group, or with ⌥', () => {
    expect(
      membershipChanges(
        deck,
        { nodes: ['a'], groups: [] },
        { target: 'pay', scope: undefined, keep: false },
      ),
    ).toEqual([]);
    expect(
      membershipChanges(
        deck,
        { nodes: ['a', 'b'], groups: [] },
        { target: 'shop', scope: undefined, keep: true },
      ),
    ).toEqual([]);
  });

  it('nests a dragged group and leaves its members untouched', () => {
    expect(
      membershipChanges(
        deck,
        { nodes: ['m'], groups: ['inner'] },
        { target: 'pay', scope: undefined, keep: false },
      ),
    ).toEqual([{ kind: 'group', id: 'inner', from: 'shop', to: 'pay' }]);
  });

  it('never nests a group into itself or a descendant', () => {
    expect(
      membershipChanges(
        deck,
        { nodes: [], groups: ['shop'] },
        { target: 'inner', scope: undefined, keep: false },
      ),
    ).toEqual([]);
    expect(
      membershipChanges(
        deck,
        { nodes: [], groups: ['shop'] },
        { target: 'shop', scope: undefined, keep: false },
      ),
    ).toEqual([]);
  });
});
