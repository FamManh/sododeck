import { CARD_TYPES, PACKS, SHAPE_TYPE_IDS } from '@sododeck/model';
import { lucide } from '@sododeck/ui/icon-sets';
import { emptySododeckFile, type CardColor, type SododeckFile } from '@sododeck/schema';

const BENCH_ICONS = lucide.icons;

const KINDS = ['service', 'service', 'database', 'client', 'external'] as const;

/** 030 SC-007: every built-in card type, one after the other. */
/** Every card-family type (030, 040's `db-table` included); shapes come with `BENCH_SHAPES` (031). */
const ALL_TYPES = CARD_TYPES.filter((type) => type.family === 'card').map((type) => type.id);

/** 020 R13: the 13 named card colours plus two custom hex colours, cycled across nodes. */
const BENCH_FILLS: readonly (CardColor | `#${string}`)[] = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'pink',
  'slate',
  '#7a3cff',
  '#1f2a44',
];

/** 032 R10: the three types with default fields, cycled. */
const FIELD_TYPES = ['task', 'warehouse', 'issue'] as const;

/**
 * Every 10th card is a Client with no values, so the Infra view (which dims clients) still has
 * something to dim in the view-switch scenario.
 */
function fieldBenchType(i: number): string {
  return i % 10 === 9 ? 'client' : (FIELD_TYPES[i % FIELD_TYPES.length] ?? 'task');
}

/**
 * 032 R10: Owner on the card for every type, and Warehouse's defaults materialised with Region
 * options, so each card shows four values (Task: status, assignee, due, owner; Warehouse:
 * capacity, SLA, region, owner; Issue: status, assignee, dates, estimate).
 */
const BENCH_FIELD_DEFS: Pick<SododeckFile, 'fields' | 'fieldDefaults'> = {
  fields: [
    {
      id: 'warehouse.capacity',
      name: 'Capacity',
      kind: 'progress',
      types: ['warehouse'],
      onCard: true,
    },
    {
      id: 'warehouse.sla',
      name: 'SLA',
      kind: 'number',
      types: ['warehouse'],
      onCard: true,
      unit: 'h',
    },
    {
      id: 'warehouse.region',
      name: 'Region',
      kind: 'select',
      types: ['warehouse'],
      onCard: true,
      options: [
        { id: 'north', label: 'North', color: 'blue' },
        { id: 'south', label: 'South', color: 'amber' },
      ],
    },
    { id: 'owner', name: 'Owner', kind: 'person', onCard: true },
  ],
  fieldDefaults: ['warehouse'],
};

const PEOPLE = ['Lan', 'Minh Tran', 'Bao', 'Thu Le'];

function benchValues(i: number): Pick<SododeckFile['nodes'][number], 'owner' | 'values'> {
  const person = PEOPLE[i % PEOPLE.length] ?? 'Lan';
  switch (FIELD_TYPES[i % FIELD_TYPES.length]) {
    case 'task':
      return {
        owner: `Team ${String(i % 7)}`,
        values: { 'task.assignee': person, 'task.due': '2026-10-14', 'task.status': 'doing' },
      };
    case 'warehouse':
      return {
        owner: `Team ${String(i % 7)}`,
        values: {
          'warehouse.capacity': (i * 7) % 101,
          'warehouse.region': i % 2 === 0 ? 'north' : 'south',
          'warehouse.sla': 24,
        },
      };
    default:
      return {
        values: {
          'issue.assignee': person,
          'issue.dates': { from: '2026-10-06', to: '2026-10-17' },
          'issue.estimate': 5,
          'issue.status': 'todo',
        },
      };
  }
}

/** Small deterministic PRNG so every benchmark run renders the same graph. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Synthetic deck for performance benchmarks: nodes on a grid, edges mostly
 * between nearby nodes (like real architecture maps), no duplicates or self-loops. With
 * `flows`, also features and flows of contiguous steps (006).
 */
