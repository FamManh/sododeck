import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';

const KINDS = ['service', 'service', 'database', 'client', 'external'] as const;

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
export function generateBenchDeck(
  nodeCount: number,
  edgeCount: number,
  seed = 42,
  options: { flows?: boolean; stickies?: number } = {},
) {
  const random = mulberry32(seed);
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodeCount * 1.25)));

  const nodes = Array.from({ length: nodeCount }, (_, i) => {
    return {
      id: `n${i}`,
      type: KINDS[i % KINDS.length] ?? 'service',
      title: `Node ${i}`,
      position: { x: (i % columns) * 220, y: Math.floor(i / columns) * 110 },
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
    edges.push({ id: `e${edges.length}`, from: `n${a}`, to: `n${b}` });
  }

  const deck: SododeckFile = { ...emptySododeckFile(), nodes, edges };
  if ((options.stickies ?? 0) > 0) addBenchStickies(deck, options.stickies ?? 0, random);
  if (options.flows === true) addBenchFlows(deck, random);
  return { deck };
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
