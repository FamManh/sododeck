import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { endpointOf } from '../src';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'web', type: 'client', title: 'Web' },
    { id: 'both', type: 'service', title: 'Card both' },
  ],
  groups: [
    { id: 'core', title: 'Core' },
    { id: 'both', title: 'Group both' },
  ],
};

describe('endpointOf (050)', () => {
  it('names a card end', () => {
    expect(endpointOf(deck, 'web')).toEqual({ kind: 'node', title: 'Web' });
  });

  it('names a group end', () => {
    expect(endpointOf(deck, 'core')).toEqual({ kind: 'group', title: 'Core' });
  });

  it('returns null for an id that names neither', () => {
    expect(endpointOf(deck, 'gone')).toBeNull();
  });

  it('reads a card when a hand-edited file gives a card and a group one id', () => {
    // Integrity reports the collision; until it is fixed, the edge keeps its pre-050 meaning.
    expect(endpointOf(deck, 'both')).toEqual({ kind: 'node', title: 'Card both' });
  });

  it('follows renames in a new deck value', () => {
    const renamed = { ...deck, groups: [{ id: 'core', title: 'Core services' }] };
    expect(endpointOf(deck, 'core')?.title).toBe('Core');
    expect(endpointOf(renamed, 'core')?.title).toBe('Core services');
  });
});