/** 033 R11: a pool of 24 tags in mixed case ("PCI" and "pci" are one tag), 3 to 10 per card. */
const BENCH_TAG_POOL = [
  'PCI',
  'pci',
  'Lan',
  'edge',
  'Core',
  'billing',
  'Auth',
  'legacy',
  'EU',
  'eu-west',
  'Batch',
  'realtime',
  'Public',
  'internal',
  'SLA-1',
  'sla-2',
  'Data',
  'cache',
  'Queue',
  'search',
  'Mobile',
  'web',
  'Admin',
  'ops',
];

/** Distinct tags by index, no random draw, so the edge sequence of a seed does not change. */
function benchTags(index: number): string[] {
  const count = 3 + (index % 8);
  const tags: string[] = [];
  for (let k = 0; tags.length < count; k++) {
    const tag = BENCH_TAG_POOL[(index * 7 + k * 5) % BENCH_TAG_POOL.length];
    if (tag !== undefined && !tags.some((t) => t.toLowerCase() === tag.toLowerCase()))
      tags.push(tag);
  }
  return tags;
}

/** 029 T060: one third of the connectors each, so every line type is drawn. */
const LINE_TYPES = ['curved', 'elbow', 'straight'] as const;

export function generateBenchDeck(
  nodeCount: number,
  edgeCount: number,
  seed = 42,
  options: {
    flows?: boolean;
    groups?: boolean;
    stickies?: number;
    views?: boolean;
    routes?: boolean;
    colours?: boolean;
    lineTypes?: boolean;
    tags?: boolean;
    types?: boolean;
    /** 032: Task / Warehouse / Issue cards, each with four on-card field values. */
    fields?: boolean;
    /** 022: 200 edges animated (half of them dashed). */
    animated?: boolean;
    /** 022: 200 edges with three free bends each, mixed shapes. */
    bends?: boolean;
    /** 031: every third node is a shape (the eleven geometries round-robin), every pack on. */
    shapes?: boolean;
    /** 038: every card gets a catalog icon, round-robin over the lucide set. */
    icons?: boolean;
    /** 041: the first n nodes become 12-column tables with foreign keys and one enum. */
    tables?: number;
    /**
     * 042: with `tables`, every table-to-table edge is a relationship with column ends (FK → PK,
     * `n-1`, from side optional), 5 of them self-references and 5 a second FK between a pair.
     */
    rel?: boolean;
    /** 048: with `tables`, every 10th table has 60 columns (the rest 12), so the row limit bites. */
    wide?: boolean;
    /** 048: with `tables`, `schema_0` … `schema_n-1` assigned to the tables round-robin. */
    schemas?: number;
  } = {},
) {
  const random = mulberry32(seed);
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodeCount * 1.25)));

  const nodes = Array.from({ length: nodeCount }, (_, i) => {
    // 020 R13: every node gets a fill (cycling the 13 named colours plus 2 custom hex), and
    // every 5th node also gets a blue stroke, to benchmark the per-node colour CSS properties.
    const style =
      options.colours === true
        ? {
            fill: BENCH_FILLS[i % BENCH_FILLS.length],
            ...(i % 5 === 0 ? { stroke: 'blue' as const } : {}),
          }
        : undefined;
    const shape =
      options.shapes === true && i % 3 === 0
        ? SHAPE_TYPE_IDS[(i / 3) % SHAPE_TYPE_IDS.length]
        : undefined;
    return {
      id: `n${i}`,
      type:
        shape ??
        (options.fields === true
          ? fieldBenchType(i)
          : options.types === true
            ? ALL_TYPES[i % ALL_TYPES.length]
            : KINDS[i % KINDS.length]) ??
        'service',
      title: `Node ${i}`,
      // Cards with a fields block are taller (032): rows further apart so they barely overlap,
      // columns a little closer so the whole deck still fits one PNG canvas (16.7 M px).
      position: {
        x: (i % columns) * (options.fields === true ? 200 : 220),
        y: Math.floor(i / columns) * (options.fields === true ? 150 : 110),
      },
      ...(options.routes === true ? { size: { width: 200, height: 72 } } : {}),
      ...(style ? { style } : {}),
      ...(options.icons === true && shape === undefined
        ? { icon: `lucide:${BENCH_ICONS[i % BENCH_ICONS.length]?.name ?? 'box'}` }
        : {}),
      ...(options.tags === true ? { tags: benchTags(i) } : {}),
      ...(options.fields === true && shape === undefined && fieldBenchType(i) !== 'client'
        ? benchValues(i)
        : {}),
    };
  });

  const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
  const target = Math.min(edgeCount, maxEdges);
  const seen = new Set<string>();
  const edges: SododeckFile['edges'] = [];
  while (edges.length < target) {
    const a = Math.floor(random() * nodeCount);
    const offset = 1 + Math.floor(random() * columns * 2);
    const b = random() < 0.8 ? (a + offset) % nodeCount : Math.floor(random() * nodeCount);
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || seen.has(key)) continue;
    seen.add(key);
    const shape = options.lineTypes === true ? LINE_TYPES[edges.length % 3] : undefined;
    edges.push({
      id: `e${edges.length}`,
      from: `n${a}`,
      to: `n${b}`,
      ...(shape ? { style: { shape } } : {}),
    });
  }
  if ((options.tables ?? 0) > 0) {
    addBenchTables(nodes, edges, options.tables ?? 0);
    if (options.wide === true) widenBenchTables(nodes, options.tables ?? 0);
    if ((options.schemas ?? 0) > 0) assignBenchSchemas(nodes, options.tables ?? 0, options.schemas ?? 0);
  }
  if ((options.tables ?? 0) > 0 && options.rel === true) addBenchRelationships(nodes, edges);
  if (options.routes === true) addBenchRoutes(edges);
  if (options.animated === true) addBenchAnimated(edges);
  if (options.bends === true) addBenchBends(edges);

  // Every pack on, Logistics included (a new deck has it off since 051): the bench uses Warehouse.
  const allPacks = PACKS.map((pack) => pack.id);
  const deck: SododeckFile = {
    ...emptySododeckFile(),
    // BENCH_TYPES: every pack on, so the Add flyout and pickers list all 13 types too.
    ...(options.types === true || options.fields === true || options.shapes === true
      ? { packs: allPacks }
      : {}),
    ...(options.fields === true ? BENCH_FIELD_DEFS : {}),
    ...((options.tables ?? 0) > 0 ? { packs: allPacks, enums: [BENCH_ENUM] } : {}),
    nodes,
    edges,
  };
  if (options.groups === true) addBenchGroups(deck);
  if ((options.stickies ?? 0) > 0) addBenchStickies(deck, options.stickies ?? 0, random);
  if (options.flows === true) addBenchFlows(deck, random);
  if (options.views === true) addBenchViews(deck, random);
  return { deck };
}

