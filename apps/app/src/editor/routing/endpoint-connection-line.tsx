import type { Side } from '@sododeck/schema';
import { Position, type ConnectionLineComponentProps } from '@xyflow/react';

import { useUiStore } from '../../state/ui-store';
import { routedStepPath } from './route-path';

/** The reverse of `deck-node.tsx`'s fixed handle positions (017 R12, mirrors `deck-edge.tsx`). */
const SIDE_OF_POSITION: Record<Position, Side> = {
  [Position.Top]: 'top',
  [Position.Right]: 'right',
  [Position.Bottom]: 'bottom',
  [Position.Left]: 'left',
};

/**
 * The live connection/reconnect line (017 R12): a dashed path drawn through `routedStepPath`
 * instead of xyflow's default bezier, with the hot side (`endpointHover`) applied to the end
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
  const { path } = routedStepPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
    sides: [SIDE_OF_POSITION[fromPosition], hover?.side ?? SIDE_OF_POSITION[toPosition]],
    borderRadius: 8,
  });
  return (
    <path
      d={path}
      fill="none"
      stroke="var(--color-primary)"
      strokeWidth={1.5}
      strokeDasharray="4 3"
      data-testid="endpoint-connection-line"
    />
  );
}
