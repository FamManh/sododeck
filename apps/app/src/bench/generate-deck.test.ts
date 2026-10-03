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

  it('sizes every node and routes 200 edges with opposite sides (017 T003)', () => {
    const { deck } = generateBenchDeck(500, 1000, 42, { routes: true });
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(deck.nodes.every((node) => node.size?.width === 200 && node.size.height === 72)).toBe(
      true,
    );
    const routed = deck.edges.filter((edge) => edge.route !== undefined);
    expect(routed).toHaveLength(200);
    for (const edge of routed) {
      expect(['right', 'bottom']).toContain(edge.route?.fromSide);
      expect(['left', 'top']).toContain(edge.route?.toSide);
      expect(Math.abs(edge.route?.offset ?? 0)).toBe(40);
    }
    expect(deck.edges.slice(200).every((edge) => edge.route === undefined)).toBe(true);
    expect(generateBenchDeck(500, 1000, 42, { routes: true })).toEqual({ deck });
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

  it('adds a fill to every node and a blue stroke to every 5th, cycling the 15 colours (020)', () => {
    const { deck } = generateBenchDeck(40, 80, 42, { colours: true });
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(deck.nodes.every((node) => node.style?.fill !== undefined)).toBe(true);
    const strokeCount = deck.nodes.filter((node) => node.style?.stroke === 'blue').length;
    expect(strokeCount).toBe(8);
    expect(new Set(deck.nodes.map((node) => node.style?.fill)).size).toBe(15);
    expect(generateBenchDeck(40, 80, 42, { colours: true })).toEqual(
      generateBenchDeck(40, 80, 42, { colours: true }),
    );
  });

  it('gives a third of the connectors each line type (029)', () => {
    const { deck } = generateBenchDeck(40, 90, 42, { lineTypes: true });
    expect(parseSododeckFile(deck).success).toBe(true);
    const count = (shape: string) => deck.edges.filter((e) => e.style?.shape === shape).length;
    expect([count('curved'), count('elbow'), count('straight')]).toEqual([30, 30, 30]);
    expect(generateBenchDeck(40, 90, 42).deck.edges.every((e) => e.style === undefined)).toBe(true);
  });

  it('gives every card 3 to 10 distinct tags from a pool of 24 (033)', () => {
    const { deck } = generateBenchDeck(40, 80, 42, { tags: true });
    expect(parseSododeckFile(deck).success).toBe(true);
    for (const node of deck.nodes) {
      const keys = (node.tags ?? []).map((tag) => tag.toLowerCase());
      expect(keys.length).toBeGreaterThanOrEqual(3);
      expect(keys.length).toBeLessThanOrEqual(10);
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(generateBenchDeck(40, 80, 42).deck.nodes.every((n) => n.tags === undefined)).toBe(true);
    expect(generateBenchDeck(40, 80, 42, { tags: true }).deck.edges).toEqual(
      generateBenchDeck(40, 80, 42).deck.edges,
    );
  });
});
