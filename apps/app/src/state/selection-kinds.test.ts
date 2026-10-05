import { schemaGroupId } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import {
  isSelectionEmpty,
  SELECTION_KINDS,
  selectionSize,
  selectionTargets,
} from './selection-kinds';
import { EMPTY_SELECTION } from './ui-store';

const every = {
  nodes: ['n'],
  edges: ['e'],
  groups: ['g'],
  stickies: ['s'],
  images: ['i'],
};

describe('selection kinds (one list of every selectable kind)', () => {
  it('lists every key of a selection', () => {
    expect([...SELECTION_KINDS].sort()).toEqual(Object.keys(EMPTY_SELECTION).sort());
  });

  it('turns every kind into removal targets, cards first and groups last', () => {
    expect(selectionTargets(every)).toEqual([
      { scope: 'nodes', id: 'n' },
      { scope: 'edges', id: 'e' },
      { scope: 'stickies', id: 's' },
      { scope: 'images', id: 'i' },
      { scope: 'groups', id: 'g' },
    ]);
  });

  it('never targets a derived schema frame: it stores nothing to delete', () => {
    expect(selectionTargets({ groups: [schemaGroupId('public'), 'g'] })).toEqual([
      { scope: 'groups', id: 'g' },
    ]);
  });

  it('counts every kind, and a group alone is not empty', () => {
    expect(selectionSize(every)).toBe(5);
    expect(selectionSize({ groups: ['g'] })).toBe(1);
    expect(isSelectionEmpty({ groups: ['g'] })).toBe(false);
    expect(isSelectionEmpty(EMPTY_SELECTION)).toBe(true);
    expect(isSelectionEmpty({})).toBe(true);
  });
});
