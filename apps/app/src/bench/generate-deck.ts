import { CARD_TYPES, NEW_DECK_PACKS } from '@sododeck/model';
import { emptySododeckFile, type CardColor, type SododeckFile } from '@sododeck/schema';

const KINDS = ['service', 'service', 'database', 'client', 'external'] as const;

/** 030 SC-007: every built-in card type, one after the other. */
const ALL_TYPES = CARD_TYPES.map((type) => type.id);

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
    return {
      id: `n${i}`,
      type:
        (options.fields === true
          ? fieldBenchType(i)
          : options.types === true
            ? ALL_TYPES[i % ALL_TYPES.length]
            : KINDS[i % KINDS.length]) ?? 'service',
      title: `Node ${i}`,
      // Cards with a fields block are taller (032): rows further apart so they barely overlap,
      // columns a little closer so the whole deck still fits one PNG canvas (16.7 M px).
      position: {
        x: (i % columns) * (options.fields === true ? 200 : 220),
        y: Math.floor(i / columns) * (options.fields === true ? 150 : 110),
      },
      ...(options.routes === true ? { size: { width: 200, height: 72 } } : {}),
      ...(style ? { style } : {}),
      ...(options.tags === true ? { tags: benchTags(i) } : {}),
      ...(options.fields === true && fieldBenchType(i) !== 'client' ? benchValues(i) : {}),
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
  if (options.routes === true) addBenchRoutes(edges);
  if (options.animated === true) addBenchAnimated(edges);
  if (options.bends === true) addBenchBends(edges);

  const deck: SododeckFile = {
    ...emptySododeckFile(),
    // BENCH_TYPES: every pack on, so the Add flyout and pickers list all 13 types too.
    ...(options.types === true || options.fields === true ? { packs: [...NEW_DECK_PACKS] } : {}),
    ...(options.fields === true ? BENCH_FIELD_DEFS : {}),
    nodes,
    edges,
  };
  if (options.groups === true) addBenchGroups(deck);
  if ((options.stickies ?? 0) > 0) addBenchStickies(deck, options.stickies ?? 0, random);
  if (options.flows === true) addBenchFlows(deck, random);
  if (options.views === true) addBenchViews(deck, random);
  return { deck };
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