/** 041: the one deck enum every bench table's `status` column names. */
const BENCH_ENUM = {
  id: 'bench-status',
  name: 'bench_status',
  color: 'violet' as const,
  values: ['pending', 'paid', 'shipped', 'cancelled'].map((name) => ({
    id: `bench-status-${name}`,
    name,
  })),
};

/** 041 R14: the eight plain columns after `id`, two foreign keys and `status`. */
const BENCH_PLAIN_COLUMNS = [
  ['number', 'text'],
  ['total_cents', 'int'],
  ['currency', 'char'],
  ['note', 'text'],
  ['paid_at', 'timestamptz'],
  ['shipped_at', 'timestamptz'],
  ['created_at', 'timestamptz'],
  ['updated_at', 'timestamptz'],
] as const;

/**
 * 041 R14: the first `count` nodes become `db-table` cards with 12 columns (1 PK, 2 FK, 1 enum, 8
 * plain), spaced for their height. The first two edges leaving a table for another table carry its
 * foreign keys (`n-1`, FK column → the other table's PK).
 */
function addBenchTables(
  nodes: SododeckFile['nodes'],
  edges: SododeckFile['edges'],
  count: number,
): void {
  const tables = new Set<string>();
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length * 1.25)));
  nodes.slice(0, count).forEach((node, i) => {
    tables.add(node.id);
    node.type = 'db-table';
    node.title = `table_${String(i)}`;
    node.position = { x: (i % columns) * 300, y: Math.floor(i / columns) * 420 };
    node.columns = [
      { id: `${node.id}-id`, name: 'id', type: 'uuid', pk: true },
      { id: `${node.id}-fk0`, name: 'owner_id', type: 'uuid', notNull: true },
      { id: `${node.id}-fk1`, name: 'parent_id', type: 'uuid' },
      { id: `${node.id}-status`, name: 'status', type: 'bench_status', enumRef: BENCH_ENUM.id },
      ...BENCH_PLAIN_COLUMNS.map(([name, type], k) => ({
        id: `${node.id}-c${String(k)}`,
        name,
        type,
        ...(k % 3 === 0 ? {} : { notNull: true }),
        ...(k === 0 ? { unique: true } : {}),
      })),
    ];
    node.indexes = [{ id: `${node.id}-ix`, columns: [`${node.id}-fk0`] }];
  });
  const used = new Map<string, number>();
  for (const edge of edges) {
    if (!tables.has(edge.from) || !tables.has(edge.to)) continue;
    const k = used.get(edge.from) ?? 0;
    if (k >= 2) continue;
    used.set(edge.from, k + 1);
    edge.fromColumns = [`${edge.from}-fk${String(k)}`];
    edge.toColumns = [`${edge.to}-id`];
    edge.cardinality = 'n-1';
  }
}

