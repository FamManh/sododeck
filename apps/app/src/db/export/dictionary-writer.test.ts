import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { edgeCaseDeck, edgeCaseRequest } from '../fixtures/export-edge-cases';
import { shopDeck } from '../fixtures/shop';
import { schemaExport } from './schema-export';
import { DEFAULT_SQL_OPTIONS, type SchemaExportRequest } from './types';

function dictionary(deck: SododeckFile, scope: SchemaExportRequest['scope'] = { kind: 'deck' }) {
  return schemaExport(deck, {
    format: 'dictionary',
    scope,
    dialect: null,
    sql: DEFAULT_SQL_OPTIONS,
  });
}

describe('writeDictionary golden files', () => {
  it('writes the Shop deck', async () => {
    await expect(dictionary(shopDeck('postgres')).text).toMatchFileSnapshot(
      './__golden__/dictionary/shop.md',
    );
  });

  it('writes the edge cases', async () => {
    const { text } = schemaExport(edgeCaseDeck(), edgeCaseRequest('dictionary', null));
    await expect(text).toMatchFileSnapshot('./__golden__/dictionary/edge-cases.md');
  });
});

describe('writeDictionary', () => {
  const shop = dictionary(shopDeck('postgres')).text;

  it('titles with deck, scope and dialect (no dialect on Generic)', () => {
    expect(shop.split('\n')[0]).toBe('# Shop · Whole deck · Postgres');
    expect(
      dictionary(shopDeck('generic'), { kind: 'database', cardId: 'card.users-db' }).text.split(
        '\n',
      )[0],
    ).toBe('# Shop · Users DB');
  });

  it('lists tables in stable order: schema, then name', () => {
    const headings = shop.split('\n').filter((l) => l.startsWith('## '));
    expect(headings.slice(0, 3)).toEqual(['## addresses', '## audit_log', '## categories']);
    expect(headings.slice(-2)).toEqual(['## Enums', '## Relationships']);
  });

  it('writes the column table with keys, nullability and defaults', () => {
    expect(shop).toContain('| customer_id | uuid | FK → customers.id | no |  |  |');
    expect(shop).toContain("| status | order_status |  | no | 'pending' |  |");
    expect(shop).toContain('| created_at | timestamptz |  | no | `now()` |  |');
    expect(shop).toContain('| order_id | uuid | PK, FK → orders.id | no |  |  |');
    expect(shop).toContain('| email | varchar(255) | UQ | no |  |  |');
  });

  it('lists indexes, checks, enums and relationships', () => {
    expect(shop).toContain('Indexes:\n\n- customers_email_lower_idx (`lower(email)`)');
    expect(shop).toContain('Checks:\n\n- products_price_check: `price >= 0`');
    expect(shop).toContain('- `quantity > 0` (column quantity)');
    expect(shop).toContain(
      '### order_status\n\nWhere an order is in its life\n\n- `pending`\n- `paid`: Payment captured',
    );
    expect(shop).toContain(
      '- orders.customer_id → customers.id · many to one · on delete cascade · "places"',
    );
    expect(shop).toContain('- products.id → categories.id · many to many · "listed in"');
  });

  it('escapes table cells', () => {
    const deck = shopDeck('postgres');
    const customers = deck.nodes.find((n) => n.id === 'customers');
    const column = customers?.columns?.[0];
    if (column === undefined) throw new Error('fixture changed');
    column.note = 'a | b\nc *as typed*';
    expect(dictionary(deck).text).toContain('| id | uuid | PK | no |  | a \\| b<br>c *as typed* |');
  });

  it('mentions references outside the export under the table', () => {
    const { text } = schemaExport(edgeCaseDeck(), edgeCaseRequest('dictionary', null));
    expect(text).toContain(
      'References outside this export:\n\n- billing.ledgers.account_id → billing.accounts.id',
    );
  });
});
