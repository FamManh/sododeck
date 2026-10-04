import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { edgeCaseDeck, edgeCaseRequest } from '../fixtures/export-edge-cases';
import { shopDeck } from '../fixtures/shop';
import { schemaExport } from './schema-export';
import { DEFAULT_SQL_OPTIONS } from './types';

function mermaid(deck: SododeckFile) {
  return schemaExport(deck, {
    format: 'mermaid-er',
    scope: { kind: 'deck' },
    dialect: null,
    sql: DEFAULT_SQL_OPTIONS,
  });
}

/** One relationship between two one-column tables with the given cardinality. */
function pair(extra: Partial<SododeckFile['edges'][number]>): SododeckFile {
  const deck = shopDeck('postgres');
  return {
    ...deck,
    nodes: deck.nodes.filter((n) => n.id === 'orders' || n.id === 'customers'),
    edges: [
      {
        id: 'r',
        from: 'orders',
        to: 'customers',
        fromColumns: ['orders.customer_id'],
        toColumns: ['customers.id'],
        ...extra,
      },
    ],
  };
}

function relationLine(text: string): string {
  return text.split('\n').find((line) => line.includes(' : ')) ?? '';
}

describe('writeMermaidEr golden files', () => {
  it('writes the Shop deck', async () => {
    await expect(mermaid(shopDeck('postgres')).text).toMatchFileSnapshot(
      './__golden__/mermaid/shop.mmd',
    );
  });

  it('writes the edge cases', async () => {
    const { text } = schemaExport(edgeCaseDeck(), edgeCaseRequest('mermaid-er', null));
    await expect(text).toMatchFileSnapshot('./__golden__/mermaid/edge-cases.mmd');
  });
});

describe('writeMermaidEr', () => {
  it.each([
    ['n-1', false, false, 'orders }|--|| customers : "customer_id"'],
    ['n-1', true, true, 'orders }o--o| customers : "customer_id"'],
    // 1-n: the `to` side holds the foreign key, so its columns label the line.
    ['1-n', false, false, 'orders ||--|{ customers : "id"'],
    ['1-n', true, true, 'orders |o--o{ customers : "id"'],
    ['1-1', false, true, 'orders ||--o| customers : "customer_id"'],
    ['n-n', true, false, 'orders }o--|{ customers : "customer_id"'],
  ] as const)(
    'maps %s (from optional %s, to optional %s)',
    (cardinality, fromOptional, toOptional, line) => {
      const { text } = mermaid(pair({ cardinality, fromOptional, toOptional }));
      expect(relationLine(text)).toBe(`  ${line}`);
    },
  );

  it('uses the label, else the foreign key columns', () => {
    expect(relationLine(mermaid(pair({ cardinality: 'n-1', label: 'places "now"' })).text)).toBe(
      `  orders }|--|| customers : "places 'now'"`,
    );
  });

  it('draws a relationship without cardinality as many to one, with a note', () => {
    const { text, notes } = mermaid(pair({}));
    expect(relationLine(text)).toBe('  orders }o--|| customers : "customer_id"');
    expect(notes.filter((n) => n.kind === 'no-cardinality')).toEqual([
      expect.objectContaining({
        message: 'orders → customers has no cardinality; drawn as many to one',
      }),
    ]);
  });

  it('writes key markers and safe names with the original kept', () => {
    const shop = mermaid(shopDeck('postgres')).text;
    expect(shop).toContain('    uuid order_id PK, FK\n');
    expect(shop).toContain('    varchar(255) email UK\n');
    expect(shop).toContain('    numeric(10-2) total "numeric(10,2); Sum of the order items"\n');
    const edge = schemaExport(edgeCaseDeck(), edgeCaseRequest('mermaid-er', null));
    expect(edge.text).toContain('  order_items["order items"] {');
    expect(edge.text).toContain('    text line_note "line note; Quotes \' and \' and -- dashes"');
    expect(edge.text).toContain('  billing_ledgers["billing.ledgers"] {');
    expect(edge.notes.map((n) => n.message)).toContain('Name `order items` written as order_items');
  });

  it('writes plain table-to-table connectors and leaves out-of-scope ones out', () => {
    const { text } = schemaExport(edgeCaseDeck(), edgeCaseRequest('mermaid-er', null));
    expect(text).toContain('  pair_refs }|--|| misc : "mentions"');
    expect(text).not.toContain('accounts');
  });

  it('uses only characters Mermaid accepts in names and types', () => {
    for (const deck of [shopDeck('postgres'), edgeCaseDeck()]) {
      const { text } = mermaid(deck);
      const entities = text.matchAll(/^ {2}([^ \n{]+?)(\[".*"\])? \{$/gm);
      for (const [, name] of entities) expect(name).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/);
      const attributes = text.matchAll(/^ {4}(\S+) (\S+)/gm);
      for (const [, type, name] of attributes) {
        expect(type).toMatch(/^[A-Za-z][A-Za-z0-9_()[\]-]*$/);
        expect(name).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/);
      }
    }
  });
});
