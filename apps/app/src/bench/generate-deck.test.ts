import { analyzeFlow } from '@sododeck/model';
import { parseSododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { generateBenchDeck } from './generate-deck';

describe('generateBenchDeck', () => {
  it('generates a valid deck of the requested size', () => {
    const { deck } = generateBenchDeck(500, 1000);
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(deck.nodes).toHaveLength(500);
    expect(deck.edges).toHaveLength(1000);
    for (const node of deck.nodes) {
      expect(Number.isInteger(node.position?.x)).toBe(true);
      expect(Number.isInteger(node.position?.y)).toBe(true);
    }
  });

  it('has no self-loops or duplicate edges', () => {
    const { deck } = generateBenchDeck(50, 200);
    const keys = deck.edges.map((e) => [e.from, e.to].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(deck.edges.every((e) => e.from !== e.to)).toBe(true);
  });

  it('adds four views with Infra overrides for half the nodes and 20 pins (011)', () => {
    const { deck } = generateBenchDeck(500, 1000, 42, { views: true });
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(deck.views.map((v) => v.id)).toEqual(['system', 'feature', 'infra', 'custom']);
    const infra = deck.views[2];
    expect(Object.keys(infra?.positions ?? {})).toHaveLength(250);
    expect(infra?.pinned).toHaveLength(20);
    expect(deck.views[3]?.excludeKinds).toEqual(['external']);
    expect(generateBenchDeck(500, 1000, 42, { views: true })).toEqual({ deck });
  });

  it('is deterministic', () => {
    expect(generateBenchDeck(20, 30)).toEqual(generateBenchDeck(20, 30));
  });

  it('adds seeded stickies, half pinned and half free', () => {
    const { deck } = generateBenchDeck(40, 80, 42, { stickies: 10 });
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(deck.stickies).toHaveLength(10);
    expect(deck.stickies.filter((sticky) => sticky.anchor != null)).toHaveLength(5);
    expect(deck.stickies.filter((sticky) => sticky.anchor == null)).toHaveLength(5);
    expect(deck.stickies.every((sticky) => sticky.text.length > 0)).toBe(true);
    expect(deck.stickies.every((sticky) => sticky.anchor != null || sticky.position != null)).toBe(
      true,
    );
    expect(generateBenchDeck(40, 80, 42, { stickies: 10 })).toEqual(
      generateBenchDeck(40, 80, 42, { stickies: 10 }),
    );
  });

  it('adds valid, contiguous flows and one fork in flows mode (006)', () => {
    const { deck } = generateBenchDeck(500, 1000, 42, { flows: true });
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(deck.features).toHaveLength(5);
    expect(deck.flows).toHaveLength(21);
    const tenSteps = deck.flows.filter((f) => f.steps.length === 10).length;
    expect(tenSteps).toBeGreaterThanOrEqual(18);
    for (const flow of deck.flows) {
      const analysis = analyzeFlow(flow, deck.edges);
      expect(analysis.problems.filter((p) => p.kind === 'chain-break')).toEqual([]);
    }
    expect(deck.flows.at(-1)?.branches).toHaveLength(2);
  });

  it('adds deterministic benchmark groups', () => {
    const { deck } = generateBenchDeck(500, 1000, 42, { groups: true });
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(deck.groups).toHaveLength(30);

    const groups = deck.groups.filter((group) => group.id.startsWith('g'));
    const parents = deck.groups.filter((group) => group.id.startsWith('p'));
    expect(groups).toHaveLength(25);
    expect(parents).toHaveLength(5);

    for (let index = 0; index < groups.length; index++) {
      const group = groups[index];
      if (group === undefined) throw new Error('missing group fixture');
      expect(group).toMatchObject({
        id: `g${String(index)}`,
        title: `Group ${String(index)}`,
        parent: `p${String(Math.floor(index / 5))}`,
      });

      const members = deck.nodes.filter((node) => node.group === group.id);
      expect(members).toHaveLength(20);
      expect(members.map((node) => node.id)).toEqual(
        Array.from({ length: 20 }, (_, offset) => `n${String(index * 20 + offset)}`),
      );
    }

    expect(parents).toEqual(
      Array.from({ length: 5 }, (_, index) => ({
        id: `p${String(index)}`,
        title: `Parent group ${String(index)}`,
      })),
    );
    expect(generateBenchDeck(500, 1000, 42, { groups: true })).toEqual(
      generateBenchDeck(500, 1000, 42, { groups: true }),
    );
  });
});
