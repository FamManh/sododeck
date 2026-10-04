import type { Breakpoint } from '../../lib/landing/breakpoint';
import { SEQUENCE, WORLD } from '../../lib/landing/checkout-deck';
import { FLOW_CROP, ORDERS_CROP } from '../../lib/landing/crops';
import { Timeline } from '../../lib/landing/timeline';
import { DeckScene } from './deck/deck-scene';
import { StepPlayer } from './deck/step-player';
import { Viewport } from './deck/viewport';
import { Stage } from './stage';

/** Frame, world offset and player placement per breakpoint (design board `FC`). */
// Fluid frames centre the world and the player, so wider tablets and phones add canvas evenly.
const LAYOUT: Record<
  Breakpoint,
  {
    w: number | string;
    h: number;
    s: number;
    ox: number | string;
    oy: number;
    px: number | string;
    py: number;
    pw: number;
  }
> = {
  desktop: { w: 696, h: 520, s: 0.7, ox: 4 - 84 * 0.7, oy: 4, px: 48, py: 396, pw: 520 },
  tablet: {
    w: '100%',
    h: 520,
    s: 0.7,
    ox: 'calc(50% - 400.4px)',
    oy: 4,
    px: 'calc(50% - 260px)',
    py: 396,
    pw: 520,
  },
  phone: {
    w: '100%',
    h: 540,
    s: 0.78,
    ox: 'calc(50% - 164px)',
    oy: 6,
    px: 'calc(50% - 159px)',
    py: 378,
    pw: 318,
  },
};

/**
 * Step 3 · Flows: Checkout plays once from Order Service (steps 3–8 here, 3–5 on phones), the deck
 * dealing each step while the player follows; the failed-payment branch stays in clay. The player
 * seeks: previous / next step, a step's segment, play / pause.
 */
export function FlowsVisual({ breakpoint }: { breakpoint: Breakpoint }) {
  const phone = breakpoint === 'phone';
  const layout = LAYOUT[breakpoint];
  const tl = new Timeline(5.4, false);
  const world = phone ? ORDERS_CROP : { ...FLOW_CROP, width: WORLD.w, height: WORLD.h };
  const times = phone ? [null, null, 0, 1.5, 2.4] : [null, null, 0, 1.5, 2.4, 3.3, 4.2, 5.1];
  return (
    <Stage timeline={tl} replay={phone ? 'top' : 'bottom'} steps={times}>
      <Viewport
        width={layout.w}
        height={layout.h}
        scale={layout.s}
        offsetX={layout.ox}
        offsetY={layout.oy}
        worldWidth={world.width}
        worldHeight={world.height}
        label={
          phone
            ? 'Flow Checkout playing through the Orders group: API Gateway to Order Service, Orders DB, then Payment Service.'
            : 'Flow Checkout played to its last step: Order Service, Orders DB, Payment Service, Payment Provider, order.placed and Shipping Service; a failed payment retries three times, then cancels the order.'
        }
        over={
          <StepPlayer
            x={layout.px}
            y={layout.py}
            width={layout.pw}
            current={phone ? 4 : 7}
            shown={phone ? [2, 3, 4] : [2, 3, 4, 5, 6, 7]}
            times={times}
            compact={phone}
            timeline={tl}
          />
        }
      >
        <DeckScene
          nodes={world.nodes}
          edges={world.edges}
          frames={world.frames}
          width={world.width}
          height={world.height}
          timeline={tl}
          flow={{
            start: { node: 'svc', n: 3 },
            hops: phone ? SEQUENCE.slice(2, 4) : SEQUENCE.slice(2),
            t0: 0.6,
            step: 0.9,
            played: ['2'],
          }}
        />
      </Viewport>
    </Stage>
  );
}
