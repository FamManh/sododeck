import { Fragment, type ReactNode } from 'react';

import { animate, type Animated, type Timeline } from '../../../lib/landing/timeline';
import { flowSlot, type EdgeIndex, type FlowPlay } from './flow-play';
import { FlowToken } from './flow-token';
import { StepSticker } from './step-sticker';

/** The flow's moving token and the step stickers on each card it reaches. */
export function FlowLayerMarks({
  flow,
  byId,
  boxes,
  timeline,
}: {
  flow: FlowPlay;
  byId: EdgeIndex;
  boxes: ReadonlyMap<string, { x: number; y: number }>;
  timeline: Timeline | null;
}) {
  const count = flow.hops.length;
  const arrivals: (readonly [string, number, number])[] = [
    [flow.start.node, flow.start.n, flow.t0],
    ...flow.hops.map((hop, i) => [hop.node, hop.n, flowSlot(flow, i)[1]] as const),
  ];
  const at = (key: string, children: ReactNode, motion: Partial<Animated>, opacity: number) => {
    const box = boxes.get(key);
    if (box === undefined) return null;
    return (
      <div
        className={motion.className}
        style={{
          position: 'absolute',
          left: box.x,
          top: box.y,
          width: 0,
          height: 0,
          zIndex: 5,
          opacity,
          ...motion.style,
        }}
      >
        {children}
      </div>
    );
  };
  return (
    <>
      {flow.hops.map((hop, i) => {
        const laid = byId.get(hop.edge);
        if (laid === undefined) return null;
        const [a, b] = flowSlot(flow, i);
        const last = i === count - 1;
        const motion = animate(timeline, [
          [a, { opacity: 0, offsetDistance: '0%' }],
          [a + 0.01, { opacity: 1, offsetDistance: '0%' }, 'ease-in-out'],
          [b, { opacity: 1, offsetDistance: '100%' }],
          [b + 0.01, { opacity: last ? 1 : 0, offsetDistance: '100%' }],
        ]);
        return (
          <div
            key={`t${hop.edge}`}
            className={motion.className}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 0,
              height: 0,
              zIndex: 6,
              offsetPath: `path('${laid.d}')`,
              offsetRotate: '0deg',
              offsetAnchor: '0 0',
              offsetDistance: '100%',
              opacity: last ? 1 : 0,
              ...motion.style,
            }}
          >
            <FlowToken n={hop.n} />
          </div>
        );
      })}
      {arrivals.map(([key, n, arrive], i) => {
        const next = arrivals[i + 1]?.[2];
        const current =
          next === undefined
            ? animate(timeline, [
                [arrive, { opacity: 0 }],
                [arrive + 0.05, { opacity: 1 }],
              ])
            : animate(timeline, [
                [arrive, { opacity: 0 }],
                [arrive + 0.05, { opacity: 1 }],
                [next, { opacity: 1 }],
                [next + 0.05, { opacity: 0 }],
              ]);
        const played =
          next === undefined
            ? null
            : animate(timeline, [
                [next, { opacity: 0 }],
                [next + 0.05, { opacity: 1 }],
              ]);
        return (
          <Fragment key={`s${key}`}>
            {at(key, <StepSticker state="current" n={n} />, current, next === undefined ? 1 : 0)}
            {played !== null && at(key, <StepSticker state="played" n={n} />, played, 1)}
          </Fragment>
        );
      })}
    </>
  );
}
