import {
  analyzeFlow,
  checkDeck,
  fieldsOfType,
  hasValue,
  SHAPE_TYPE_IDS,
  valueOf,
} from '@sododeck/model';
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

  it('adds seeded free stickies, half in a grid and half next to cards', () => {
    const { deck } = generateBenchDeck(40, 80, 42, { stickies: 10 });
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(deck.stickies).toHaveLength(10);
    expect(deck.stickies.every((sticky) => sticky.anchor === undefined)).toBe(true);
    expect(deck.stickies.every((sticky) => sticky.text.length > 0)).toBe(true);
    expect(deck.stickies.every((sticky) => sticky.position !== undefined)).toBe(true);
    // Free notes are connector ends too (053): to a card, and to the next free note.
    const noteIds = new Set(deck.stickies.map((sticky) => sticky.id));
    const noteEdges = deck.edges.filter((edge) => noteIds.has(edge.from));
    expect(noteEdges.length).toBeGreaterThan(0);
    expect(noteEdges.some((edge) => noteIds.has(edge.to))).toBe(true);
    expect(noteEdges.some((edge) => deck.nodes.some((node) => node.id === edge.to))).toBe(true);
    expect(deck.stickies.some((sticky) => (sticky.tags?.length ?? 0) > 0)).toBe(true);
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

  it('cycles every card type with every pack on, and changes nothing else (030)', () => {
    const { deck } = generateBenchDeck(40, 80, 42, { types: true });
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(new Set(deck.nodes.map((n) => n.type)).size).toBe(14);
    expect(deck.packs).toEqual([
      'architecture',
      'process',
      'logistics',
      'data',
      'database',
      'shapes',
    ]);
    expect(generateBenchDeck(40, 80, 42).deck.packs).toBeUndefined();
    expect(generateBenchDeck(40, 80, 42, { types: true }).deck.edges).toEqual(
      generateBenchDeck(40, 80, 42).deck.edges,
    );
  });
});

describe('generateBenchDeck 032 fields', () => {
  it('cycles Task / Warehouse / Issue with four on-card values each, valid and clean', () => {
    const { deck } = generateBenchDeck(30, 60, 42, { fields: true });
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(new Set(deck.nodes.map((n) => n.type))).toEqual(
      new Set(['task', 'warehouse', 'issue', 'client']),
    );
    for (const node of deck.nodes.filter((n) => n.type !== 'client')) {
      const onCard = fieldsOfType(deck, node.type).filter(
        (f) => f.onCard === true && hasValue(valueOf(node, f.id)),
      );
      expect(onCard.length).toBeGreaterThanOrEqual(4);
    }
    expect(checkDeck(deck).total).toBe(0);
    expect(generateBenchDeck(30, 60, 42, { fields: true }).deck.edges).toEqual(
      generateBenchDeck(30, 60, 42).deck.edges,
    );
  });
});

describe('generateBenchDeck 022 options', () => {
  it('animates 200 connectors, half of them dashed', () => {
    const { deck } = generateBenchDeck(300, 600, 42, { animated: true });
    expect(parseSododeckFile(deck).success).toBe(true);
    const animated = deck.edges.filter((e) => e.style?.animated === true);
    expect(animated).toHaveLength(200);
    expect(animated.filter((e) => e.style?.dash === 'dashed')).toHaveLength(100);
  });

  it('gives 200 connectors three bends each in mixed shapes', () => {
    const { deck } = generateBenchDeck(300, 600, 42, { bends: true });
    expect(parseSododeckFile(deck).success).toBe(true);
    const bent = deck.edges.filter((e) => e.route?.waypoints?.length === 3);
    expect(bent).toHaveLength(200);
    expect(new Set(bent.map((e) => e.style?.shape)).size).toBe(3);
    expect(generateBenchDeck(300, 600, 42).deck.edges.every((e) => e.route === undefined)).toBe(
      true,
    );
  });
});

describe('generateBenchDeck shapes option (031)', () => {
  it('makes every third node a shape, cycling the eleven geometries, every pack on', () => {
    const { deck } = generateBenchDeck(500, 1000, 42, { shapes: true });
    expect(parseSododeckFile(deck).success).toBe(true);
    const shapes = deck.nodes.filter((n) => SHAPE_TYPE_IDS.includes(n.type));
    expect(shapes).toHaveLength(167);
    expect(new Set(shapes.map((n) => n.type)).size).toBe(11);
    expect(deck.packs).toContain('shapes');
    expect(generateBenchDeck(500, 1000, 42, { shapes: true }).deck.edges).toEqual(
      generateBenchDeck(500, 1000, 42).deck.edges,
    );
  });
});

