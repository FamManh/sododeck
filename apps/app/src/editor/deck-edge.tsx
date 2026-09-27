import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { Ban, CircleAlert } from 'lucide-react';
import { memo } from 'react';

import type { DeckFlowEdge } from './deck-to-flow';
import { FlowToken } from './flow-token';
import type { EdgeBadge, EdgeFlowStyle } from './flows/flow-overlay';

const DOT_RADIUS = 3;

/**
 * Stroke of a flow mark (006 research R6). Never color alone: error and invalid are dashed and
 * carry an icon, candidates and the preview are dotted.
 */
const FLOW_STROKES: Readonly<
  Record<EdgeFlowStyle, { stroke: string; width: number; dash?: string }>
> = {
  path: { stroke: 'var(--color-primary)', width: 2 },
  error: { stroke: 'var(--color-clay-ink)', width: 2, dash: '6 4' },
  candidate: { stroke: 'var(--color-primary)', width: 1.5, dash: '2 4' },
  preview: { stroke: 'var(--color-primary)', width: 2.5, dash: '2 4' },
  invalid: { stroke: 'var(--color-clay-ink)', width: 2, dash: '6 4' },
};

function StepBadge({ badge }: { badge: EdgeBadge }) {
  const error = badge.errorPath || badge.chainBreak;
  return (
    <span
      role="img"
      aria-label={`Step ${badge.label}${badge.errorPath ? ', error path' : ''}${badge.chainBreak ? ', chain break' : ''}`}
      className={cn(
        'flex h-4 min-w-4 items-center justify-center gap-0.5 rounded-full px-1 font-mono text-[10px] leading-none font-medium',
        error ? 'bg-clay-ink text-on-primary' : 'bg-primary text-on-primary',
        badge.current && 'ring-2 ring-primary ring-offset-1 ring-offset-surface',
      )}
    >
      {badge.errorPath && (
        <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-2.5" />
      )}
      {badge.label}
    </span>
  );
}

/**
 * Connection (DESIGN.md: orthogonal routing, 8px corners, 3px end dot; designs 11, 12, 57).
 * Direction is shown by the dots: at the target (forward), at both ends (both), none (none).
 * A flow mark (006) draws step badges and the path, error, candidate, preview or invalid style;
 * in flow mode (007) the current step's edge is thicker, with a filled label and the token.
 */
export const DeckEdge = memo(function DeckEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
  interactionWidth,
}: EdgeProps<DeckFlowEdge>) {
  const reducedMotion = useReducedMotion();
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });
  const direction = data?.direction ?? 'forward';
  const flow = data?.flow;
  const flowStroke = flow === undefined ? undefined : FLOW_STROKES[flow.style];
  const stroke = selected ? 'var(--color-primary)' : (flowStroke?.stroke ?? 'var(--color-edge)');
  const dots = [
    ...(direction === 'both' ? [{ x: sourceX, y: sourceY }] : []),
    ...(direction === 'none' ? [] : [{ x: targetX, y: targetY }]),
  ];
  const hasBadges = (flow?.badges.length ?? 0) > 0;
  // A recorded step shows its connection label next to its number, as in designs 42–46.
  const showLabel = (data?.showLabel === true || hasBadges) && Boolean(data?.label);
  const flowIcon = flow?.style === 'invalid' ? 'ban' : flow?.errorIcon === true ? 'alert' : null;
  const showFlowLabel = hasBadges || flowIcon !== null;
  const current = flow?.current ?? null;
  const width = selected ? 2.5 : current !== null ? 3 : (flowStroke?.width ?? 1.5);

  return (
    <>
      {data?.focused && (
        <path
          d={path}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={6}
          strokeDasharray="4 3"
          strokeOpacity={0.6}
          data-testid="edge-focus-ring"
        />
      )}
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={interactionWidth ?? 12}
        className={cn(flow?.style === 'invalid' && !reducedMotion && 'sd-edge-flash')}
        style={{
          stroke,
          strokeWidth: width,
          ...(flowStroke?.dash === undefined ? {} : { strokeDasharray: flowStroke.dash }),
        }}
      />
      {dots.map((dot) => (
        <circle
          key={`${String(dot.x)},${String(dot.y)}`}
          data-testid="edge-dot"
          cx={dot.x}
          cy={dot.y}
          r={DOT_RADIUS}
          fill={stroke}
        />
      ))}
      {current !== null && <FlowToken path={path} x={labelX} y={labelY} speed={current.speed} />}
      {(showLabel || selected || flow !== undefined) && (
        <EdgeLabelRenderer>
          {/* Anchor for the edge and invalid-click popovers, at the label point. */}
          <div
            data-edge-anchor={id}
            className="pointer-events-none absolute size-px"
            style={{ transform: `translate(${String(labelX)}px, ${String(labelY)}px)` }}
          />
          {(showLabel || showFlowLabel) && (
            <span
              data-testid="edge-label"
              data-flow-style={flow?.style}
              data-in-flow={flow?.inPath === true ? '' : undefined}
              data-current={current !== null ? '' : undefined}
              className={cn(
                'nodrag nopan absolute flex items-center gap-1 rounded-full border bg-surface py-0.5 font-mono text-edge-label whitespace-nowrap',
                // A flow mark lets clicks through to the edge, so recording works on the label.
                flow === undefined ? 'pointer-events-auto' : 'pointer-events-none',
                showLabel ? 'pr-2' : 'pr-0.5',
                hasBadges || flowIcon !== null ? 'pl-0.5' : 'pl-2',
                current !== null
                  ? cn(
                      'text-on-primary',
                      flow?.style === 'error'
                        ? 'border-dashed border-clay-ink bg-clay-ink'
                        : 'border-primary bg-primary',
                    )
                  : selected || flow?.style === 'path' || flow?.style === 'preview'
                    ? 'border-primary text-primary-ink'
                    : flow?.style === 'error' || flow?.style === 'invalid'
                      ? 'border-dashed border-clay-ink text-clay-ink'
                      : 'border-border text-ink-secondary',
              )}
              style={{
                transform: `translate(-50%, -50%) translate(${String(labelX)}px, ${String(labelY)}px)`,
              }}
            >
              {flow?.badges.map((badge) => (
                <StepBadge key={badge.label} badge={badge} />
              ))}
              {flowIcon === 'ban' && (
                <Ban
                  role="img"
                  aria-label="Can't add this edge"
                  strokeWidth={ICON_STROKE_WIDTH}
                  className="size-3.5"
                />
              )}
              {flowIcon === 'alert' && !hasBadges && (
                <CircleAlert
                  role="img"
                  aria-label="Error path"
                  strokeWidth={ICON_STROKE_WIDTH}
                  className="size-3.5"
                />
              )}
              {showLabel && data?.label}
            </span>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
});