/** 048: a wide table's column count; the others keep their 12. */
const BENCH_WIDE_COLUMNS = 60;

/**
 * 048: every 10th table gets extra plain columns after the 12 (so `fk0`, `fk1` and `id`, the ends
 * of the relationships, keep their ids and place) up to 60, which is where the row limit bites.
 */
function widenBenchTables(nodes: SododeckFile['nodes'], count: number): void {
  nodes.slice(0, count).forEach((node, i) => {
    if (i % 10 !== 0 || node.columns === undefined) return;
    for (let k = node.columns.length; k < BENCH_WIDE_COLUMNS; k++) {
      node.columns.push({ id: `${node.id}-w${String(k)}`, name: `extra_${String(k)}`, type: 'text' });
    }
  });
}

/** 048: round-robin schema names, so grouping by schema has `names` groups of the same size. */
function assignBenchSchemas(nodes: SododeckFile['nodes'], count: number, names: number): void {
  nodes.slice(0, count).forEach((node, i) => {
    node.schema = `schema_${String(i % names)}`;
  });
}

/** 042 R19: how many self-references and how many tables joined by a second FK. */
const BENCH_SPECIAL_RELATIONSHIPS = 5;

/**
 * 042 R19: runs after `addBenchTables` and overrides its column ends. Every edge between two tables
 * becomes a relationship: the k-th one leaving a table names its `fk(k mod 2)` column (a table has
 * two FK columns, so busy tables reuse them), the other table's PK, `n-1`, from side optional.
 * Edges are re-pointed rather than added so the edge count and ids match the plain tables deck:
 * 5 become self-references (`parent_id` → own `id`) and 5 a second FK beside another edge's pair.
 */
function addBenchRelationships(nodes: SododeckFile['nodes'], edges: SododeckFile['edges']): void {
  const tables = new Set(nodes.filter((n) => n.type === 'db-table').map((n) => n.id));
  const between = edges.filter((e) => tables.has(e.from) && tables.has(e.to));
  // Spread the picks over the list; one table, one loop; one pair, one extra FK.
  const stride = Math.max(1, Math.floor(between.length / (BENCH_SPECIAL_RELATIONSHIPS * 4)));
  const touched = new Set<string>();
  const loops: SododeckFile['edges'] = [];
  const pairs: [SododeckFile['edges'][number], SododeckFile['edges'][number]][] = [];
  for (let i = 0; i + 1 < between.length; i += stride) {
    const edge = between[i];
    const next = between[i + 1];
    if (edge === undefined || next === undefined) continue;
    if (loops.length < BENCH_SPECIAL_RELATIONSHIPS) {
      if (touched.has(edge.id) || loops.some((l) => l.from === edge.from)) continue;
      edge.to = edge.from;
      touched.add(edge.id);
      loops.push(edge);
    } else if (pairs.length < BENCH_SPECIAL_RELATIONSHIPS) {
      if (touched.has(edge.id) || touched.has(next.id)) continue;
      next.from = edge.from;
      next.to = edge.to;
      touched.add(edge.id).add(next.id);
      pairs.push([edge, next]);
    } else break;
  }
  const used = new Map<string, number>();
  for (const edge of between) {
    const k = used.get(edge.from) ?? 0;
    used.set(edge.from, k + 1);
    edge.fromColumns = [`${edge.from}-fk${String(k % 2)}`];
    edge.toColumns = [`${edge.to}-id`];
    edge.cardinality = 'n-1';
    edge.fromOptional = true;
  }
  for (const loop of loops) loop.fromColumns = [`${loop.from}-fk1`];
  for (const [first, second] of pairs) {
    first.fromColumns = [`${first.from}-fk0`];
    second.fromColumns = [`${second.from}-fk1`];
  }
}

