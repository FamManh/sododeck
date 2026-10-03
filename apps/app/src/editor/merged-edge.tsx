import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ArrowRight, ArrowRightLeft, Ban, CircleAlert } from 'lucide-react';
import { BaseEdge, EdgeLabelRenderer, Position, type EdgeProps } from '@xyflow/react';
import type { Side } from '@sododeck/schema';
import { memo, useEffect, useRef } from 'react';

import { useUiStore } from '../state/ui-store';
import type { MergedFlowEdge } from './deck-to-flow';
import { StepBadge } from './flow-badges';
import { FlowToken } from './flow-token';
import { FLOW_STROKES, flowStrokeKey } from './flow-strokes';
import { EdgeEnds } from './edge-ends';
import { routedPath, type Box } from './routing/route-path';

/** The reverse of `deck-node.tsx`'s fixed handle positions (017). */
const SIDE_OF_POSITION: Record<Position, Side> = {
  [Position.Top]: 'top',
  [Position.Right]: 'right',
  [Position.Bottom]: 'bottom',
  [Position.Left]: 'left',
};

/** A zero-size box at a handle: React Flow hands over the side midpoints, which is all routing needs. */
const pointBox = (x: number, y: number): Box => ({ x, y, width: 0, height: 0 });

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
  const merged = data ?? {
    count: 0,
    direction: 'both',
    edgeIds: [],
    focused: false,
    inFocus: false,
  };
  const sides: [Side, Side] = [SIDE_OF_POSITION[sourcePosition], SIDE_OF_POSITION[targetPosition]];
  // Curved like a plain connector (029), with the same knob and arrow. The ends are one-way or
  // both: a "b to a" bundle is drawn from b so its arrow still lands on the right card.
  const reversed = merged.direction === 'b-to-a';
  const sourceBox = pointBox(sourceX, sourceY);
  const targetBox = pointBox(targetX, targetY);
  // A bundle made only of error-path steps ends in × instead of an arrow (035 FR-009).
  const errorEnd = merged.flow?.style === 'error';
  const arrows = { arrowAtStart: merged.direction === 'both', arrowAtEnd: !errorEnd };
  const { path, labelX, labelY, ends } = reversed
    ? routedPath('curved', targetBox, sourceBox, [sides[1], sides[0]], 0, arrows)
    : routedPath('curved', sourceBox, targetBox, sides, 0, arrows);
  const Icon = directionIcon(merged.direction);
  const flowStroke =
    merged.flow === undefined ? undefined : FLOW_STROKES[flowStrokeKey(merged.flow)];
  const stroke = flowStroke?.stroke ?? 'var(--sd-edge-hl-stroke, var(--color-deck-edge))';

  useEffect(
    () => () => {
      if (timer.current !== null) globalThis.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <>
      {merged.flow?.current != null && (
        <path
          d={path}
          fill="none"
          stroke="var(--color-deck-orange)"
          strokeWidth={8}
          strokeOpacity={0.18}
          aria-hidden
          pointerEvents="none"
          data-testid="edge-halo"
        />
      )}
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={12}
        style={{
          stroke,
          strokeWidth: flowStroke?.width ?? 'var(--sd-edge-hl-width, 2)',
          ...(flowStroke?.dash === undefined ? {} : { strokeDasharray: flowStroke.dash }),
          ...(flowStroke?.cap === undefined ? {} : { strokeLinecap: flowStroke.cap }),
        }}
      />
      <EdgeEnds
        {...ends}
        direction={merged.direction === 'both' ? 'both' : 'forward'}
        color={stroke}
        errorEnd={errorEnd}
      />
      {merged.flow?.current != null && (
        <FlowToken
          path={path}
          x={labelX}
          y={labelY}
          speed={merged.flow.current.speed}
          number={merged.flow.current.number}
        />
      )}
      <EdgeLabelRenderer>
        <button
          type="button"
          data-edge-anchor={id}
          data-testid="merged-edge-label"
          data-edge-label-for={id}
          data-in-flow={merged.flow?.inPath === true ? '' : undefined}
          data-step-state={merged.flow?.state}
          data-in-focus={merged.inFocus ? '' : undefined}
          className={cn(
            'merged-edge-label nodrag nopan absolute flex items-center gap-1 rounded-full border bg-surface py-0.5 pr-2 text-edge-label shadow-rest',
            merged.flow?.style === 'error'
              ? 'border-clay-ink bg-clay-soft text-clay-ink'
              : merged.flow?.current != null
                ? 'border-primary bg-primary text-on-primary'
                : merged.flow?.style === 'invalid'
                  ? 'border-dashed border-clay-ink text-clay-ink'
                  : merged.flow?.state !== undefined
                    ? 'border-border-strong text-ink-secondary'
                    : 'border-border text-ink-secondary',
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
          {merged.flow?.badges.map((badge) => (
            <StepBadge key={badge.label} badge={badge} />
          ))}
          {merged.flow?.style === 'invalid' && (
            <Ban
              role="img"
              aria-label="Can't add this edge"
              strokeWidth={ICON_STROKE_WIDTH}
              className="size-3.5"
            />
          )}
          {merged.flow?.errorIcon === true && merged.flow.badges.length === 0 && (
            <CircleAlert
              role="img"
              aria-label="Error path"
              strokeWidth={ICON_STROKE_WIDTH}
              className="size-3.5"
            />
          )}
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
