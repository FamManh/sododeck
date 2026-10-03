import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { edgeLineStyle } from '@sododeck/model';
import { BaseEdge, EdgeLabelRenderer, Position, type EdgeProps } from '@xyflow/react';
import type { Side } from '@sododeck/schema';
import { Ban, CircleAlert, TriangleAlert } from 'lucide-react';
import { memo } from 'react';

import { isFlowMode, useUiStore } from '../state/ui-store';
import { useThemeStore } from '../theme/theme-store';
import type { DeckFlowEdge } from './deck-to-flow';
import { EdgeEnds } from './edge-ends';
import { FlowToken } from './flow-token';
import { StepBadge } from './flow-badges';
import { FLOW_STROKES, flowStrokeKey } from './flow-strokes';
import type { BendContext } from './editing/bend-drag';
import {
  cardCentre,
  connectorPath,
  decodeWaypoints,
  offsetBends,
} from './routing/connector-geometry';
import { RouteHandles } from './routing/route-handles';
import type { Box, Point } from './routing/route-path';
import { lineCap, lineColour, lineDash } from './style/line-colour';

/** The reverse of `deck-node.tsx`'s fixed handle positions, so a route's offset can be applied. */
const SIDE_OF_POSITION: Record<Position, Side> = {
  [Position.Top]: 'top',
  [Position.Right]: 'right',
  [Position.Bottom]: 'bottom',
  [Position.Left]: 'left',
};

/** A zero-size box at a handle: React Flow hands over the side midpoints, which is all routing needs. */
const pointBox = (x: number, y: number): Box => ({ x, y, width: 0, height: 0 });

/** The card's box from its side midpoint (React Flow's live handle position) and its size. */
function boxAt(x: number, y: number, side: Side, size: { width: number; height: number }): Box {
  const { width, height } = size;
  switch (side) {
    case 'top':
      return { x: x - width / 2, y, width, height };
    case 'bottom':
      return { x: x - width / 2, y: y - height, width, height };
    case 'left':
      return { x, y: y - height / 2, width, height };
    case 'right':
      return { x: x - width, y: y - height / 2, width, height };
  }
}

/** Knob and arrow grow a quarter per px above the default weight (frame 133). */
const markScale = (width: number): number => (width > 2 ? 1 + (width - 2) * 0.25 : 1);

