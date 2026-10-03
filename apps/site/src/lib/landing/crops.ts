/**
 * Smaller worlds cut from the Checkout deck for single visuals: cards outside the crop become
 * dashed proxies, so no connector or label ever runs into a frame edge (fix round, item 4).
 */
import {
  EDGES,
  FRAMES,
  NODES,
  type SceneEdge,
  type SceneFrame,
  type SceneNode,
} from './checkout-deck';

const proxy = (
  key: string,
  x: number,
  y: number,
  w: number,
  type: 'gateway' | 'service' | 'queue',
  title: string,
): SceneNode => ({ key, x, y, kind: 'proxy', proxy: { type, title, w } });

const moved = (node: SceneNode, x: number, y: number): SceneNode => ({ ...node, x, y });

/** Orders group with API Gateway and Payment Service outside (phone Flows and focus). */
export const ORDERS_CROP = {
  width: 430,
  height: 460,
  nodes: [
    proxy('gwp', 79, 0, 150, 'gateway', 'API Gateway'),
    moved(NODES.svc, 24, 132),
    moved(NODES.odb, 24, 296),
    // Wider than the board's 120px so "Payment Service" fits on one line inside its proxy.
    proxy('payp', 276, 166, 150, 'service', 'Payment Service'),
  ],
  edges: [
    { ...EDGES.post, from: 'gwp', fromSide: 'b', toSide: 't', toAt: 130, labelAt: 0.25 },
    EDGES.writes,
    { ...EDGES.authorize, to: 'payp' },
  ],
  frames: [{ ...FRAMES.orders, x: 0, y: 96 }],
} satisfies Crop;

/** Everything but the Edge group, with API Gateway as an outside proxy (Flows). */
export const FLOW_CROP = {
  nodes: [
    proxy('gwp', 92, 79, 120, 'gateway', 'API Gateway'),
    ...Object.values(NODES).filter((n) => n.key !== 'web' && n.key !== 'gw'),
  ],
  edges: [
    { ...EDGES.post, from: 'gwp', labelAt: 0.5 },
    ...Object.values(EDGES).filter((e) => e.id !== '1' && e.id !== '2'),
  ],
  frames: [FRAMES.orders, FRAMES.payments, FRAMES.messaging, FRAMES.fulfilment],
};

/** "Inside Payments": the drill-in with Order Service and order.placed outside. */
export const PAYMENTS_DRILL = {
  width: 720,
  height: 520,
  nodes: [
    proxy('osvc', 16, 110, 124, 'service', 'Order Service'),
    moved(NODES.pay, 236, 80),
    moved(NODES.psp, 236, 250),
    proxy('kfk', 560, 250, 150, 'queue', 'order.placed'),
  ],
  edges: [
    { id: 'a', from: 'osvc', fromSide: 'r', to: 'pay', toSide: 'l', label: 'authorize' },
    { id: 'b', from: 'pay', fromSide: 'b', to: 'psp', toSide: 't', label: 'charge' },
    { id: 'c', from: 'psp', fromSide: 'r', to: 'kfk', toSide: 'l', label: 'payment.succeeded' },
  ],
  frames: [{ ...FRAMES.payments, x: 212, y: 44, h: 332 }],
} satisfies Crop;

/** The same drill-in stacked for phones. */
export const PAYMENTS_DRILL_PHONE = {
  width: 420,
  height: 540,
  nodes: [
    proxy('osvc', 100, 0, 150, 'service', 'Order Service'),
    moved(NODES.pay, 24, 132),
    moved(NODES.psp, 24, 296),
    proxy('kfk', 41, 470, 150, 'queue', 'order.placed'),
  ],
  edges: [
    {
      id: 'a',
      from: 'osvc',
      fromSide: 'b',
      to: 'pay',
      toSide: 't',
      toAt: 151,
      label: 'authorize',
    },
    { id: 'b', from: 'pay', fromSide: 'b', to: 'psp', toSide: 't', label: 'charge' },
    {
      id: 'c',
      from: 'psp',
      fromSide: 'b',
      to: 'kfk',
      toSide: 't',
      label: 'payment.succeeded',
      labelAt: 0.55,
    },
  ],
  frames: [{ ...FRAMES.payments, x: 0, y: 96 }],
} satisfies Crop;

export interface Crop {
  width: number;
  height: number;
  nodes: readonly SceneNode[];
  edges: readonly SceneEdge[];
  frames: readonly SceneFrame[];
}
