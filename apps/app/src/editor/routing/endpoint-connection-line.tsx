import type { Side } from '@sododeck/schema';
import { Position, type ConnectionLineComponentProps } from '@xyflow/react';

import { useUiStore } from '../../state/ui-store';
import { EdgeEnds } from '../edge-ends';
import { routedPath } from './route-path';

/** The reverse of `deck-node.tsx`'s fixed handle positions (017 R12, mirrors `deck-edge.tsx`). */
const SIDE_OF_POSITION: Record<Position, Side> = {
  [Position.Top]: 'top',
  [Position.Right]: 'right',
  [Position.Bottom]: 'bottom',
  [Position.Left]: 'left',
};

/**
 * The live connection/reconnect line (017 R12): a dashed path drawn through `routedPath` (elbow,
 * like the edges until 034 stores a line type) with the Deck end marks, instead of xyflow's bezier, with the hot side (`endpointHover`) applied to the end
 * under the pointer, so it previews where the connector will actually route.
 */
export function EndpointConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
}: ConnectionLineComponentProps) {
  const hover = useUiStore((s) => s.endpointHover);
  const toSide = hover?.side ?? SIDE_OF_POSITION[toPosition];
  const { path, ends } = routedPath(
    'elbow',
    { x: fromX, y: fromY, width: 0, height: 0 },
    { x: toX, y: toY, width: 0, height: 0 },
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
    </g>
  );
}
