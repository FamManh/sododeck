import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { edgeLineStyle, type Geometry, type Severity } from '@sododeck/model';
import { BaseEdge, EdgeLabelRenderer, Position, type EdgeProps } from '@xyflow/react';
import type { Side } from '@sododeck/schema';
import { Ban, CircleAlert, CircleX, Lock, TriangleAlert } from 'lucide-react';
import { memo, useMemo } from 'react';

import { isFlowMode, useUiStore } from '../state/ui-store';
import { labelClamp, labelHalfWidth } from './editing/label-drag';
import { useThemeStore } from '../theme/theme-store';
import type { DeckFlowEdge } from './deck-to-flow';
import { EdgeEnds, RelationshipEndMarks } from './edge-ends';
import { relationshipGeometry } from './relationships/relationship-geometry';
import { FlowToken } from './flow-token';
import { StepBadge } from './flow-badges';
import { FLOW_STROKES, flowStrokeKey } from './flow-strokes';
import type { BendContext } from './editing/bend-drag';
import type { SegmentContext } from './editing/segment-drag';
import {
  anchorPoint,
  cardCentre,
  connectorPath,
  decodeWaypoints,
  labelPoint,
  offsetBends,
  samplePath,
} from './routing/connector-geometry';
import { withEndPreview } from './routing/end-override';
import { LabelHandle } from './routing/label-handle';
import { RelationshipEndHandles, RouteHandles } from './routing/route-handles';
import { outlinePoint } from './shapes/shape-geometry';
import type { Box, Point } from './routing/route-path';
import { lineCap, lineColour, lineDash } from './style/line-colour';

/** The reverse of `deck-node.tsx`'s fixed handle positions, so a route's offset can be applied. */
const SIDE_OF_POSITION: Record<Position, Side> = {
  [Position.Top]: 'top',
  [Position.Right]: 'right',
  [Position.Bottom]: 'bottom',
  [Position.Left]: 'left',
};

/** Distance between neighbouring connectors of a fanned-out bundle (034 R6). */
const FAN_SPACING = 14;

/** A zero-size box at a handle: React Flow hands over the side midpoints, which is all routing needs. */
const pointBox = (x: number, y: number): Box => ({ x, y, width: 0, height: 0 });

/**
 * The card's box from its handle (React Flow's live handle position) and its size. A shape's
 * handle sits on its outline (031), so the outline point's offset from the side midpoint is
 * taken back out first.
 */
