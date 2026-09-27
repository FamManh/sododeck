import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ArrowRight, ArrowRightLeft } from 'lucide-react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { memo, useEffect, useRef } from 'react';

import { useUiStore } from '../state/ui-store';
import type { MergedFlowEdge } from './deck-to-flow';

function directionIcon(direction: NonNullable<MergedFlowEdge['data']>['direction']) {
  return direction === 'both' ? ArrowRightLeft : ArrowRight;
}

function directionLabel(direction: NonNullable<MergedFlowEdge['data']>['direction']) {
  return direction === 'both' ? 'Both directions' : 'Forward direction';
}

export const MergedEdge = memo(function MergedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<MergedFlowEdge>) {
  const open = useUiStore((state) => state.openMergedPopover);
  const close = useUiStore((state) => state.closePopover);
  const timer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const merged = data ?? { count: 0, direction: 'both', edgeIds: [], focused: false };
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });
  const Icon = directionIcon(merged.direction);

  useEffect(
    () => () => {
      if (timer.current !== null) globalThis.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={12}
        style={{ stroke: 'var(--color-text-secondary)', strokeWidth: 2.25 }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          data-edge-anchor={id}
          data-testid="merged-edge-label"
          className={cn(
            'merged-edge-label nodrag nopan absolute flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-edge-label text-ink-secondary shadow-rest',
            merged.focused && 'ring-1 ring-primary',
          )}
          style={{
            transform: `translate(-50%, -50%) translate(${String(labelX)}px, ${String(labelY)}px)`,
          }}
          onMouseEnter={() => {
            if (timer.current !== null) globalThis.clearTimeout(timer.current);
            timer.current = globalThis.setTimeout(() => {
              open(id);
            }, 150);
          }}
          onMouseLeave={() => {
            if (timer.current !== null) globalThis.clearTimeout(timer.current);
            close();
          }}
          onClick={(event) => {
            event.stopPropagation();
            open(id);
          }}
        >
          <Icon
            role="img"
            aria-label={directionLabel(merged.direction)}
            strokeWidth={ICON_STROKE_WIDTH}
            className="size-3.5"
          />
          ×{merged.count}
        </button>
      </EdgeLabelRenderer>
    </>
  );
});
