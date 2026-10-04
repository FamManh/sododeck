import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { edgeCaseDeck, edgeCaseRequest, expectedNoteKinds } from '../fixtures/export-edge-cases';
import { shopDeck } from '../fixtures/shop';
import { schemaExport, schemaFileName } from './schema-export';
import { DEFAULT_SQL_OPTIONS, type SchemaExportRequest, type SchemaFormat } from './types';

const FORMATS: readonly SchemaFormat[] = ['sql', 'dbml', 'mermaid-er', 'dictionary'];

function request(
  format: SchemaFormat,
  scope: SchemaExportRequest['scope'],
  dialect: SchemaExportRequest['dialect'] = null,
): SchemaExportRequest {
  return { format, scope, dialect, sql: DEFAULT_SQL_OPTIONS };
}

describe('schemaExport', () => {
  it('writes nothing for an empty scope', () => {
    for (const format of FORMATS) {
      expect(
        schemaExport(shopDeck('postgres'), request(format, { kind: 'selection', tableIds: [] })),
      ).toEqual({ text: '', notes: [], tableCount: 0 });
    }
  });

  it('waits for a dialect on a Generic deck', () => {
    const result = schemaExport(shopDeck('generic'), request('sql', { kind: 'deck' }));
    expect(result).toEqual({ text: '', notes: [], tableCount: 13 });
    expect(
      schemaExport(shopDeck('generic'), request('sql', { kind: 'deck' }, 'mysql')).text,
    ).toContain('id char(36) PRIMARY KEY');
  });

  it('never throws and ends every text with one newline', () => {
    for (const format of FORMATS) {
      for (const deck of [shopDeck('postgres'), edgeCaseDeck()]) {
        const { text } = schemaExport(deck, request(format, { kind: 'deck' }, 'postgres'));
        expect(text.endsWith('\n')).toBe(true);
        expect(text.endsWith('\n\n')).toBe(false);
      }
    }
  });

  it('is byte-identical across runs (SC-005)', () => {
    for (const format of FORMATS) {
      const a = schemaExport(edgeCaseDeck(), edgeCaseRequest(format, 'mysql'));
      const b = schemaExport(edgeCaseDeck(), edgeCaseRequest(format, 'mysql'));
      expect(a).toEqual(b);
    }
  });

  describe('scope (US2)', () => {
    const shop = shopDeck('postgres');
    const created = (text: string) =>
      [...text.matchAll(/^CREATE TABLE (\S+) \(/gm)].map((m) => m[1]);

    it('writes only the selected tables', () => {
      const { text, tableCount } = schemaExport(
        shop,
        request('sql', { kind: 'selection', tableIds: ['customers', 'orders', 'addresses'] }),
      );
      expect(tableCount).toBe(3);
      expect(created(text)).toEqual(['customers', 'addresses', 'orders']);
    });

    it('ignores non-table cards in the selection, without a note', () => {
      const { text, notes } = schemaExport(
        shop,
        request('sql', { kind: 'selection', tableIds: ['users', 'sessions', 'svc.checkout'] }),
      );
      expect(created(text)).toEqual(['users', 'sessions']);
      expect(notes).toEqual([]);
    });

    it('writes the tables of one database card, or of the whole deck', () => {
      const card = schemaExport(
        shop,
        request('sql', { kind: 'database', cardId: 'card.users-db' }),
      );
      expect(card.text.split('\n')[0]).toBe('-- Shop · Users DB · Postgres');
      expect(created(card.text)).toEqual(['users', 'sessions']);
      expect(created(schemaExport(shop, request('sql', { kind: 'deck' })).text)).toHaveLength(14);
    });

    it('keeps a foreign key column to an unselected table, with a comment and one note', () => {
      const { text, notes } = schemaExport(
        shop,
        request('sql', { kind: 'selection', tableIds: ['sessions'] }),
      );
      expect(text).toContain(
        '-- sessions.user_id → users.id not written: users not in this export\nCREATE TABLE sessions (',
      );
      expect(text).toContain('  user_id uuid NOT NULL,\n');
      expect(notes).toEqual([
        {
          kind: 'fk-out-of-scope',
          message: 'sessions.user_id → users.id not written: users not in this export',
          tableId: 'sessions',
        },
      ]);
    });
  });

  it.each([
    ['sql-postgres', 'sql', 'postgres'],
    ['sql-mysql', 'sql', 'mysql'],
    ['sql-sqlite', 'sql', 'sqlite'],
    ['dbml', 'dbml', null],
    ['mermaid-er', 'mermaid-er', null],
    ['dictionary', 'dictionary', null],
  ] as const)('reports every change for the edge cases: %s (SC-006)', (key, format, dialect) => {
    const { notes } = schemaExport(edgeCaseDeck(), edgeCaseRequest(format, dialect));
    expect(new Set(notes.map((n) => n.kind))).toEqual(new Set(expectedNoteKinds[key]));
  });
});

describe('schemaFileName', () => {
  const deck: Pick<SododeckFile, 'name'> = { name: 'Shop' };

  it('names files after deck, scope and format', () => {
    expect(schemaFileName(deck, { format: 'sql', scope: { kind: 'deck' } }, null)).toBe('shop.sql');
    expect(
      schemaFileName(deck, { format: 'sql', scope: { kind: 'selection', tableIds: [] } }, null),
    ).toBe('shop-selection.sql');
    expect(
      schemaFileName(
        deck,
        { format: 'dbml', scope: { kind: 'database', cardId: 'x' } },
        'Orders DB',
      ),
    ).toBe('shop-orders-db.dbml');
    expect(schemaFileName(deck, { format: 'mermaid-er', scope: { kind: 'deck' } }, null)).toBe(
      'shop.mmd',
    );
    expect(schemaFileName(deck, { format: 'dictionary', scope: { kind: 'deck' } }, null)).toBe(
      'shop-dictionary.md',
    );
    expect(
      schemaFileName(
        { name: undefined },
        { format: 'dictionary', scope: { kind: 'database', cardId: 'x' } },
        'Orders DB',
      ),
    ).toBe('untitled-deck-orders-db-dictionary.md');
  });
});
