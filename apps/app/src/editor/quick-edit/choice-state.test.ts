import type { Node } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { choiceState, deckValues, tagChoices } from './choice-state';

const node = (id: string, patch: Partial<Node> = {}): Node => ({
  id,
  type: 'service',
  title: id,
  ...patch,
});

const OPTIONS = [
  { value: 'service', label: 'Service' },
  { value: 'database', label: 'Database' },
];

describe('choiceState', () => {
  it('marks the shared value as selected', () => {
    expect(choiceState({ mixed: false, value: 'database' }, OPTIONS)).toEqual([
      { value: 'service', label: 'Service' },
      { value: 'database', label: 'Database', state: 'selected' },
    ]);
  });

  it('marks nothing when the values are mixed', () => {
    expect(choiceState({ mixed: true }, OPTIONS)).toEqual(OPTIONS);
  });
});

describe('tagChoices', () => {
  it('selects tags every component has, marks the others partial with "n of N"', () => {
    const nodes = [node('a', { tags: ['pci', 'core'] }), node('b', { tags: ['pci'] }), node('c')];
    expect(tagChoices(nodes, ['edge', 'pci'])).toEqual([
      { value: 'pci', label: 'pci', state: 'partial', count: '2 of 3' },
      { value: 'core', label: 'core', state: 'partial', count: '1 of 3' },
      { value: 'edge', label: 'edge' },
    ]);
    expect(tagChoices([node('a', { tags: ['pci'] })], [])).toEqual([
      { value: 'pci', label: 'pci', state: 'selected' },
    ]);
  });
});

describe('deckValues', () => {
  it('lists distinct owners or technologies, sorted case-insensitively', () => {
    const deck = deckOf({
      nodes: [
        node('a', { owner: 'payments', tech: 'Go' }),
        node('b', { owner: 'Checkout', tech: 'go' }),
        node('c', { owner: 'payments' }),
      ],
    });
    expect(deckValues(deck, 'owner')).toEqual(['Checkout', 'payments']);
    expect(deckValues(deck, 'tech')).toEqual(['Go', 'go']);
  });
});