/** 022 R11: the first 200 edges run moving dashes, every other one dashed. */
function addBenchAnimated(edges: SododeckFile['edges']): void {
  edges.slice(0, 200).forEach((edge, i) => {
    edge.style = {
      ...edge.style,
      ...(i % 2 === 0 ? { dash: 'dashed' as const } : {}),
      animated: true,
    };
  });
}

/** 022 R1: the first 200 edges get three free bends, in the three line types. */
function addBenchBends(edges: SododeckFile['edges']): void {
  edges.slice(0, 200).forEach((edge, i) => {
    const shape = LINE_TYPES[i % 3];
    edge.style = { ...edge.style, ...(shape === undefined ? {} : { shape }) };
    edge.route = {
      ...edge.route,
      waypoints: [
        { x: 0.25, dy: -40 },
        { x: 0.5, dy: 40 },
        { x: 0.75, dy: -40 },
      ],
    };
  });
}

/**
 * 017 research R15: pins a route on the first 200 edges, mixing horizontal and vertical opposite
 * sides with a ±40 px offset (only an opposite pair has a movable middle segment).
 */
function addBenchRoutes(edges: SododeckFile['edges']): void {
  const ROUTED = Math.min(200, edges.length);
  for (let i = 0; i < ROUTED; i++) {
    const edge = edges[i];
    if (edge === undefined) continue;
    edge.route =
      i % 2 === 0
        ? { fromSide: 'right', toSide: 'left', offset: i % 4 === 0 ? 40 : -40 }
        : { fromSide: 'bottom', toSide: 'top', offset: i % 4 === 1 ? 40 : -40 };
  }
}

function addBenchGroups(deck: SododeckFile): void {
  const groupCount = Math.min(25, Math.floor(deck.nodes.length / 20));
  const parentCount = Math.ceil(groupCount / 5);

  for (let index = 0; index < parentCount; index++) {
    deck.groups.push({
      id: `p${String(index)}`,
      title: `Parent group ${String(index)}`,
    });
  }

  for (let index = 0; index < groupCount; index++) {
    const groupId = `g${String(index)}`;
    deck.groups.push({
      id: groupId,
      title: `Group ${String(index)}`,
      parent: `p${String(Math.floor(index / 5))}`,
    });
    const start = index * 20;
    for (const node of deck.nodes.slice(start, start + 20)) {
      node.group = groupId;
    }
  }
}

/** Flows scale of 006 research R15: 5 features × 4 flows × 10 contiguous steps, plus one fork. */
const FLOW_FEATURES = 5;
const FLOWS_PER_FEATURE = 4;
const STEPS_PER_FLOW = 10;

/** A walk of up to `length` edges that each start where the previous one ended. */
function walk(
  outgoing: ReadonlyMap<string, SododeckFile['edges']>,
  start: string,
  length: number,
  random: () => number,
): SododeckFile['edges'] {
  const path: SododeckFile['edges'] = [];
  let at = start;
  while (path.length < length) {
    const options = outgoing.get(at) ?? [];
    const edge = options[Math.floor(random() * options.length)];
    if (edge === undefined) break;
    path.push(edge);
    at = edge.to;
  }
  return path;
}

