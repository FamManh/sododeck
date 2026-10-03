import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { generateBenchDeck } from '../bench/generate-deck';
import { summarizeDeck } from './deck-summary';

const deck = (patch: Partial<SododeckFile>): SododeckFile => ({ ...emptySododeckFile(), ...patch });

describe('summarizeDeck', () => {
  it('has no thumbnail and a default name for an empty deck', () => {
    expect(summarizeDeck(emptySododeckFile())).toEqual({
      name: 'Untitled deck',
      nodeCount: 0,
      edgeCount: 0,
      flowCount: 0,
      thumb: null,
    });
  });

  it('normalizes node corners to a 0–1000 box keeping the aspect ratio', () => {
    const summary = summarizeDeck(
      deck({
        name: 'Shop',
        nodes: [
          { id: 'a', type: 'service', title: 'A', position: { x: 100, y: 100 } },
          { id: 'b', type: 'database', title: 'B', position: { x: 916, y: 400 } },
        ],
      }),
    );
    // Box: x 100..1100 (1000 wide), y 100..476 (376 high) → scale 1.
    expect(summary.name).toBe('Shop');
    expect(summary.nodeCount).toBe(2);
    expect(summary.thumb).toEqual({
      w: 1000,
      h: 376,
      node: [184, 76],
      nodes: [
        [0, 0, 'service'],
        [816, 300, 'database'],
      ],
      groups: [],
    });
  });

  it('adds groups from their members like the canvas does', () => {
    const summary = summarizeDeck(
      deck({
        nodes: [{ id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 }, group: 'g' }],
        groups: [{ id: 'g', title: 'G' }],
      }),
    );
    const thumb = summary.thumb;
    expect(thumb?.groups).toHaveLength(1);
    // Group padding (24) around the one node: the group is the whole box.
    expect(thumb?.groups[0]).toEqual([0, 0, thumb?.w, thumb?.h]);
    expect(thumb?.w).toBe(1000);
  });

  it('carries a resized card’s own size so the thumbnail matches the canvas (017 R13)', () => {
    const summary = summarizeDeck(
      deck({
        nodes: [
          {
            id: 'a',
            type: 'service',
            title: 'A',
            position: { x: 0, y: 0 },
            size: { width: 300, height: 100 },
          },
          { id: 'b', type: 'database', title: 'B', position: { x: 816, y: 0 } },
        ],
      }),
    );
    // Box: x 0..1000 (816 + default width 184), scale 1.
    expect(summary.thumb?.nodes[0]).toEqual([0, 0, 'service', 300, 100]);
    expect(summary.thumb?.nodes[1]).toEqual([816, 0, 'database']);
  });

  it('counts edges and flows and keeps at most maxNodes shapes', () => {
    const bench = generateBenchDeck(500, 1000).deck;
    const summary = summarizeDeck(bench);
    expect(summary.nodeCount).toBe(500);
    expect(summary.edgeCount).toBe(1000);
    expect(summary.thumb?.nodes).toHaveLength(150);
    expect(summarizeDeck(bench, { maxNodes: 10 }).thumb?.nodes).toHaveLength(10);
  });

  it('summarizes the 500-node bench deck in under 5 ms', () => {
    const bench = generateBenchDeck(500, 1000).deck;
    summarizeDeck(bench); // warm-up (JIT)
    const start = performance.now();
    for (let i = 0; i < 10; i++) summarizeDeck(bench);
    expect((performance.now() - start) / 10).toBeLessThan(5);
  });
});
