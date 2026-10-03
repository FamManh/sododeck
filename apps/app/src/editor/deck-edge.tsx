import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { BaseEdge, EdgeLabelRenderer, Position, type EdgeProps } from '@xyflow/react';
import type { Side } from '@sododeck/schema';
import { Ban, CircleAlert, TriangleAlert } from 'lucide-react';
import { memo } from 'react';

import { isFlowMode, useUiStore } from '../state/ui-store';
import type { DeckFlowEdge } from './deck-to-flow';
import { DOT_RADIUS } from './edge-constants';
import { FlowToken } from './flow-token';
import { StepBadge } from './flow-badges';
import { FLOW_STROKES } from './flow-strokes';
import { routedStepPath } from './routing/route-path';
import { SegmentHandle } from './routing/segment-handle';

/** The reverse of `deck-node.tsx`'s fixed handle positions, so a route's offset can be applied. */
const SIDE_OF_POSITION: Record<Position, Side> = {
  [Position.Top]: 'top',
  [Position.Right]: 'right',
  [Position.Bottom]: 'bottom',
  [Position.Left]: 'left',
};

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
  // The segment handle (017 R7, FR-012): pointer only, the single selected connector, never in
  // flow mode or recording, and only when it has a movable middle segment (routable, below).
  const showHandle = useUiStore(
    (s) =>
      selected === true &&
      !isFlowMode(s) &&
      s.flowSession === null &&
      s.selection.edges.length === 1 &&
      s.selection.nodes.length === 0 &&
      s.selection.groups.length === 0 &&
      s.selection.stickies.length === 0,
  );
  const sides: [Side, Side] = [SIDE_OF_POSITION[sourcePosition], SIDE_OF_POSITION[targetPosition]];
  // The automatic-route ghost (017 R7, T036): shown only while this edge's own segment is being
  // dragged, so the user can see where letting go without snapping would leave it.
  // A boolean, not the whole gesture: pans and zooms must not re-render every connector.
  const segmentGesture = useUiStore((s) => s.canvasGesture === 'segment');
  const dragging = segmentGesture && showHandle;
  // This edge's own end is being dragged to reconnect it (017 R12): drawn as a 40 % ghost while
  // the custom connection line shows the live path.
  const reconnecting = useUiStore((s) => s.reconnectingEdgeId === id);
  const { path, labelX, labelY, segment } = routedStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sides,
    offset: data?.route?.offset,
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
  // The automatic path (no route), computed only while dragging, to draw the ghost.
  const ghostPath = dragging
    ? routedStepPath({ sourceX, sourceY, targetX, targetY, sides, borderRadius: 8 }).path
    : null;
  // A recorded step shows its connection label next to its number, as in designs 42–46.
  const showLabel = (data?.showLabel === true || hasBadges) && Boolean(data?.label);
  const flowIcon = flow?.style === 'invalid' ? 'ban' : flow?.errorIcon === true ? 'alert' : null;
  const showFlowLabel = hasBadges || flowIcon !== null;
  // Problems (015 FR-022) show on the label pill, even with labels off.
  const problems = data?.problems;
  const current = flow?.current ?? null;
  const width = selected ? 2.5 : current !== null ? 3 : (flowStroke?.width ?? 1.5);

  return (
    <>
      {ghostPath !== null && (
        <path
          d={ghostPath}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeOpacity={0.4}
          aria-hidden
          data-testid="edge-route-ghost"
        />
      )}
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
        className={cn(
          flow?.style === 'invalid' && !reducedMotion && 'sd-edge-flash',
          reconnecting && 'sd-edge-reconnecting',
        )}
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
      {(showLabel || selected || flow !== undefined || problems !== undefined) && (
        <EdgeLabelRenderer>
          {/* Anchor for the edge and invalid-click popovers, at the label point. */}
          <div
            data-edge-anchor={id}
            className="pointer-events-none absolute size-px"
            style={{ transform: `translate(${String(labelX)}px, ${String(labelY)}px)` }}
          />
          {(showLabel || showFlowLabel || problems !== undefined) && (
            <span
              data-testid="edge-label"
              data-flow-style={flow?.style}
              data-in-flow={flow?.inPath === true ? '' : undefined}
              data-in-focus={data?.inFocus === true ? '' : undefined}
              data-current={current !== null ? '' : undefined}
              // The current step without color: filled label, token, and this for AT (007 FR-024).
              aria-current={current !== null ? 'step' : undefined}
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
              {problems !== undefined && (
                <span
                  data-testid="problem-glyph"
                  title={problems.titles}
                  className={cn('inline-flex text-amber-ink', !showLabel && !hasBadges && 'pl-1')}
                >
                  <TriangleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
                </span>
              )}
              {showLabel && data?.label}
            </span>
          )}
        </EdgeLabelRenderer>
      )}
      {showHandle && data?.routable === true && segment !== null && (
        <SegmentHandle
          edgeId={id}
          level={data.level}
          segment={segment}
          offset={data.route?.offset ?? 0}
        />
      )}
    </>
  );
});