function addBenchFlows(deck: SododeckFile, random: () => number): void {
  const outgoing = new Map<string, SododeckFile['edges']>();
  for (const edge of deck.edges)
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  const starts = [...outgoing.keys()];
  /** The longest of a few random walks, so almost every flow has its 10 steps. */
  const longWalk = () => {
    let best: SododeckFile['edges'] = [];
    for (let i = 0; i < 20 && best.length < STEPS_PER_FLOW; i++) {
      const start = starts[Math.floor(random() * starts.length)] ?? '';
      const path = walk(outgoing, start, STEPS_PER_FLOW, random);
      if (path.length > best.length) best = path;
    }
    return best;
  };

  for (let f = 0; f < FLOW_FEATURES; f++) {
    deck.features.push({ id: `feat${String(f)}`, title: `Feature ${String(f)}` });
    for (let i = 0; i < FLOWS_PER_FEATURE; i++) {
      const id = `flow${String(f)}-${String(i)}`;
      deck.flows.push({
        id,
        title: `Flow ${String(f)}.${String(i)}`,
        feature: `feat${String(f)}`,
        steps: longWalk().map((edge, s) => ({ id: `${id}-s${String(s)}`, edge: edge.id })),
      });
    }
  }

  // One flow with a 2-branch fork after its 5th step, written directly as JSON (ADR 0008).
  const main = longWalk().slice(0, 5);
  const fork = main.at(-1)?.to ?? '';
  const branchA = walk(outgoing, fork, 3, random);
  const branchB = walk(outgoing, fork, 3, random);
  deck.flows.push({
    id: 'flow-fork',
    title: 'Fork flow',
    feature: 'feat0',
    branches: [
      { id: 'fork-a', label: 'ok', condition: 'status == "ok"' },
      { id: 'fork-b', label: 'failed', condition: 'status == "failed"', errorPath: true },
    ],
    steps: [
      ...main.map((edge, s) => ({ id: `fork-s${String(s)}`, edge: edge.id })),
      ...branchA.map((edge, s) => ({ id: `fork-a${String(s)}`, edge: edge.id, branch: 'fork-a' })),
      ...branchB.map((edge, s) => ({ id: `fork-b${String(s)}`, edge: edge.id, branch: 'fork-b' })),
    ],
  });
}

function addBenchStickies(deck: SododeckFile, count: number, random: () => number): void {
  const freeCount = Math.floor(count / 2);
  for (let i = 0; i < count; i++) {
    const color = (['amber', 'blue', 'green', 'clay', 'grey'] as const)[i % 5] ?? 'amber';
    if (i < freeCount) {
      deck.stickies.push({
        id: `sticky${String(i)}`,
        text: `Bench note ${String(i)}`,
        color,
        position: {
          x: Math.round(random() * 180 + (i % 8) * 220),
          y: Math.round(random() * 120 + Math.floor(i / 8) * 160),
        },
      });
      continue;
    }

    const node = deck.nodes[Math.floor(random() * deck.nodes.length)];
    if (node === undefined) continue;
    deck.stickies.push({
      id: `sticky${String(i)}`,
      text: `Bench note ${String(i)}`,
      color,
      anchor: node.id,
      position: {
        x: Math.round(random() * 96) - 24,
        y: -96 + Math.round(random() * 80),
      },
    });
  }
}

/**
 * Saved views (011 research R14): System, Feature and Infra, where Infra moves half the nodes
 * (seeded offsets) and pins 20, plus a custom view hiding external components.
 */
function addBenchViews(deck: SododeckFile, random: () => number): void {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const [index, node] of deck.nodes.entries()) {
    if (index % 2 !== 0 || node.position === undefined) continue;
    positions[node.id] = {
      x: node.position.x + Math.round(random() * 120) - 60,
      y: node.position.y + Math.round(random() * 80) - 40,
    };
  }
  const step = Math.max(1, Math.floor(deck.nodes.length / 20));
  const pinned = deck.nodes
    .filter((_, index) => index % step === 0)
    .slice(0, 20)
    .map((node) => node.id);
  deck.views.push(
    { id: 'system', type: 'system', title: 'System', subtitleField: 'tech' },
    { id: 'feature', type: 'feature', title: 'Feature', subtitleField: 'flows' },
    {
      id: 'infra',
      type: 'infra',
      title: 'Infra',
      subtitleField: 'host',
      dimKinds: ['client'],
      positions,
      pinned,
    },
    { id: 'custom', type: 'custom', title: 'Custom 1', excludeKinds: ['external'] },
  );
}
