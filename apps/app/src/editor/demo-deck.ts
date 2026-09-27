import example from '@sododeck/schema/examples/minimal.sododeck.json' with { type: 'json' };
import type { XYPosition } from '@xyflow/react';

/** Hard-coded demo deck for the editor shell (3 nodes, 2 edges). Replaced by the local library in M1. */
export const demoDeck: unknown = example;

/** TODO(M1): positions come from the active view in the document. */
export const demoPositions: Record<string, XYPosition> = {
  'web-app': { x: 0, y: 80 },
  'order-svc': { x: 260, y: 80 },
  'orders-db': { x: 520, y: 80 },
};
