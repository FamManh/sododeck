import * as dbmlParse from '@dbml/parse';
import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { edgeCaseDeck, edgeCaseRequest } from '../fixtures/export-edge-cases';
import { shopDeck } from '../fixtures/shop';
import { schemaExport } from './schema-export';
import { DEFAULT_SQL_OPTIONS } from './types';

function dbml(deck: SododeckFile): string {
  return schemaExport(deck, {
    format: 'dbml',
    scope: { kind: 'deck' },
    dialect: null,
    sql: DEFAULT_SQL_OPTIONS,
  }).text;
}

function block(text: string, head: string): string {
  const start = text.indexOf(head);
  if (start === -1) throw new Error(`no ${head}`);
  return text.slice(start, text.indexOf('\n}', start) + 2);
}

describe('writeDbml golden files', () => {
  it('writes the Shop deck', async () => {
    await expect(dbml(shopDeck('postgres'))).toMatchFileSnapshot('./__golden__/dbml/shop.dbml');
  });

  it('writes the edge cases', async () => {
    const { text } = schemaExport(edgeCaseDeck(), edgeCaseRequest('dbml', null));
    await expect(text).toMatchFileSnapshot('./__golden__/dbml/edge-cases.dbml');
  });
});

describe('writeDbml', () => {
  const shop = dbml(shopDeck('postgres'));

  it('names the dialect in a Project block only on a real dialect', () => {
    expect(shop.startsWith("Project Shop {\n  database_type: 'PostgreSQL'\n}")).toBe(true);
    expect(dbml(shopDeck('generic'))).not.toContain('Project');
  });

  it('writes composite, many-to-many and optional references with actions', () => {
    expect(shop).toContain(
      'Ref: shipment_items.(order_id, product_id) > order_items.(order_id, product_id)',
    );
    expect(shop).toContain('Ref "listed in": products.id <> categories.id');
    expect(shop).toContain('Ref: reviews.customer_id ?>? customers.id [delete: set null]');
    expect(shop).toContain('Ref places: orders.customer_id > customers.id [delete: cascade]');
  });

  it('writes a composite primary key as an index', () => {
    expect(block(shop, 'Table order_items {')).toContain('(order_id, product_id) [pk]');
    expect(block(shop, 'Table order_items {')).not.toContain('[pk]\n  product_id');
  });

  it('writes expression indexes, checks and notes', () => {
    expect(block(shop, 'Table customers {')).toContain(
      "(`lower(email)`) [name: 'customers_email_lower_idx']",
    );
    expect(block(shop, 'Table products {')).toContain(
      "checks {\n    `price >= 0` [name: 'products_price_check']\n  }",
    );
    expect(block(shop, 'Table order_items {')).toContain('checks {\n    `quantity > 0`\n  }');
    expect(block(shop, 'Table products {')).toContain(
      "Note: '''Things we sell; \\'active\\' hides them\nfrom the store'''",
    );
    expect(shop).toContain("paid [note: 'Payment captured']");
    expect(block(shop, 'Table orders {')).toContain(
      "status order_status [not null, default: 'pending']",
    );
    expect(block(shop, 'Table orders {')).toContain(
      'created_at timestamptz [not null, default: `now()`]',
    );
  });

  it('qualifies schemas, quotes odd names and comments what it leaves out', () => {
    const { text, notes } = schemaExport(edgeCaseDeck(), edgeCaseRequest('dbml', null));
    expect(text).toContain('Table billing.ledgers {');
    expect(text).toContain('Table "order items" {');
    expect(text).toContain('"line note" text [note:');
    expect(text).toContain(
      '// Relationship pair_refs → pairs has 1 and 2 columns; not written\n// Relationship pair_refs → misc names no columns; not a foreign key\nTable pair_refs {',
    );
    expect(text).toContain('// billing.ledgers.account_id → billing.accounts.id not written');
    expect(text).not.toContain('pair_refs.x >');
    expect(notes.map((n) => n.kind)).toContain('method-dropped');
  });

  it('writes DBML the DBML compiler reads back (044 research R13)', () => {
    const { text, notes } = schemaExport(edgeCaseDeck(), edgeCaseRequest('dbml', null));
    const { Compiler, MemoryProjectLayout, DEFAULT_ENTRY } = dbmlParse;
    const compiler = new Compiler(new MemoryProjectLayout({ [DEFAULT_ENTRY.absolute]: text }));
    expect(compiler.parse.errors(DEFAULT_ENTRY).map((e) => e.diagnostic)).toEqual([]);
    // An enum with no values and a same-column n–n are left out, with a note each.
    expect(text).not.toContain('Enum empty_choice {');
    expect(text).toContain('// Enum empty_choice has no values; not written');
    expect(text).not.toContain('Ref related: tags.id <> tags.id');
    expect(text).toContain(
      '// Relationship tags ↔ tags (related) links a column to itself; not written',
    );
    expect(notes.map((n) => n.kind)).toEqual(
      expect.arrayContaining(['empty-enum', 'same-column-ref']),
    );
  });
});