function boxAt(
  handleX: number,
  handleY: number,
  side: Side,
  size: { width: number; height: number },
  geometry?: Geometry,
): Box {
  const { width, height } = size;
  let x = handleX;
  let y = handleY;
  if (geometry !== undefined) {
    const local = { x: 0, y: 0, width, height };
    const onOutline = outlinePoint(geometry, local, side);
    const midpoint = anchorPoint(local, side);
    x -= onOutline.x - midpoint.x;
    y -= onOutline.y - midpoint.y;
  }
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
const LINT_DASH = '6 4';

function lintStroke(severity: Severity | undefined): string | undefined {
  if (severity === undefined) return undefined;
  return severity === 'error' ? 'var(--color-clay-ink)' : 'var(--color-amber-ink)';
}

export const DeckEdge = memo(function DeckEdge({
  id,
  source,
  target,
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
  // One of this connector's ends while it is dragged (050 R3): drawn to the live attachment, over
  // a ghost of the route it had. Per-edge, like the bend preview.
  const endPreview = useUiStore((s) =>
    s.endpointPreview?.edgeId === id ? s.endpointPreview : null,
  );
  // The weight a dragged weight slider previews on this connector (050 R8). A number or null, so
  // other connectors do not re-render while it moves.
  const previewWidth = useUiStore((s) =>
    s.lineStylePreview?.edgeIds.includes(id) === true ? s.lineStylePreview.width : null,
  );
  const direction = data?.direction ?? 'forward';
  const route = data?.route;
  // Bends and anchors need the real cards (their centres and sides); everything else only needs
  // the handle points, so a connector without them draws exactly as before.
  // A relationship (042) always needs them: its ends sit on rows of the live boxes.
  const rel = data?.rel;
  // Problems (015 FR-022) show on the label pill, even with labels off.
  const problems = data?.problems;
  const needsBoxes =
    rel !== undefined ||
    (route?.waypoints?.length ?? 0) > 0 ||
    route?.fromAt !== undefined ||
    route?.toAt !== undefined;
  // A segment drag of an end run slides that end along its side (050 R7): the preview carries the
  // live `at`, drawn on top of the stored route, on the real boxes.
  const previewFromAt = preview?.fromAt;
  const previewToAt = preview?.toAt;
  const previewSlides = previewFromAt !== undefined || previewToAt !== undefined;
  const liveRoute = previewSlides
    ? {
        ...route,
        ...(previewFromAt === undefined ? {} : { fromAt: previewFromAt }),
        ...(previewToAt === undefined ? {} : { toAt: previewToAt }),
      }
    : route;
  const sized =
    (needsBoxes || endPreview !== null || previewSlides) &&
    data?.fromSize !== undefined &&
    data.toSize !== undefined;
  const fromBox =
    sized && data.fromSize !== undefined
      ? boxAt(sourceX, sourceY, sides[0], data.fromSize, data.fromGeometry)
      : pointBox(sourceX, sourceY);
  const toBox =
    sized && data.toSize !== undefined
      ? boxAt(targetX, targetY, sides[1], data.toSize, data.toGeometry)
      : pointBox(targetX, targetY);
  // Shape ends (031) follow the outline; only real boxes carry a geometry (a handle point is
  // already on the outline).
  const endShapes = sized ? { fromGeometry: data.fromGeometry, toGeometry: data.toGeometry } : {};
  // An error path ends in × instead of an arrow (035 FR-009).
  const flow = data?.flow;
  const errorEnd = flow?.style === 'error';
  // The line stops one arrow short of an end that carries an arrow (029 R6).
  const arrows = {
    arrowAtStart: direction === 'both',
    arrowAtEnd: direction !== 'none' && !errorEnd,
  };
  const shape = data?.shape ?? 'curved';
  // The fan-out shift of a bundled connector (034 R6), none while an end is dragged.
  const spread =
    endPreview !== null || data?.fan === undefined
      ? 0
      : (data.fan.index - (data.fan.count - 1) / 2) * FAN_SPACING;
  // The connector with its dragged end swapped in (FR-013); null outside an end drag.
  const drawn =
    endPreview === null || !sized
      ? null
      : withEndPreview(
          {
            fromBox,
            toBox,
            sides,
            route,
            fromGeometry: data.fromGeometry,
            toGeometry: data.toGeometry,
          },
          endPreview,
          { source, target },
        );
  const drawnFrom = drawn?.fromBox ?? fromBox;
  const drawnTo = drawn?.toBox ?? toBox;
  // A relationship (042) draws from its row anchors with stubs and crow's feet, sides chosen
  // live from the boxes so they follow a dragged table (R3).
  const relGeometry =
    rel === undefined
      ? null
      : relationshipGeometry({
          ...rel,
          fromBox,
          toBox,
          shape,
          sides,
          route,
          spread,
          bends:
            preview?.bends ??
            (route?.waypoints === undefined
              ? []
              : decodeWaypoints(route.waypoints, cardCentre(fromBox), cardCentre(toBox))),
        });
  const {
    path,
    labelX: pathLabelX,
    labelY: pathLabelY,
    segment,
    ends,
  } = relGeometry === null
    ? connectorPath({
        shape,
        fromBox: drawnFrom,
        toBox: drawnTo,
        sides: drawn?.sides ?? sides,
        route: drawn === null ? liveRoute : drawn.route,
        bends: preview?.bends,
        options: arrows,
        ...(drawn === null
          ? endShapes
          : { fromGeometry: drawn.fromGeometry, toGeometry: drawn.toGeometry }),
        spread: drawn === null ? spread : 0,
      })
    : {
        path: relGeometry.path,
        labelX: relGeometry.label.x,
        labelY: relGeometry.label.y,
        segment: null,
        ends: {
          start: relGeometry.start,
          end: relGeometry.end,
          startDir: { x: 1, y: 0 },
          endDir: { x: 1, y: 0 },
        },
      };
  const flowStroke = flow === undefined ? undefined : FLOW_STROKES[flowStrokeKey(flow)];
  // Precedence (022 R12): selected > flow / error / candidate strokes > the connector's own
  // colour, dash and weight > the defaults. A colour never carries a state alone. A plain
  // connector reads its colour and width through the highlight variables (034 R2), so a focus rule
  // can light it without a React Flow update; one with its own colour keeps it (022 FR-024) and
  // only takes the highlight weight.
  const stored = edgeLineStyle({ style: data?.style });
  const own = previewWidth === null ? stored : { ...stored, width: previewWidth };
  // A relationship with a lint problem (047) is dashed in its severity colour, unless a flow or the
  // selection owns the stroke; the pill then names the problem in a few characters.
  const lint = rel !== undefined && problems !== undefined && flow === undefined ? problems : null;
  const stroke = selected
    ? 'var(--color-deck-orange)'
    : (lintStroke(lint?.severity) ??
      flowStroke?.stroke ??
      (own.color === null
        ? 'var(--sd-edge-hl-stroke, var(--color-deck-edge))'
        : lineColour(own.color, theme)));
  const hasBadges = (flow?.badges.length ?? 0) > 0;
  // The route as it was before this bend or end gesture, computed only while dragging, for the
  // ghost.
  const ghostPath =
    (dragging || drawn !== null) && relGeometry === null
      ? connectorPath({ shape, fromBox, toBox, sides, route, options: arrows, ...endShapes }).path
      : null;
  // The bends the handles sit on: the stored ones, or a 017 offset's two corners (R3).
  const bends: Point[] =
    route?.waypoints !== undefined && sized
      ? decodeWaypoints(route.waypoints, cardCentre(drawnFrom), cardCentre(drawnTo))
      : shape === 'elbow' && segment !== null && data?.routable === true
        ? offsetBends(segment, ends.start)
        : [];
  // Bends are stored relative to the card centres, so a connector still drawn between its handle
  // points (no bends or pins yet) hands over its real boxes' centres too; the handle points would
  // make a new bend land away from where it was released (050 US1).
  const centreFrom =
    sized || data?.fromSize === undefined
      ? drawnFrom
      : boxAt(sourceX, sourceY, sides[0], data.fromSize, data.fromGeometry);
  const centreTo =
    sized || data?.toSize === undefined
      ? drawnTo
      : boxAt(targetX, targetY, sides[1], data.toSize, data.toGeometry);
  const bendContext: BendContext = {
    edgeId: id,
    fromCentre: cardCentre(centreFrom),
    toCentre: cardCentre(centreTo),
    start: ends.start,
    end: ends.end,
    bends,
  };
  // An elbow's segment handles (050 R7) need both real boxes and the ends as drawn. An automatic
  // route hands over no bends, so sliding an end keeps it automatic; a fanned one hands over its
  // drawn corners, so the handles sit on the line it shows.
  const segmentContext: SegmentContext | undefined =
    shape === 'elbow' &&
    showHandle &&
    data?.routable === true &&
    data.fromSize !== undefined &&
    data.toSize !== undefined
      ? {
          ...bendContext,
          bends:
            route?.waypoints !== undefined || (route?.offset ?? 0) !== 0 || spread !== 0
              ? bends
              : [],
          fromBox: sized
            ? drawnFrom
            : boxAt(sourceX, sourceY, sides[0], data.fromSize, data.fromGeometry),
          toBox: sized ? drawnTo : boxAt(targetX, targetY, sides[1], data.toSize, data.toGeometry),
          fromSide: sides[0],
          toSide: sides[1],
          fromAt: liveRoute?.fromAt ?? 0.5,
          toAt: liveRoute?.toAt ?? 0.5,
        }
      : undefined;
  // A relationship drawn on its rows (064 US3) is reshaped between its two stub tips like a card
  // connector: bends and midpoints on a curve, segment handles on an elbow. Its ends stay on their
  // rows (the end handles below move them to another row), so there are no anchor handles; a
  // straight line or a self-reference loop has nothing to reshape.
  const relStubs = relGeometry?.stubs;
  const relSides = relGeometry?.sides;
  const relContext: BendContext | null =
    rel?.rows === true && !rel.self && relStubs !== undefined && sized
      ? {
          edgeId: id,
          fromCentre: cardCentre(fromBox),
          toCentre: cardCentre(toBox),
          start: relStubs.from,
          end: relStubs.to,
          bends:
            route?.waypoints === undefined
              ? []
              : decodeWaypoints(route.waypoints, cardCentre(fromBox), cardCentre(toBox)),
        }
      : null;
  const relSegment: SegmentContext | undefined =
    relContext !== null && relSides !== undefined && shape === 'elbow'
      ? {
          ...relContext,
          mode: 'relationship',
          fromBox,
          toBox,
          fromSide: relSides.from,
          toSide: relSides.to,
          fromAt: 0.5,
          toAt: 0.5,
        }
      : undefined;
  // A recorded step shows its connection label next to its number, as in designs 42–46.
  const showLabel = (data?.showLabel === true || hasBadges) && Boolean(data?.label);
  // A hover-only relationship label (042 R10): drawn, but hidden by CSS until the line is lit.
  const hoverLabel = !showLabel && data?.hoverLabel === true && Boolean(data.label);
  // The lock is a mark, not a colour, and shows even on a connector without a label (053).
  const locked = data?.locked === true;
  const flowIcon = flow?.style === 'invalid' ? 'ban' : flow?.errorIcon === true ? 'alert' : null;
  const showFlowLabel = hasBadges || flowIcon !== null;
  const current = flow?.current ?? null;
  // A selected connector keeps its own weight (050 FR-015): the colour and the halo show the
  // selection, so a weight change is visible while it is edited.
  const width = selected
    ? own.width
    : (flowStroke?.width ?? `var(--sd-edge-hl-width, ${String(own.width)})`);
  const ownDash =
    lint !== null && selected !== true
      ? LINT_DASH
      : flowStroke === undefined
        ? lineDash(own.dash, own.width)
        : undefined;
  // Moving dashes (022 R11): only when asked for, not under reduced motion, not while a flow is
  // shown or recorded, and not on the selected connector, whose look is the selection's.
  const flowActive = useUiStore((s) => isFlowMode(s) || s.flowSession !== null);
  const animate =
    own.animated && !reducedMotion && !flowActive && selected !== true && flow === undefined;
  // One dash period in px: the run overlay's 3w + 5w, or the line's own dash pattern.
  const period =
    own.dash === 'solid' ? 8 * own.width : own.dash === 'dashed' ? 7.5 * own.width : 3 * own.width;
  const runStyle = {
    '--sd-run': `${String(period)}px`,
    animationDuration: `${String(period / 24)}s`,
  };
  const ownCap = flowStroke === undefined ? lineCap(own.dash) : undefined;
  // The step label (FR-010): a 20px pill. In flow mode (a `state` is set) it is neutral, solid
  // orange when current and Clay Soft on an error path; while recording it keeps the path look.
  const isPill = hasBadges || flowIcon !== null;
  const playing = flow?.state !== undefined;
  const errorLabel = flow?.style === 'error' || flow?.style === 'invalid';

  // The label sits at `labelAt` along the drawn line (022 R10); unset, at the line's middle.
  const labelAt = data?.labelAt;
  const previewAt = useUiStore((s) => (s.labelPreview?.edgeId === id ? s.labelPreview.at : null));
  const labelEditable = showLabel && showHandle && flow === undefined && data?.routable === true;
  const wantSamples = labelAt !== undefined || previewAt !== null || labelEditable;
  const samples = useMemo(() => (wantSamples ? samplePath(path) : null), [wantSamples, path]);
  const badgeCount = flow?.badges.length ?? 0;
  const pillClamp = labelClamp(data?.label ?? null, badgeCount);
  const placedAt = previewAt ?? labelAt;
  const labelSpot =
    samples !== null && placedAt !== undefined
      ? labelPoint(samples, placedAt, pillClamp)
      : { x: pathLabelX, y: pathLabelY };
  const labelX = labelSpot.x;
  const labelY = labelSpot.y;

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
      {selected === true && (
        <path
          d={path}
          fill="none"
          stroke="var(--color-primary-soft)"
          strokeWidth={own.width + 6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          pointerEvents="none"
          data-testid="edge-selection-halo"
        />
      )}
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={interactionWidth ?? 12}
        className={cn(
          animate && own.dash !== 'solid' && 'sd-edge-run',
          flow?.style === 'invalid' && !reducedMotion && 'sd-edge-flash',
        )}
        style={{
          stroke,
          strokeWidth: width,
          ...(flowStroke?.dash === undefined ? {} : { strokeDasharray: flowStroke.dash }),
          ...(flowStroke?.cap === undefined ? {} : { strokeLinecap: flowStroke.cap }),
          ...(ownDash === undefined ? {} : { strokeDasharray: ownDash }),
          ...(ownCap === undefined ? {} : { strokeLinecap: ownCap }),
          ...(animate && own.dash === 'solid' ? { strokeOpacity: 0.32 } : {}),
          ...(animate && own.dash !== 'solid' ? runStyle : {}),
        }}
      />
      {animate &&
        own.dash === 'solid' &&
        (direction === 'both' ? [false, true] : [false]).map((reverse) => (
          <path
            key={String(reverse)}
            d={path}
            fill="none"
            stroke={stroke}
            strokeWidth={width}
            strokeDasharray={`${String(3 * own.width)} ${String(5 * own.width)}`}
            className={cn('sd-edge-run', reverse && 'sd-edge-run-reverse')}
            style={runStyle}
            pointerEvents="none"
            aria-hidden
            data-testid="edge-run"
          />
        ))}
      {relGeometry === null ? (
        <EdgeEnds
          {...ends}
          direction={direction}
          color={stroke}
          errorEnd={errorEnd}
          scale={markScale(own.width)}
        />
      ) : (
        <>
          {relGeometry.bracket !== '' && (
            <path
              d={relGeometry.bracket}
              fill="none"
              stroke={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeWidth: width }}
              pointerEvents="none"
              data-testid="relationship-bracket"
            />
          )}
          <RelationshipEndMarks marks={relGeometry.marks} color={stroke} width={width} />
        </>
      )}
      {current !== null && (
        <FlowToken
          path={path}
          x={pathLabelX}
          y={pathLabelY}
          speed={current.speed}
          number={current.number}
        />
      )}
      {(showLabel ||
        hoverLabel ||
        selected ||
        flow !== undefined ||
        problems !== undefined ||
        locked) && (
        <EdgeLabelRenderer>
          {/* Anchor for the edge and invalid-click popovers, at the label point. */}
          <div
            data-edge-anchor={id}
            className="pointer-events-none absolute size-px"
            style={{ transform: `translate(${String(labelX)}px, ${String(labelY)}px)` }}
          />
          {(showLabel || hoverLabel || showFlowLabel || problems !== undefined || locked) && (
            <span
              data-testid="edge-label"
              data-edge-label-for={id}
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
                isPill ? 'px-2' : showLabel || hoverLabel ? 'pr-2 pl-2' : 'pr-0.5 pl-2',
                labelLook(),
                hoverLabel && 'sd-rel-hover-label',
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
              {lint?.short !== undefined ? (
                <span
                  data-testid="problem-short"
                  data-severity={lint.severity}
                  title={lint.titles}
                  className={cn(
                    'inline-flex items-center gap-1 font-mono text-[11px] leading-none font-semibold',
                    lint.severity === 'error' ? 'text-clay-ink' : 'text-amber-ink',
                    !showLabel && !hasBadges && 'pl-1',
                  )}
                >
                  {lint.severity === 'error' ? (
                    <CircleX aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
                  ) : (
                    <TriangleAlert
                      aria-hidden
                      strokeWidth={ICON_STROKE_WIDTH}
                      className="size-3.5"
                    />
                  )}
                  {lint.short}
                </span>
              ) : (
                problems !== undefined && (
                  <span
                    data-testid="problem-glyph"
                    title={problems.titles}
                    className={cn('inline-flex text-amber-ink', !showLabel && !hasBadges && 'pl-1')}
                  >
                    <TriangleAlert
                      aria-hidden
                      strokeWidth={ICON_STROKE_WIDTH}
                      className="size-3.5"
                    />
                  </span>
                )
              )}
              {locked && (
                <Lock
                  role="img"
                  aria-label="Locked"
                  strokeWidth={ICON_STROKE_WIDTH}
                  className="size-3 text-ink-secondary"
                />
              )}
              {(showLabel || hoverLabel) && data?.label}
            </span>
          )}
        </EdgeLabelRenderer>
      )}
      {labelEditable && samples !== null && (
        <LabelHandle
          edgeId={id}
          text={data.label ?? ''}
          at={labelAt ?? 0.5}
          samples={samples}
          clamp={pillClamp}
          width={labelHalfWidth(data.label ?? null, badgeCount) * 2}
          rest={{ x: labelX, y: labelY }}
        />
      )}
      {showHandle &&
        rel?.rows === true &&
        relGeometry?.sides !== undefined &&
        rel.columns.from.length > 0 &&
        rel.columns.to.length > 0 && (
          <RelationshipEndHandles
            edgeId={id}
            from={{
              at: relGeometry.start,
              tableId: source,
              columns: rel.columns.from,
              side: relGeometry.sides.from,
            }}
            to={{
              at: relGeometry.end,
              tableId: target,
              columns: rel.columns.to,
              side: relGeometry.sides.to,
            }}
          />
        )}
      {showHandle && data?.routable === true && relContext !== null && (
        <RouteHandles
          context={relContext}
          {...(relSegment === undefined ? {} : { segment: relSegment })}
        />
      )}
      {showHandle && data?.routable === true && rel === undefined && (
        <RouteHandles
          context={bendContext}
          anchors={{
            fromSide: sides[0],
            fromAt: route?.fromAt ?? 0.5,
            toSide: sides[1],
            toAt: route?.toAt ?? 0.5,
          }}
          ends={{
            source,
            target,
            fromSide: route?.fromSide,
            fromAt: route?.fromAt,
            toSide: route?.toSide,
            toAt: route?.toAt,
          }}
          // A straight line has no bends: only its two ends (050 contract UI).
          bendable={shape !== 'straight'}
          {...(segmentContext === undefined ? {} : { segment: segmentContext })}
        />
      )}
    </>
  );
});
