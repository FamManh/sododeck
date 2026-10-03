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
  const anchor = useUiStore((s) => s.endpointAnchor);
  const readout = useUiStore((s) => s.connectorReadout);
  const toSide = hover?.side ?? SIDE_OF_POSITION[toPosition];
  // Over a card side the preview ends on the anchor the drop would make (022 R4).
  const end =
    anchor !== null && !anchor.automatic && hover !== null ? anchor.point : { x: toX, y: toY };
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
      {readout !== null && (
        <text
          x={end.x + 12}
          y={end.y + 16}
          fontSize={10.5}
          fill="var(--color-deck-orange)"
          fontFamily="var(--font-mono)"
          aria-hidden
          data-testid="endpoint-readout"
        >
          {readout}
        </text>
      )}
    </g>
  );
}
