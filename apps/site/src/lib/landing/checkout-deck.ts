/**
 * The "Checkout" sample deck every landing page visual is drawn from (L1: one deck, one story).
 * World coordinates are the design board's (`sododeck-landing.js`), in px at 100 % zoom.
 */
import type { CrowEnd, Side } from './geometry';
import type { Hue } from './tokens';

export type CardType = 'service' | 'database' | 'gateway' | 'client' | 'queue' | 'external';

export interface CardField {
  label: string;
  value: string;
  /** A person shows as an avatar chip, everything else as a label / value row. */
  person?: boolean;
}

export interface CardData {
  type: CardType;
  /** Overrides the type's name in the header, e.g. "Kafka topic". */
  typeName?: string;
  title: string;
  description?: string;
  color?: Hue;
  /** Number of cards inside (a drill-in card). */
  inside?: number;
  fields?: readonly CardField[];
  tags?: readonly string[];
}

export interface ShapeData {
  shape: 'pill' | 'sticky';
  title: string;
  w: number;
  h: number;
}

export interface ProxyData {
  type: CardType;
  title: string;
  w: number;
}

export type SceneNode = { key: string; x: number; y: number } & (
  | { kind: 'card'; card: CardData }
  | { kind: 'shape'; shape: ShapeData }
  | { kind: 'proxy'; proxy: ProxyData }
);

export interface SceneEdge {
  id: string;
  from: string;
  fromSide: Side;
  to: string;
  toSide: Side;
  /** Attach point along the side, from its start (default: anchor or middle). */
  fromAt?: number;
  toAt?: number;
  label?: string;
  /** Label position along the path (default 0.5). */
  labelAt?: number;
  /** A "writes" relationship is dashed (`12 3`). */
  writes?: boolean;
  /** The failure branch: clay, dashed, with an error label. */
  error?: boolean;
}

export interface SceneFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  count: number;
  color?: Hue;
}

/** The world size of the full deck. */
export const WORLD = { w: 1084, h: 520 } as const;

export type CardNode = Extract<SceneNode, { kind: 'card' }>;

const card = (key: string, x: number, y: number, data: CardData): CardNode => ({
  key,
  x,
  y,
  kind: 'card',
  card: data,
});

export const NODES = {
  web: card('web', 24, 72, { type: 'client', title: 'Web app', description: 'Storefront' }),
  gw: card('gw', 24, 236, {
    type: 'gateway',
    title: 'API Gateway',
    description: 'Auth, rate limits',
  }),
  svc: card('svc', 300, 72, {
    type: 'service',
    title: 'Order Service',
    description: 'Creates the order',
  }),
  odb: card('odb', 300, 236, {
    type: 'database',
    title: 'Orders DB',
    description: 'Primary + replica',
    color: 'blue',
    inside: 3,
  }),
  pay: card('pay', 576, 72, {
    type: 'service',
    title: 'Payment Service',
    description: 'Authorises, captures',
  }),
  psp: card('psp', 576, 236, {
    type: 'external',
    title: 'Payment Provider',
    description: 'Card acquirer, 3DS',
  }),
  kfk: card('kfk', 852, 72, { type: 'queue', typeName: 'Kafka topic', title: 'order.placed' }),
  ship: card('ship', 852, 256, {
    type: 'service',
    title: 'Shipping Service',
    description: 'Books the carrier',
  }),
  cancel: {
    key: 'cancel',
    x: 600,
    y: 420,
    kind: 'shape',
    shape: { shape: 'pill', title: 'Cancel order', w: 136, h: 40 },
  },
} satisfies Record<string, SceneNode>;

export const ALL_NODES: readonly SceneNode[] = Object.values(NODES);

