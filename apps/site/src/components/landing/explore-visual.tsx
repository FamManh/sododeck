import { Focus } from 'lucide-react';

import type { Breakpoint } from '../../lib/landing/breakpoint';
import {
  ALL_EDGES,
  ALL_FRAMES,
  ALL_NODES,
  FRAMES,
  NODES,
  WORLD,
} from '../../lib/landing/checkout-deck';
import { ORDERS_CROP, PAYMENTS_DRILL, PAYMENTS_DRILL_PHONE } from '../../lib/landing/crops';
import type { EdgeState } from '../../lib/landing/scene';
import { C } from '../../lib/landing/tokens';
import type { CardState } from './deck/deck-card';
import { CanvasPill } from './deck/canvas-pill';
import { Crumb } from './deck/crumb';
import { DeckScene } from './deck/deck-scene';
import { Viewport } from './deck/viewport';
import { ZoomLabel } from './deck/zoom-label';

/** Centres a world of `width` px at `scale` in a fluid frame. */
const centre = (width: number, scale: number, shift = 0): string =>
  `calc(50% - ${String(Math.round(((width * scale) / 2 + shift) * 100) / 100)}px)`;

const ORDER_SERVICE_DETAIL = {
  ...NODES.svc,
  card: {
    ...NODES.svc.card,
    fields: [
      { label: 'Tech', value: 'Go' },
      { label: 'Owner', value: 'Orders team', person: true },
    ],
    tags: ['critical', 'pci'],
  },
};

/** Cards and connectors in focus on Order Service: its neighbours stay, the rest dims. */
function focusStates(nodeKeys: readonly string[], edges: typeof ALL_EDGES) {
  const neighbours = new Set(['gw', 'odb', 'pay', 'svc']);
  const nodeState: Record<string, CardState> = {};
  for (const key of nodeKeys) {
    nodeState[key] = key === 'svc' ? { selected: true } : neighbours.has(key) ? {} : { dim: true };
  }
  const edgeState: Record<string, EdgeState> = {};
  for (const edge of edges) {
    edgeState[edge.id] = edge.from === 'svc' || edge.to === 'svc' ? 'highlight' : 'dim';
  }
  return { nodeState, edgeState };
}

/**
 * Step 2 · Explore: the deck at three zoom levels, connection focus on Order Service and the
 * drill-in "Inside Payments".
 */
