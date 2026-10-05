/**
 * Placement of an imported flowchart: the layout request for the ELK worker in the flowchart's
 * direction, and the positions and group frames written back into the file before it is stored.
 * A flowchart comes without positions, so this is the general placement of unplaced cards
 * (`layout/place-unplaced.ts`, 027) with nothing pinned. Main thread.
 */
import type { SododeckFile } from '@sododeck/schema';

import type { LayoutRequest, LayoutResult } from '../layout/elk-layout';
import { applyPlacement, placementRequests } from '../layout/place-unplaced';
import type { FlowDirection } from './parse-flowchart';

const ELK_DIRECTION = {
  TB: 'DOWN',
  BT: 'UP',
  LR: 'RIGHT',
  RL: 'LEFT',
} as const satisfies Record<FlowDirection, NonNullable<LayoutRequest['direction']>>;

export function toLayoutRequest(file: SododeckFile, direction: FlowDirection): LayoutRequest {
  const elkDirection = ELK_DIRECTION[direction];
  // A flowchart has one level; an empty one still gets a (empty) request in its direction.
  return (
    placementRequests(file, elkDirection)[0] ?? {
      nodes: [],
      groups: [],
      edges: [],
      pinned: {},
      direction: elkDirection,
    }
  );
}

/** Writes the layout's positions into the nodes and fits a frame around every non-empty group. */
export function applyLayout(file: SododeckFile, result: LayoutResult): SododeckFile {
  return applyPlacement(file, result);
}
