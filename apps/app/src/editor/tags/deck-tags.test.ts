import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { canonicalTag, deckTags, tagSpellings, tagUsage } from './deck-tags';

function deck(partial: Partial<SododeckFile>): SododeckFile {
  return { ...emptySododeckFile(), ...partial };
}

const node = (id: string, tags?: string[]) => ({
  id,
  type: 'service' as const,
  title: id,
  ...(tags ? { tags } : {}),
});

const sticky = (id: string, tags?: string[]) => ({
  id,
  text: id,
  position: { x: 0, y: 0 },
  ...(tags ? { tags } : {}),
});

describe('deckTags', () => {
  it('counts cards only and merges spellings by key', () => {
    const file = deck({
      nodes: [node('a', ['PCI', 'Lan']), node('b', ['pci']), node('c', ['lan', 'edge'])],
      edges: [{ id: 'e', from: 'a', to: 'b', tags: ['only-on-edge'] }],
      flows: [{ id: 'f', title: 'F', tags: ['only-on-flow'], steps: [] }],
    });
    expect(deckTags(file)).toEqual([
      { tag: 'Lan', key: 'lan', count: 2 },
      { tag: 'PCI', key: 'pci', count: 2 },
      { tag: 'edge', key: 'edge', count: 1 },
    ]);
  });

  it('uses the colour key as the display spelling, else the first spelling in card order', () => {
    const file = deck({
      tagColors: { PCI: 'violet' },
      nodes: [node('a', ['pci', 'lan']), node('b', ['Lan']), node('c', ['PCI'])],
    });
    expect(deckTags(file)).toEqual([
      { tag: 'lan', key: 'lan', count: 2 },
      { tag: 'PCI', key: 'pci', count: 2, color: 'violet' },
    ]);
  });

  it('sorts by count, then by name ignoring case', () => {
    const file = deck({
      nodes: [node('a', ['b', 'C']), node('b', ['A', 'C']), node('c', ['c', 'd'])],
    });
    expect(deckTags(file).map((t) => [t.tag, t.count])).toEqual([
      ['C', 3],
      ['A', 1],
      ['b', 1],
      ['d', 1],
    ]);
  });

  it('lists a coloured tag with no card, with a count of 0, after the used ones', () => {
    const file = deck({ tagColors: { Orphan: '#7a3cff' }, nodes: [node('a', ['x'])] });
    expect(deckTags(file)).toEqual([
      { tag: 'x', key: 'x', count: 1 },
      { tag: 'Orphan', key: 'orphan', count: 0, color: '#7a3cff' },
    ]);
  });

  it('counts a card once even when it holds two spellings of one tag', () => {
    const file = deck({ nodes: [node('a', ['pci', 'PCI'])] });
    expect(deckTags(file)).toEqual([{ tag: 'pci', key: 'pci', count: 1 }]);
  });

  it('returns nothing for a deck without tags', () => {
    expect(deckTags(deck({}))).toEqual([]);
  });

  it('does not write anything: a deck holding "pci" and "PCI" lists one tag (US3)', () => {
    const file = deck({ nodes: [node('a', ['pci']), node('b', ['PCI'])] });
    const before = JSON.stringify(file);
    expect(deckTags(file)).toEqual([{ tag: 'pci', key: 'pci', count: 2 }]);
    expect(JSON.stringify(file)).toBe(before);
  });
});

describe('tagUsage', () => {
  it('counts every kind of carrier by key', () => {
    const file = deck({
      tags: ['Pci'],
      nodes: [node('a', ['PCI']), node('b', ['pci', 'x']), node('c', ['x'])],
      edges: [
        { id: 'e1', from: 'a', to: 'b', tags: ['pci'] },
        { id: 'e2', from: 'a', to: 'c' },
      ],
      flows: [
        {
          id: 'f',
          title: 'F',
          tags: ['PCI'],
          steps: [
            { id: 's1', edge: 'e1', tags: ['pci'] },
            { id: 's2', edge: 'e1', tags: ['pci'] },
            { id: 's3', edge: 'e1' },
          ],
        },
      ],
    });
    expect(tagUsage(file, 'pci')).toEqual({
      cards: 2,
      connections: 1,
      flows: 1,
      steps: 2,
      deckTag: true,
      notes: 0,
    });
    expect(tagUsage(file, 'nothing')).toEqual({
      cards: 0,
      connections: 0,
      flows: 0,
      steps: 0,
      deckTag: false,
      notes: 0,
    });
  });

  it('counts notes (053)', () => {
    const file = deck({
      nodes: [node('a', ['PCI'])],
      stickies: [sticky('n1', ['pci']), sticky('n2', ['Pci', 'x']), sticky('n3')],
    });
    expect(tagUsage(file, 'pci')).toMatchObject({ cards: 1, notes: 2 });
  });
});

describe('notes as tag carriers (053)', () => {
  it('counts notes in deckTags and lists tags only notes carry', () => {
    const file = deck({
      nodes: [node('a', ['PCI'])],
      stickies: [sticky('n1', ['pci', 'only-note']), sticky('n2', ['PCI'])],
    });
    expect(deckTags(file).map((t) => [t.tag, t.count])).toEqual([
      ['PCI', 3],
      ['only-note', 1],
    ]);
  });

  it('takes the first spelling from a note when no card has one', () => {
    const file = deck({ stickies: [sticky('n1', ['  Edge   Case '])] });
    expect(tagSpellings(file).get('edge case')).toBe('Edge Case');
    expect(canonicalTag(file, 'EDGE case')).toBe('Edge Case');
  });
});

describe('canonicalTag', () => {
  const file = deck({
    tagColors: { Core: 'blue' },
    tags: ['DeckOnly'],
    nodes: [node('a', ['PCI'])],
    edges: [{ id: 'e', from: 'a', to: 'a', tags: ['EdgeOnly'] }],
    flows: [
      {
        id: 'f',
        title: 'F',
        tags: ['FlowOnly'],
        steps: [{ id: 's', edge: 'e', tags: ['StepOnly'] }],
      },
    ],
  });

  it('returns the existing spelling when the key exists', () => {
    expect(canonicalTag(file, 'pci')).toBe('PCI');
    expect(canonicalTag(file, '  pCi ')).toBe('PCI');
    expect(canonicalTag(file, 'edgeonly')).toBe('EdgeOnly');
    expect(canonicalTag(file, 'FLOWONLY')).toBe('FlowOnly');
    expect(canonicalTag(file, 'steponly')).toBe('StepOnly');
    expect(canonicalTag(file, 'deckonly')).toBe('DeckOnly');
  });

  it('prefers the colour key, then a card spelling, then the other objects', () => {
    const mixed = deck({
      tagColors: { Core: 'blue' },
      nodes: [node('a', ['core', 'lan'])],
      edges: [{ id: 'e', from: 'a', to: 'a', tags: ['LAN'] }],
    });
    expect(canonicalTag(mixed, 'CORE')).toBe('Core');
    expect(canonicalTag(mixed, 'Lan')).toBe('lan');
  });

  it('trims and single-spaces new text and keeps its case', () => {
    expect(canonicalTag(file, '  New   Tag ')).toBe('New Tag');
  });

  it('gives null for empty text', () => {
    expect(canonicalTag(file, '')).toBeNull();
    expect(canonicalTag(file, '   ')).toBeNull();
  });
});
