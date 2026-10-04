import type { Side } from '@sododeck/schema';
import {
  Position,
  useStore,
  type ConnectionLineComponentProps,
  type ReactFlowState,
} from '@xyflow/react';
import { useMemo } from 'react';

import { anchorReadout } from '../editing/anchor-drag';
import { EdgeEnds } from '../edge-ends';
import { connectTarget, targetScene } from './endpoint-target';
import { routedPath } from './route-path';

/** The reverse of `deck-node.tsx`'s fixed handle positions (017 R12, mirrors `deck-edge.tsx`). */
const SIDE_OF_POSITION: Record<Position, Side> = {
  [Position.Top]: 'top',
  [Position.Right]: 'right',
  [Position.Bottom]: 'bottom',
  [Position.Left]: 'left',
};

const nodesSelector = (s: ReactFlowState) => s.nodes;
const transformSelector = (s: ReactFlowState) => s.transform;

/**
 * The live line of a **new** connection (017 R12, 050 R3): a dashed path drawn through
 * `routedPath` with the Deck end marks. Over a card it ends where the drop would attach: the
 * nearest point of the card's outline (`connectTarget`, the same hit test and attachment the drop
 * uses), with a readout of the side and position. Existing connector ends are dragged by their
 * own handles (`editing/endpoint-drag.ts`), not through this line.
 */
export function EndpointConnectionLine({
  fromX,
  fromY,
  toPosition,
  fromPosition,
  fromNode,
  pointer,
}: ConnectionLineComponentProps) {
  const nodes = useStore(nodesSelector);
  const [tx, ty, zoom] = useStore(transformSelector);
  // The drawn targets change only with the nodes, not with every pointer move.
  const scene = useMemo(() => targetScene(nodes), [nodes]);
  // `pointer` is in container pixels (not panned or zoomed), unlike `toX`/`toY`; `toX`/`toY` would
  // also snap to a nearby handle, so the raw pointer is converted to canvas coordinates instead.
  const flowPointer = { x: (pointer.x - tx) / zoom, y: (pointer.y - ty) / zoom };
  const hit = connectTarget(scene, fromNode.id, flowPointer, { zoom, mod: false });
  const end = hit?.attach.point ?? flowPointer;
  const toSide = hit?.attach.side ?? SIDE_OF_POSITION[toPosition];
  const { path, ends } = routedPath(
    'elbow',
    { x: fromX, y: fromY, width: 0, height: 0 },
    { x: end.x, y: end.y, width: 0, height: 0 },
    [SIDE_OF_POSITION[fromPosition], toSide],
  );
  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="var(--color-deck-orange)"
        strokeWidth={2}
        strokeDasharray="4 3"
        data-testid="endpoint-connection-line"
      />
      <EdgeEnds {...ends} direction="forward" color="var(--color-deck-orange)" />
      {hit !== null && (
        <text
          x={end.x + 12}
          y={end.y + 16}
          fontSize={10.5}
          fill="var(--color-deck-orange)"
          fontFamily="var(--font-mono)"
          aria-hidden
          data-testid="endpoint-readout"
        >
          {anchorReadout(hit.attach.side, hit.attach.at, hit.attach.snapped)}
        </text>
      )}
    </g>
  );
}
