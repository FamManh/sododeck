import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { endpointOf, endpointTitle } from '../src';

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
  stickies: [
    { id: 'note', text: 'Why two queues?\nMore detail', position: { x: 0, y: 0 } },
    { id: 'blank', text: '', position: { x: 0, y: 0 } },
    { id: 'both', text: 'Sticky both', position: { x: 0, y: 0 } },
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

  it('names a sticky end by its label (053)', () => {
    expect(endpointOf(deck, 'note')).toEqual({ kind: 'sticky', title: 'Why two queues?' });
    expect(endpointTitle(deck, 'note')).toBe('Why two queues?');
  });

  it('gives an empty sticky the title "Empty note"', () => {
    expect(endpointTitle(deck, 'blank')).toBe('Empty note');
  });

  it('lets a card or a group win a collision with a sticky', () => {
    expect(endpointOf(deck, 'both')).toEqual({ kind: 'node', title: 'Card both' });
  });

  it('follows sticky text edits in a new deck value', () => {
    const edited = {
      ...deck,
      stickies: [{ id: 'note', text: 'Renamed', position: { x: 0, y: 0 } }],
    };
    expect(endpointTitle(edited, 'note')).toBe('Renamed');
    expect(endpointTitle(deck, 'note')).toBe('Why two queues?');
  });

  it('still reads a deck value without stickies', () => {
    expect(endpointOf({ nodes: deck.nodes, groups: deck.groups }, 'core')?.kind).toBe('group');
  });
});
