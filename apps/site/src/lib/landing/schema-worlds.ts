/**
 * The two schema boards of the Database section (design board `dbWorld` / `dbWorldM`): where the
 * tables, the enum, the outside proxy and the overlays sit, in world px.
 */
import { TABLES, type Relationship, type Table } from './checkout-deck';

export interface Placed {
  key: string;
  table: Table;
  x: number;
  y: number;
}

export interface World {
  width: number;
  height: number;
  frame: { x: number; y: number; w: number; h: number };
  tables: readonly Placed[];
  enumAt?: { x: number; y: number };
  proxy: { x: number; y: number; w: number };
  relationships: readonly Relationship[];
  /** The two tables the Checkout flow writes: step 4 orders, step 5 payments. */
  lit: readonly { key: string; n: number; writes: readonly string[]; at: number }[];
  crumb: { left: number; top: number };
  flowBar: { left: number; top: number; width?: number };
  /** The selected Orders DB card the schema opens from (wide only). */
  card?: { x: number; y: number };
}

const LIT = [
  { key: 'orders', n: 4, writes: ['status', 'total_cents'], at: 0.6 },
  { key: 'pay', n: 5, writes: ['amount_cents', 'status'], at: 1.8 },
] as const;

export const WIDE: World = {
  width: 820,
  height: 600,
  frame: { x: 236, y: 56, w: 568, h: 489 },
  tables: [
    { key: 'orders', table: TABLES.orders, x: 260, y: 100 },
    { key: 'items', table: TABLES.order_items, x: 540, y: 100 },
    { key: 'pay', table: TABLES.payments, x: 540, y: 320 },
  ],
  enumAt: { x: 260, y: 360 },
  proxy: { x: 24, y: 440, w: 180 },
  relationships: [
    {
      from: 'items',
      fromColumn: 'order_id',
      to: 'orders',
      toColumn: 'id',
      fromEnd: 'zmany',
      toEnd: 'one',
    },
    {
      from: 'pay',
      fromColumn: 'order_id',
      to: 'orders',
      toColumn: 'id',
      fromEnd: 'zmany',
      toEnd: 'one',
    },
    {
      from: 'orders',
      fromColumn: 'customer_id',
      to: 'cust',
      toColumn: 'id',
      fromEnd: 'zmany',
      toEnd: 'one',
    },
  ],
  lit: LIT,
  crumb: { left: 16, top: 12 },
  flowBar: { left: 470, top: 556, width: 334 },
  card: { x: 24, y: 84 },
};

export const NARROW: World = {
  width: 420,
  height: 710,
  frame: { x: 50, y: 124, w: 290, h: 531 },
  tables: [
    { key: 'orders', table: TABLES.orders, x: 74, y: 164 },
    { key: 'pay', table: TABLES.payments, x: 74, y: 430 },
  ],
  proxy: { x: 66, y: 56, w: 170 },
  relationships: [
    {
      from: 'pay',
      fromColumn: 'order_id',
      to: 'orders',
      toColumn: 'id',
      fromEnd: 'zmany',
      toEnd: 'one',
      sides: ['r', 'r'],
    },
    {
      from: 'orders',
      fromColumn: 'customer_id',
      to: 'cust',
      toColumn: 'id',
      fromEnd: 'zmany',
      toEnd: 'one',
      sides: ['l', 'l'],
    },
  ],
  lit: LIT,
  crumb: { left: 12, top: 10 },
  flowBar: { left: 12, top: 668 },
};