export const FRAMES = {
  edge: { x: 0, y: 36, w: 232, h: 326, title: 'Edge', count: 2 },
  orders: { x: 276, y: 36, w: 232, h: 358, title: 'Orders', count: 2 },
  payments: { x: 552, y: 36, w: 232, h: 326, title: 'Payments', count: 2 },
  messaging: { x: 828, y: 36, w: 232, h: 137, title: 'Messaging', count: 1 },
  fulfilment: { x: 828, y: 220, w: 232, h: 162, title: 'Fulfilment', count: 1 },
} satisfies Record<string, SceneFrame>;

export const ALL_FRAMES: readonly SceneFrame[] = Object.values(FRAMES);

export const EDGES = {
  checkout: { id: '1', from: 'web', fromSide: 'b', to: 'gw', toSide: 't', label: 'checkout' },
  post: {
    id: '2',
    from: 'gw',
    fromSide: 'r',
    to: 'svc',
    toSide: 'l',
    label: 'POST /orders',
    labelAt: 0.55,
  },
  writes: {
    id: '3',
    from: 'svc',
    fromSide: 'b',
    to: 'odb',
    toSide: 't',
    label: 'writes orders',
    writes: true,
  },
  authorize: { id: '4', from: 'svc', fromSide: 'r', to: 'pay', toSide: 'l', label: 'authorize' },
  charge: { id: '5', from: 'pay', fromSide: 'b', to: 'psp', toSide: 't', label: 'charge' },
  succeeded: {
    id: '6',
    from: 'psp',
    fromSide: 'r',
    to: 'kfk',
    toSide: 'l',
    label: 'payment.succeeded',
  },
  consume: {
    id: '7',
    from: 'kfk',
    fromSide: 'b',
    to: 'ship',
    toSide: 't',
    toAt: 150,
    label: 'consume',
    labelAt: 0.35,
  },
  failed: {
    id: 'f',
    from: 'psp',
    fromSide: 'b',
    to: 'cancel',
    toSide: 't',
    label: 'failed · retry ×3',
    error: true,
  },
} satisfies Record<string, SceneEdge>;

export const ALL_EDGES: readonly SceneEdge[] = Object.values(EDGES);

/** The eight steps of flow "Checkout": where the step goes, and over which connector label. */
export const STEPS: readonly (readonly [string, string])[] = [
  ['Start at Web app', 'checkout'],
  ['Web app → API Gateway', 'checkout'],
  ['API Gateway → Order Service', 'POST /orders'],
  ['Order Service → Orders DB', 'writes orders'],
  ['Order Service → Payment Service', 'authorize'],
  ['Payment Service → Payment Provider', 'charge'],
  ['Payment Provider → order.placed', 'payment.succeeded'],
  ['order.placed → Shipping Service', 'consume'],
];

export interface FlowHop {
  /** The connector the step travels. */
  edge: string;
  /** The card it arrives at. */
  node: string;
  /** Its step number. */
  n: number;
}

/** Steps 2–8 as hops; step 1 starts at Web app. */
export const SEQUENCE: readonly FlowHop[] = [
  { edge: '1', node: 'gw', n: 2 },
  { edge: '2', node: 'svc', n: 3 },
  { edge: '3', node: 'odb', n: 4 },
  { edge: '4', node: 'pay', n: 5 },
  { edge: '5', node: 'psp', n: 6 },
  { edge: '6', node: 'kfk', n: 7 },
  { edge: '7', node: 'ship', n: 8 },
];

// ---------- Database pack: the tables inside Orders DB

export interface Column {
  name: string;
  type: string;
  pk?: boolean;
  /** `table.column` it refers to. */
  fk?: string;
  /** The enum it takes its values from. */
  enumName?: string;
}

export interface Table {
  name: string;
  columns: readonly Column[];
  /** Number of indexes, shown in the footer. */
  indexes?: number;
}

