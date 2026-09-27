import { parseSododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { generateBenchDeck } from './generate-deck';

describe('generateBenchDeck', () => {
  it('generates a valid deck of the requested size', () => {
    const { deck, positions } = generateBenchDeck(500, 1000);
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(deck.nodes).toHaveLength(500);
    expect(deck.edges).toHaveLength(1000);
    expect(Object.keys(positions)).toHaveLength(500);
  });

  it('has no self-loops or duplicate edges', () => {
    const { deck } = generateBenchDeck(50, 200);
    const keys = deck.edges.map((e) => [e.from, e.to].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(deck.edges.every((e) => e.from !== e.to)).toBe(true);
  });

  it('is deterministic', () => {
    expect(generateBenchDeck(20, 30)).toEqual(generateBenchDeck(20, 30));
  });
});