describe('generateBenchDeck 041 tables', () => {
  it('turns the first n nodes into 12-column tables with foreign keys and one enum', () => {
    const { deck } = generateBenchDeck(150, 300, 42, { tables: 150 });
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(deck.nodes.every((n) => n.type === 'db-table' && n.columns?.length === 12)).toBe(true);
    const first = deck.nodes[0];
    expect(first?.columns?.filter((c) => c.pk === true)).toHaveLength(1);
    expect(first?.columns?.filter((c) => c.enumRef === 'bench-status')).toHaveLength(1);
    expect(deck.enums?.map((e) => e.id)).toEqual(['bench-status']);
    const relationships = deck.edges.filter((e) => e.cardinality === 'n-1');
    expect(relationships.length).toBeGreaterThan(100);
    const byTable = new Map<string, number>();
    for (const e of relationships) byTable.set(e.from, (byTable.get(e.from) ?? 0) + 1);
    expect(Math.max(...byTable.values())).toBeLessThanOrEqual(2);
  });

  it('keeps the other nodes as cards when n is smaller', () => {
    const { deck } = generateBenchDeck(20, 30, 42, { tables: 5 });
    expect(deck.nodes.filter((n) => n.type === 'db-table')).toHaveLength(5);
    expect(deck.edges.length).toBe(generateBenchDeck(20, 30, 42).deck.edges.length);
  });
});

describe('generateBenchDeck 042 rel', () => {
  const REL = { tables: 150, rel: true } as const;

  it('gives every table-to-table edge column ends on real FK / PK columns, n-1, from optional', () => {
    const { deck } = generateBenchDeck(500, 1000, 42, REL);
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(deck.edges).toHaveLength(1000);
    const tables = new Set(deck.nodes.filter((n) => n.type === 'db-table').map((n) => n.id));
    const columnsOf = new Map(
      deck.nodes.map((n) => [n.id, new Map((n.columns ?? []).map((c) => [c.id, c]))]),
    );
    const relationships = deck.edges.filter((e) => tables.has(e.from) && tables.has(e.to));
    expect(relationships.length).toBeGreaterThanOrEqual(180);
    expect(relationships.length).toBeLessThanOrEqual(240);
    for (const edge of relationships) {
      expect(edge.cardinality).toBe('n-1');
      expect(edge.fromOptional).toBe(true);
      expect(edge.fromColumns).toHaveLength(1);
      expect(edge.toColumns).toEqual([`${edge.to}-id`]);
      const fk = columnsOf.get(edge.from)?.get(edge.fromColumns?.[0] ?? '');
      expect(fk?.name).toMatch(/_id$/);
      expect(columnsOf.get(edge.to)?.get(`${edge.to}-id`)?.pk).toBe(true);
    }
    expect(checkDeck(deck).list.filter((p) => p.kind.startsWith('db-'))).toEqual([]);
  });

  it('includes 5 self-references and 5 pairs of tables joined twice on different FK columns', () => {
    const { deck } = generateBenchDeck(500, 1000, 42, REL);
    const loops = deck.edges.filter((e) => e.from === e.to);
    expect(loops).toHaveLength(5);
    expect(new Set(loops.map((e) => e.from)).size).toBe(5);
    for (const loop of loops) {
      expect(loop.fromColumns).toEqual([`${loop.from}-fk1`]);
      expect(loop.toColumns).toEqual([`${loop.from}-id`]);
    }
    const byPair = new Map<string, typeof deck.edges>();
    for (const edge of deck.edges) {
      if (edge.from === edge.to) continue;
      const key = [edge.from, edge.to].sort().join('|');
      byPair.set(key, [...(byPair.get(key) ?? []), edge]);
    }
    const doubled = [...byPair.values()].filter((group) => group.length > 1);
    expect(doubled).toHaveLength(5);
    for (const group of doubled) {
      expect(group).toHaveLength(2);
      expect(new Set(group.map((e) => `${e.from}>${e.to}`)).size).toBe(1);
      expect(new Set(group.map((e) => e.fromColumns?.[0])).size).toBe(2);
    }
  });

  it('leaves the deck exactly as before without rel, and does nothing without tables', () => {
    const plain = generateBenchDeck(500, 1000, 42, { tables: 150 }).deck;
    expect(generateBenchDeck(500, 1000, 42, { tables: 150, rel: false }).deck).toEqual(plain);
    expect(plain.edges.some((e) => e.fromOptional !== undefined || e.from === e.to)).toBe(false);
    expect(generateBenchDeck(50, 100, 42, { rel: true }).deck).toEqual(
      generateBenchDeck(50, 100, 42).deck,
    );
  });

  it('keeps the nodes and the edge ids of the plain tables deck', () => {
    const plain = generateBenchDeck(500, 1000, 42, { tables: 150 }).deck;
    const rel = generateBenchDeck(500, 1000, 42, REL).deck;
    expect(rel.nodes).toEqual(plain.nodes);
    expect(rel.edges.map((e) => e.id)).toEqual(plain.edges.map((e) => e.id));
  });
});