export const TABLES = {
  orders: {
    name: 'orders',
    indexes: 2,
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'customer_id', type: 'uuid', fk: 'customers.id' },
      { name: 'status', type: 'order_status', enumName: 'order_status' },
      { name: 'total_cents', type: 'int' },
      { name: 'created_at', type: 'timestamptz' },
    ],
  },
  order_items: {
    name: 'order_items',
    columns: [
      { name: 'order_id', type: 'uuid', pk: true, fk: 'orders.id' },
      { name: 'product_id', type: 'uuid', pk: true },
      { name: 'qty', type: 'int' },
      { name: 'price_cents', type: 'int' },
    ],
  },
  payments: {
    name: 'payments',
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'order_id', type: 'uuid', fk: 'orders.id' },
      { name: 'provider', type: 'text' },
      { name: 'amount_cents', type: 'int' },
      { name: 'status', type: 'text' },
    ],
  },
} satisfies Record<string, Table>;

export interface EnumData {
  name: string;
  color: Hue;
  values: readonly (readonly [string, Hue])[];
}

export const ORDER_STATUS: EnumData = {
  name: 'order_status',
  color: 'violet',
  values: [
    ['pending', 'slate'],
    ['paid', 'green'],
    ['shipped', 'blue'],
    ['cancelled', 'red'],
  ],
};

export interface Relationship {
  from: string;
  fromColumn: string;
  to: string;
  toColumn: string;
  fromEnd: CrowEnd;
  toEnd: CrowEnd;
  /** Forces the sides (default: facing each other). */
  sides?: readonly [Side, Side];
}

// ---------- text in the code panes

export const AGENT_PROMPT: readonly string[] = [
  'Map our checkout: web, gateway, order',
  'service with Postgres, payments, Kafka,',
  'shipping. Include the checkout flow.',
];

/** The hero's generated file (format v1, cut short). */
export const GENERATED_JSON: readonly string[] = [
  '{',
  '  "$schema":',
  '    "https://sododeck.com/schema/v1.json",',
  '  "version": 1,',
  '  "name": "Checkout",',
  '  "nodes": [',
  '    { "id": "order-svc",',
  '      "type": "service",',
  '      "title": "Order Service" },',
  '    …',
  '  ],',
  '  "edges": [ … ],',
  '  "flows": [ … ]',
  '}',
];

/** The Code section's whole-deck JSON (format v1); lines 7–13 are the selected Order Service. */
export const DECK_JSON: readonly string[] = [
  '{',
  '  "$schema":',
  '    "https://sododeck.com/schema/v1.json",',
  '  "version": 1,',
  '  "name": "Checkout",',
  '  "groups": [ … ],',
  '  "nodes": [',
  '    {',
  '      "id": "order-svc",',
  '      "type": "service",',
  '      "title": "Order Service",',
  '      "group": "orders",',
  '      "description": "Creates the order"',
  '    },',
  '    {',
  '      "id": "orders-db",',
  '      "type": "database",',
  '      "title": "Orders DB"',
  '    }',
  '  ],',
  '  "edges": [{ "id": "e-writes-orders",',
  '    "from": "order-svc", "to": "orders-db",',
  '    "label": "writes orders" }],',
  '  "flows": [{ "id": "checkout", … }]',
  '}',
];

export const DECK_JSON_SELECTED: readonly number[] = [7, 8, 9, 10, 11, 12, 13];

export const DBML: readonly string[] = [
  'Table orders {',
  '  id uuid [pk]',
  '  customer_id uuid [ref: > customers.id]',
  '  status order_status [not null]',
  '  total_cents int [not null]',
  '  created_at timestamptz [not null]',
  '  indexes {',
  '    customer_id',
  '    created_at',
  '  }',
  '}',
  '',
  'Table payments {',
  '  id uuid [pk]',
  '  order_id uuid [ref: > orders.id]',
  '  provider text',
  '  amount_cents int',
  '  status text',
  '}',
  '',
  'Enum order_status {',
  '  pending',
  '  paid',
  '  shipped',
  '  cancelled',
  '}',
];
