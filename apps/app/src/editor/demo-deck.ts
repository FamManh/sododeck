import example from '@sododeck/schema/examples/minimal.sododeck.json' with { type: 'json' };
import type { SododeckFile } from '@sododeck/schema';

/** Where the demo's three nodes sit (a left-to-right request path). */
const POSITIONS: Readonly<Record<string, { x: number; y: number }>> = {
  'web-app': { x: 0, y: 80 },
  'order-svc': { x: 260, y: 80 },
  'orders-db': { x: 520, y: 80 },
};

/**
 * Hard-coded demo deck for `/deck/demo` (3 nodes, 2 edges). Positions live in the document like
 * any user edit. Replaced by the local library in 005.
 */
export const demoDeck: SododeckFile = {
  ...(example as SododeckFile),
  name: 'Demo deck',
  nodes: (example as SododeckFile).nodes.map((node) => {
    const position = POSITIONS[node.id];
    return position ? { ...node, position } : node;
  }),
};