describe('generateBenchDeck 048 wide and schemas', () => {
  const SCALE = { tables: 150, rel: true, wide: true, schemas: 3 } as const;

  it('gives every 10th table 60 columns and keeps the others at 12', () => {
    const { deck } = generateBenchDeck(150, 250, 42, SCALE);
    expect(parseSododeckFile(deck).success).toBe(true);
    deck.nodes.forEach((n, i) => {
      expect(n.columns).toHaveLength(i % 10 === 0 ? 60 : 12);
    });
    // The foreign keys of a wide table are still its first columns, so relationships resolve.
    const wide = deck.nodes[0];
    expect(wide?.columns?.some((c) => c.id === `${wide.id}-fk0`)).toBe(true);
    const ids = wide?.columns?.map((c) => c.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps 150 tables and about 250 relationships reachable', () => {
    const { deck } = generateBenchDeck(150, 250, 42, SCALE);
    expect(deck.nodes.filter((n) => n.type === 'db-table')).toHaveLength(150);
    expect(deck.edges.filter((e) => e.fromColumns !== undefined).length).toBeGreaterThanOrEqual(
      150,
    );
  });

  it('assigns schema names round-robin', () => {
    const { deck } = generateBenchDeck(150, 250, 42, SCALE);
    expect(deck.nodes.map((n) => n.schema).slice(0, 4)).toEqual([
      'schema_0',
      'schema_1',
      'schema_2',
      'schema_0',
    ]);
    expect(new Set(deck.nodes.map((n) => n.schema)).size).toBe(3);
  });

  it('is deterministic by seed and leaves the plain deck unchanged without the options', () => {
    expect(generateBenchDeck(150, 250, 42, SCALE).deck).toEqual(
      generateBenchDeck(150, 250, 42, SCALE).deck,
    );
    const plain = generateBenchDeck(150, 250, 42, { tables: 150, rel: true }).deck;
    const same = generateBenchDeck(150, 250, 42, {
      tables: 150,
      rel: true,
      wide: false,
      schemas: 0,
    }).deck;
    expect(same).toEqual(plain);
    expect(plain.nodes.every((n) => n.schema === undefined)).toBe(true);
  });

  it('ignores wide and schemas without tables', () => {
    expect(generateBenchDeck(50, 100, 42, { wide: true, schemas: 3 }).deck).toEqual(
      generateBenchDeck(50, 100, 42).deck,
    );
  });

  it('adds the requested images over four tiny pictures, some grouped, some connected (055)', () => {
    const { deck } = generateBenchDeck(60, 120, 42, { groups: true, images: 24 });
    expect(parseSododeckFile(deck).success).toBe(true);
    expect(deck.images).toHaveLength(24);
    expect(Object.keys(deck.assets ?? {})).toHaveLength(4);
    expect(deck.images?.some((image) => image.group !== undefined)).toBe(true);
    const ends = new Set(deck.edges.flatMap((edge) => [edge.from, edge.to]));
    expect(deck.images?.some((image) => ends.has(image.id))).toBe(true);
    // Same seed, same deck; and the cards are unchanged by asking for images.
    expect(generateBenchDeck(60, 120, 42, { groups: true, images: 24 }).deck).toEqual(deck);
    const plain = generateBenchDeck(60, 120, 42, { groups: true }).deck;
    expect(deck.nodes).toEqual(plain.nodes);
    expect(generateBenchDeck(60, 120, 42).deck.images).toBeUndefined();
  });
});
