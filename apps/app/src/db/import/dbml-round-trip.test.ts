import { createDeck, createEditor, toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { schemaExport } from '../export/schema-export';
import { DEFAULT_SQL_OPTIONS } from '../export/types';
import { edgeCaseDeck } from '../fixtures/export-edge-cases';
import { shopDeck } from '../fixtures/shop';
import { applyImport } from './apply-import';
import { createParsers } from './load-parsers';
import { runImport } from './pipeline';
import type { ImportTarget } from './types';

const EMPTY: ImportTarget = {
  kind: 'deck',
  deckDialect: 'generic',
  deckHasTables: false,
  deckHasDescription: false,
  tableNames: [],
  enumNames: [],
};

function dbml(deck: SododeckFile): string {
  return schemaExport(deck, {
    format: 'dbml',
    scope: { kind: 'deck' },
    dialect: null,
    sql: DEFAULT_SQL_OPTIONS,
  }).text;
}

/** Imports `text` into an empty deck named `name` and returns the deck file. */
async function importInto(text: string, name: string): Promise<SododeckFile> {
  const { plan, preview } = await runImport(
    { text, format: 'dbml', dialect: 'auto', detectFk: false },
    EMPTY,
    createParsers(),
  );
  expect(preview.error).toBeUndefined();
  const doc = createDeck();
  const editor = createEditor(doc);
  editor.updateMeta({ name });
  applyImport(editor, plan, { positions: {}, frames: {}, stickies: [] });
  const file = toJSON(doc);
  editor.destroy();
  return file;
}

const relKey = (r: {
  from?: string;
  to?: string;
  fromColumns?: (string | undefined)[];
  label?: string;
}) => `${r.from ?? ''}|${(r.fromColumns ?? []).join(',')}|${r.to ?? ''}|${r.label ?? ''}`;

/** The schema of a deck by name: tables, columns, indexes, checks, enums and relationships. */
function schemaByName(deck: SododeckFile) {
  const tables = deck.nodes.filter((n) => n.type === 'db-table');
  const tableName = new Map(tables.map((t) => [t.id, t.title]));
  const columnName = new Map(tables.flatMap((t) => (t.columns ?? []).map((c) => [c.id, c.name])));
  const enumName = new Map((deck.enums ?? []).map((e) => [e.id, e.name]));
  const part = (p: string | { expr: string }) => (typeof p === 'string' ? columnName.get(p) : p);
  return {
    tables: tables
      .map((t) => ({
        name: t.title,
        schema: t.schema,
        note: t.description,
        columns: (t.columns ?? []).map(({ id: _id, enumRef, ...c }) => ({
          ...c,
          enum: enumRef === undefined ? undefined : enumName.get(enumRef),
        })),
        indexes: (t.indexes ?? []).map(({ id: _id, columns, ...i }) => ({
          ...i,
          columns: columns.map(part),
        })),
        checks: (t.checks ?? []).map(({ id: _id, ...c }) => c),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    enums: (deck.enums ?? []).map(({ id: _id, values, ...e }) => ({
      ...e,
      values: values.map(({ id: _v, ...v }) => v),
    })),
    relationships: deck.edges
      .filter((e) => tableName.has(e.from) && tableName.has(e.to))
      .map(({ id: _id, from, to, fromColumns, toColumns, ...e }) => ({
        ...e,
        from: tableName.get(from),
        to: tableName.get(to),
        fromColumns: fromColumns?.map((c) => columnName.get(c)),
        toColumns: toColumns?.map((c) => columnName.get(c)),
      }))
      .sort((a, b) => relKey(a).localeCompare(relKey(b))),
  };
}

describe('DBML round-trip with the export (FR-029, SC-003, 045 SC-002)', () => {
  it('imports the Shop DBML to the same schema and exports byte-identical DBML', async () => {
    const source = shopDeck('postgres');
    const first = dbml(source);
    const imported = await importInto(first, source.name ?? 'Shop');
    expect(imported.dialect).toBe('postgres');
    // Column checks come back as table checks (DBML has only the table form); compare the rest.
    const strip = (s: ReturnType<typeof schemaByName>) => ({
      ...s,
      tables: s.tables.map((t) => ({
        ...t,
        columns: t.columns.map(({ check: _check, ...c }) => c),
        checks: [
          ...t.checks,
          ...t.columns.flatMap((c) => (c.check === undefined ? [] : [{ expr: c.check }])),
        ],
      })),
    });
    expect(strip(schemaByName(imported))).toEqual(strip(schemaByName(source)));
    expect(dbml(imported)).toBe(first);
  });

  it('reads the edge-case DBML again and exports the same DBML a second time', async () => {
    // The edge-case export drops what DBML cannot hold (and says so in comments), so the first
    // import is lossy by design; from then on the round-trip is stable.
    const first = dbml(edgeCaseDeck());
    const once = await importInto(first, 'Edge cases');
    const second = dbml(once);
    const twice = await importInto(second, 'Edge cases');
    expect(dbml(twice)).toBe(second);
  });
});