/**
 * Connection (DESIGN.md "Card system (Deck)": 2 px line, knob at the start and arrow at the end).
 * Direction is shown by the end marks: knob → arrow (forward), arrows at both ends (both), knobs
 * at both ends (none). The line is curved, elbow or straight (029); only elbow has a movable middle
 * segment.
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
  const theme = useThemeStore((s) => s.theme);
  // The route handles (022): the single selected connector, never in flow mode or recording.
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
  // The live bends of this connector while one is dragged (022); the ghost of the route it had
  // before is drawn under them. A boolean-ish selector: pans and zooms must not re-render every
  // connector, and other connectors' drags are null here.
  const preview = useUiStore((s) => (s.bendPreview?.edgeId === id ? s.bendPreview : null));
  const dragging = preview !== null && showHandle;
  // This edge's own end is being dragged to reconnect it (017 R12): drawn as a 40 % ghost while
  // the custom connection line shows the live path.
  const reconnecting = useUiStore((s) => s.reconnectingEdgeId === id);
  const direction = data?.direction ?? 'forward';
  const route = data?.route;
  // Bends and anchors need the real cards (their centres and sides); everything else only needs
  // the handle points, so a connector without them draws exactly as before.
  const needsBoxes =
    (route?.waypoints?.length ?? 0) > 0 || route?.fromAt !== undefined || route?.toAt !== undefined;
  const sized = needsBoxes && data?.fromSize !== undefined && data.toSize !== undefined;
  const fromBox =
    sized && data.fromSize !== undefined
      ? boxAt(sourceX, sourceY, sides[0], data.fromSize)
      : pointBox(sourceX, sourceY);
  const toBox =
    sized && data.toSize !== undefined
      ? boxAt(targetX, targetY, sides[1], data.toSize)
      : pointBox(targetX, targetY);
  // An error path ends in × instead of an arrow (035 FR-009).
  const flow = data?.flow;
  const errorEnd = flow?.style === 'error';
  // The line stops one arrow short of an end that carries an arrow (029 R6).
  const arrows = {
    arrowAtStart: direction === 'both',
    arrowAtEnd: direction !== 'none' && !errorEnd,
  };
  const shape = data?.shape ?? 'curved';
  const { path, labelX, labelY, segment, ends } = connectorPath({
    shape,
    fromBox,
    toBox,
    sides,
    route,
    bends: preview?.bends,
    options: arrows,
  });
  const flowStroke = flow === undefined ? undefined : FLOW_STROKES[flowStrokeKey(flow)];
  // Precedence (022 R12): selected > flow / error / candidate strokes > the connector's own
  // colour, dash and weight > the defaults. A colour never carries a state alone.
  const own = edgeLineStyle({ style: data?.style });
  const stroke = selected
    ? 'var(--color-deck-orange)'
    : (flowStroke?.stroke ?? lineColour(own.color, theme));
  const hasBadges = (flow?.badges.length ?? 0) > 0;
  // The route as it was before this bend gesture, computed only while dragging, for the ghost.
  const ghostPath = dragging
    ? connectorPath({ shape, fromBox, toBox, sides, route, options: arrows }).path
    : null;
  // The bends the handles sit on: the stored ones, or a 017 offset's two corners (R3).
  const bends: Point[] =
    route?.waypoints !== undefined && sized
      ? decodeWaypoints(route.waypoints, cardCentre(fromBox), cardCentre(toBox))
      : shape === 'elbow' && segment !== null && data?.routable === true
        ? offsetBends(segment, ends.start)
        : [];
  const bendContext: BendContext = {
    edgeId: id,
    fromCentre: cardCentre(fromBox),
    toCentre: cardCentre(toBox),
    start: ends.start,
    end: ends.end,
    bends,
  };
  // A recorded step shows its connection label next to its number, as in designs 42–46.
  const showLabel = (data?.showLabel === true || hasBadges) && Boolean(data?.label);
  const flowIcon = flow?.style === 'invalid' ? 'ban' : flow?.errorIcon === true ? 'alert' : null;
  const showFlowLabel = hasBadges || flowIcon !== null;
  // Problems (015 FR-022) show on the label pill, even with labels off.
  const problems = data?.problems;
  const current = flow?.current ?? null;
  const width = selected ? 2.5 : (flowStroke?.width ?? own.width);
  const ownDash = flowStroke === undefined ? lineDash(own.dash, own.width) : undefined;
  const ownCap = flowStroke === undefined ? lineCap(own.dash) : undefined;
  // The step label (FR-010): a 20px pill. In flow mode (a `state` is set) it is neutral, solid
  // orange when current and Clay Soft on an error path; while recording it keeps the path look.
  const isPill = hasBadges || flowIcon !== null;
  const playing = flow?.state !== undefined;
  const errorLabel = flow?.style === 'error' || flow?.style === 'invalid';

  /** Fill, border and text of the label (FR-010). */
  function labelLook(): string {
    if (flow?.style === 'error' && isPill) {
      // Clay Soft keeps the error identity even on the current step, which adds an orange ring.
      return cn(
        'border-clay-ink bg-clay-soft text-clay-ink',
        current !== null && 'ring-2 ring-primary',
      );
    }
    if (current !== null) return 'border-primary bg-primary text-on-primary';
    if (errorLabel) return 'border-dashed border-clay-ink text-clay-ink';
    if (isPill && playing) return 'border-border-strong text-ink-secondary';
    return selected || flow?.style === 'path' || flow?.style === 'preview'
      ? 'border-primary text-primary-ink'
      : 'border-border text-ink-secondary';
  }

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
      {current !== null && (
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
        interactionWidth={interactionWidth ?? 12}
        className={cn(
          flow?.style === 'invalid' && !reducedMotion && 'sd-edge-flash',
          reconnecting && 'sd-edge-reconnecting',
        )}
        style={{
          stroke,
          strokeWidth: width,
          ...(flowStroke?.dash === undefined ? {} : { strokeDasharray: flowStroke.dash }),
          ...(flowStroke?.cap === undefined ? {} : { strokeLinecap: flowStroke.cap }),
          ...(ownDash === undefined ? {} : { strokeDasharray: ownDash }),
          ...(ownCap === undefined ? {} : { strokeLinecap: ownCap }),
        }}
      />
      <EdgeEnds
        {...ends}
        direction={direction}
        color={stroke}
        errorEnd={errorEnd}
        scale={markScale(own.width)}
      />
      {current !== null && (
        <FlowToken
          path={path}
          x={labelX}
          y={labelY}
          speed={current.speed}
          number={current.number}
        />
      )}
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
              data-step-state={flow?.state}
              // The current step without color: filled label, token, and this for AT (007 FR-024).
              aria-current={current !== null ? 'step' : undefined}
              className={cn(
                'nodrag nopan absolute flex items-center gap-1 rounded-full bg-surface font-mono whitespace-nowrap',
                isPill
                  ? 'h-5 border-[1.5px] text-[11px] leading-none font-semibold'
                  : 'border py-0.5 text-edge-label',
                // A flow mark lets clicks through to the edge, so recording works on the label.
                flow === undefined ? 'pointer-events-auto' : 'pointer-events-none',
                isPill ? 'px-2' : showLabel ? 'pr-2 pl-2' : 'pr-0.5 pl-2',
                labelLook(),
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
      {showHandle && shape !== 'straight' && data?.routable === true && (
        <RouteHandles
          context={bendContext}
          anchors={{
            fromSide: sides[0],
            fromAt: route?.fromAt ?? 0.5,
            toSide: sides[1],
            toAt: route?.toAt ?? 0.5,
          }}
        />
      )}
    </>
  );
});
