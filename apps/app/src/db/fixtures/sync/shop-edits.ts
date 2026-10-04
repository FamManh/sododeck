/**
 * Shop DBML and edited variants for the schema sync tests (046 T003). The text is the writer's own
 * output for the Shop deck; each edit is what a person would type into the panel. Test-only.
 */
import type { Dialect, SododeckFile } from '@sododeck/schema';

import { schemaExport } from '../../export/schema-export';
import { DEFAULT_SQL_OPTIONS } from '../../export/types';
import { shopDeck } from '../shop';

export function writeShopDbml(deck: SododeckFile): string {
  return schemaExport(deck, {
    format: 'dbml',
    scope: { kind: 'deck' },
    dialect: null,
    sql: DEFAULT_SQL_OPTIONS,
  }).text;
}

export function shopText(dialect: Dialect = 'postgres'): string {
  return writeShopDbml(shopDeck(dialect));
}

function must(text: string, find: string | RegExp, replacement: string): string {
  const result = text.replace(find, replacement);
  if (result === text) throw new Error(`fixture edit did not apply: ${String(find)}`);
  return result;
}

/** The text of one `Table name { … }` block, with its trailing blank line. */
function blockOf(text: string, name: string): string {
  const match = new RegExp(`Table ${name} \\{[\\s\\S]*?\\n\\}\\n\\n?`).exec(text);
  if (match === null) throw new Error(`no table ${name}`);
  return match[0];
}

export const edits = {
  /** A new NOT NULL column after `total`. */
  addColumn: (text: string) =>
    must(text, /( {2}total numeric\(10,2\)[^\n]*\n)/, '$1  discount_cents integer [not null]\n'),
  /** `customers` becomes `clients`; references follow. */
  renameTable: (text: string) => text.replace(/\bcustomers\b/g, 'clients'),
  /** `orders.total` becomes `grand_total`. */
  renameColumn: (text: string) =>
    must(text, /( {2})total( numeric\(10,2\)[^\n]*Sum of the order items)/, '$1grand_total$2'),
  /** `shipments` and its relationships are deleted. */
  removeTable: (text: string) =>
    must(
      must(text, blockOf(text, 'shipments'), ''),
      /Ref: shipments\.order_id > orders\.id\n?/,
      '',
    ).replace(/Ref: shipment_items\.shipment_id > shipments\.id[^\n]*\n/, ''),
  /** A new table `coupons`, a new column `orders.coupon_id` and a relationship between them. */
  addTableWithRef: (text: string) =>
    `${must(text, /( {2}billing_address_id uuid\n)/, '$1  coupon_id uuid\n').trimEnd()}\n\nTable coupons {\n  id uuid [pk]\n  code varchar(40) [not null, unique]\n}\n\nRef: orders.coupon_id > coupons.id\n`,
  /** `order_status` becomes `order_state` (the enum and the column that uses it). */
  renameEnum: (text: string) => text.replace(/\border_status\b/g, 'order_state'),
  /** `shipments` and `payments` are replaced by two unrelated tables. */
  replaceTwoTables: (text: string) => {
    const withoutRefs = text
      .replace(/Ref: payments\.order_id > orders\.id\n/, '')
      .replace(/Ref: shipment_items\.shipment_id > shipments\.id[^\n]*\n/, '')
      .replace(/Ref: shipments\.order_id > orders\.id\n?/, '');
    return `${withoutRefs
      .replace(blockOf(text, 'shipments'), '')
      .replace(blockOf(text, 'payments'), '')
      .trimEnd()}\n\nTable warehouses {\n  code text [pk]\n  city text\n  region text\n}\n\nTable carriers {\n  id int [pk]\n  label text\n  phone text\n}\n`;
  },
  /** A column typed `not nul`. */
  typo: (text: string) =>
    must(text, /( {2}total numeric\(10,2\))( \[not null)/, '$1 [not nul]\n  ignored int$2'),
  /** A TableGroup block, which the panel does not read. */
  tableGroup: (text: string) =>
    `${text.trimEnd()}\n\nTableGroup sales {\n  orders\n  customers\n}\n`,
  /** Everything deleted. */
  clear: () => '',
};