export function ExploreVisual({ breakpoint }: { breakpoint: Breakpoint }) {
  const phone = breakpoint === 'phone';
  const row = breakpoint === 'desktop';
  const smallH = phone ? 300 : 270;
  const width = row ? 384 : '100%';
  const wideWidth = row ? 588 : '100%';
  const containerScale = phone ? 0.618 : 0.72;
  const focusScale = phone ? 0.62 : 0.52;
  const focusWorld = phone
    ? ORDERS_CROP
    : { nodes: ALL_NODES, edges: ALL_EDGES, frames: ALL_FRAMES };
  const focus = focusStates(
    focusWorld.nodes.map((n) => n.key),
    focusWorld.edges,
  );
  const drill = phone ? PAYMENTS_DRILL_PHONE : PAYMENTS_DRILL;
  const drillScale = phone ? 0.76 : 0.78;

  const system = (
    <Viewport
      width={width}
      height={smallH}
      scale={0.3}
      offsetX={centre(WORLD.w, 0.3)}
      offsetY={(smallH - WORLD.h * 0.3) / 2 - 14}
      worldWidth={WORLD.w}
      worldHeight={WORLD.h}
      label="The whole Checkout deck zoomed out to 30 %: each card is its type icon."
      over={<ZoomLabel text="System" detail="30%" />}
    >
      <DeckScene
        nodes={ALL_NODES}
        edges={ALL_EDGES}
        frames={ALL_FRAMES}
        width={WORLD.w}
        height={WORLD.h}
        zoom="landscape"
        labels={false}
      />
    </Viewport>
  );
  const containers = (
    <Viewport
      width={width}
      height={smallH}
      scale={containerScale}
      offsetX={centre(508, containerScale)}
      offsetY={8 - 22 * containerScale}
      worldWidth={WORLD.w}
      worldHeight={WORLD.h}
      label="The Edge and Orders groups at 70 %: card titles and descriptions."
      over={<ZoomLabel text="Containers" detail="70%" />}
    >
      <DeckScene
        nodes={ALL_NODES.slice(0, 4)}
        edges={ALL_EDGES.slice(0, 3)}
        frames={[FRAMES.edge, FRAMES.orders]}
        width={WORLD.w}
        height={WORLD.h}
        zoom="container"
      />
    </Viewport>
  );
  const components = (
    <Viewport
      width={width}
      height={smallH}
      scale={0.8}
      offsetX={centre(232, 0.8, 276 * 0.8)}
      offsetY={10 - 22 * 0.8}
      worldWidth={WORLD.w}
      worldHeight={WORLD.h}
      label="Order Service at 100 %: its fields (Tech Go, Owner Orders team) and tags critical and pci."
      over={<ZoomLabel text="Components" detail="100%" />}
    >
      <DeckScene
        nodes={[ORDER_SERVICE_DETAIL]}
        edges={[]}
        frames={[{ ...FRAMES.orders, h: 248, count: 1 }]}
        width={WORLD.w}
        height={WORLD.h}
      />
    </Viewport>
  );
  const focusView = (
    <Viewport
      width={wideWidth}
      height={phone ? 340 : 320}
      scale={focusScale}
      offsetX={centre(phone ? ORDERS_CROP.width : WORLD.w, focusScale)}
      offsetY={phone ? 6 : 24}
      worldWidth={phone ? ORDERS_CROP.width : WORLD.w}
      worldHeight={phone ? ORDERS_CROP.height : WORLD.h}
      label="Connection focus on Order Service: API Gateway, Orders DB and Payment Service stay, everything else dims."
      over={
        <>
          <ZoomLabel text="Connection focus" detail="Order Service" />
          <CanvasPill
            style={{
              right: 12,
              top: 12,
              gap: 6,
              background: C.primarySoft,
              border: `1.5px solid ${C.primary}`,
              boxShadow: 'none',
              fontWeight: 600,
              color: C.primaryInk,
            }}
          >
            <Focus aria-hidden size={14} strokeWidth={2.25} />
            Focus
          </CanvasPill>
        </>
      }
    >
      <DeckScene
        nodes={focusWorld.nodes}
        edges={focusWorld.edges}
        frames={focusWorld.frames}
        width={phone ? ORDERS_CROP.width : WORLD.w}
        height={phone ? ORDERS_CROP.height : WORLD.h}
        nodeState={focus.nodeState}
        edgeState={focus.edgeState}
      />
    </Viewport>
  );
  const drillView = (
    <Viewport
      width={wideWidth}
      height={phone ? 470 : 320}
      scale={drillScale}
      offsetX={phone ? centre(232, drillScale) : centre(710, drillScale)}
      offsetY={phone ? 56 : 22}
      worldWidth={drill.width}
      worldHeight={drill.height}
      label="Inside the Payments group: Payment Service and Payment Provider, with Order Service and order.placed as outside proxies."
      over={
        <Crumb
          parts={['Checkout', 'Payments']}
          {...(phone ? {} : { style: { top: 'auto', bottom: 12 } })}
        />
      }
    >
      <DeckScene
        nodes={drill.nodes}
        edges={drill.edges}
        frames={drill.frames}
        width={drill.width}
        height={drill.height}
      />
    </Viewport>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 desk:flex-row">
        {system}
        {containers}
        {components}
      </div>
      <div className="flex flex-col gap-6 desk:flex-row">
        {focusView}
        {drillView}
      </div>
    </div>
  );
}
