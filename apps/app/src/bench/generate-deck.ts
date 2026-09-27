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
 * between nearby nodes (like real architecture maps), no duplicates or self-loops.
 */
export function generateBenchDeck(nodeCount: number, edgeCount: number, seed = 42) {
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
  return { deck };
}
