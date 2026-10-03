import { DECK } from '../../../lib/landing/geometry';
import { animate, type Timeline } from '../../../lib/landing/timeline';
import { C } from '../../../lib/landing/tokens';
import { flowSlot, type EdgeIndex, type FlowPlay } from './flow-play';

/**
 * The flow's connector strokes: played hops in Secondary, the hop being played drawn in orange
 * from start to end. At rest only the last hop stays orange (the flow is complete).
 */
export function FlowLayerPaths({
  flow,
  byId,
  timeline,
  width,
  height,
}: {
  flow: FlowPlay;
  byId: EdgeIndex;
  timeline: Timeline | null;
  width: number;
  height: number;
}) {
  const playedWidth = DECK.edgeWidth + 0.5;
  const currentWidth = DECK.edgeWidth + 1.25;
  const count = flow.hops.length;
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      {(flow.played ?? []).map((id) => {
        const laid = byId.get(id);
        return laid === undefined ? null : (
          <path
            key={`p${id}`}
            d={laid.d}
            fill="none"
            stroke={C.inkSecondary}
            strokeWidth={playedWidth}
          />
        );
      })}
      {flow.hops.map((hop, i) => {
        const laid = byId.get(hop.edge);
        if (laid === undefined) return null;
        const [a, b] = flowSlot(flow, i);
        const last = i === count - 1;
        const played = animate(timeline, [
          [b, { opacity: 0 }],
          [b + 0.15, { opacity: 1 }],
        ]);
        const drawn = animate(
          timeline,
          last
            ? [
                [a, { strokeDashoffset: 1, opacity: 1 }],
                [b, { strokeDashoffset: 0, opacity: 1 }],
              ]
            : [
                [a, { strokeDashoffset: 1, opacity: 1 }],
                [b, { strokeDashoffset: 0, opacity: 1 }],
                [b + 0.15, { strokeDashoffset: 0, opacity: 0 }],
              ],
        );
        return (
          <g key={hop.edge}>
            {!last && (
              <path
                d={laid.d}
                fill="none"
                stroke={C.inkSecondary}
                strokeWidth={playedWidth}
                className={played.className}
                style={{ opacity: 1, ...played.style }}
              />
            )}
            <path
              d={laid.d}
              fill="none"
              stroke={C.primary}
              strokeWidth={currentWidth}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 1"
              className={drawn.className}
              style={{ strokeDashoffset: 0, opacity: last ? 1 : 0, ...drawn.style }}
            />
          </g>
        );
      })}
    </svg>
  );
}
