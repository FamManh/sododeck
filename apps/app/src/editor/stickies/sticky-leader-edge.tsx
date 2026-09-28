import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps } from '@xyflow/react';
import { Pin } from 'lucide-react';
import { memo } from 'react';

import type { StickyLeaderFlowEdge } from '../deck-to-flow';

export const StickyLeaderEdge = memo(function StickyLeaderEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps<StickyLeaderFlowEdge>) {
  const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={0}
        style={{
          stroke: 'var(--color-border)',
          strokeWidth: 1.5,
          strokeDasharray: '4 4',
        }}
      />
      <EdgeLabelRenderer>
        <span
          aria-hidden
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-ink-secondary"
          style={{ left: sourceX, top: sourceY, transform: 'translate(-50%, -50%)' }}
        >
          <Pin strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: labelX, top: labelY }}
        />
      </EdgeLabelRenderer>
    </>
  );
});
