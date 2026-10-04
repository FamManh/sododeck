import { describe, expect, it } from 'vitest';

import { SQL_CORPUS } from '../fixtures/import/corpus';
import { createParsers } from './load-parsers';
import { runImport } from './pipeline';
import { remapSuggestions, suggestForeignKeys } from './suggest-fks';
import type { ImportTarget } from './types';

const TARGET: ImportTarget = {
  kind: 'deck',
  deckDialect: 'generic',
  deckHasTables: false,
  deckHasDescription: false,
  tableNames: [],
  enumNames: [],
};

const run = async (text: string, detectFk = true) =>
  runImport({ text, format: 'sql', dialect: 'auto', detectFk }, TARGET, createParsers());

describe('suggestForeignKeys (FR-024, SC-010)', () => {
  it('finds exactly the expected links in the no-constraints fixture', async () => {
    const { plan } = await run(SQL_CORPUS['no-fk.sql']);
    expect(plan.suggestions.map((s) => [s.label, s.cardinality, s.fromOptional])).toEqual([
      ['orders.customer_id → customers.id', 'n-1', false],
      ['orders.companyId → company.id', 'n-1', true],
      ['order_lines.order_id → orders.id', 'n-1', false],
      ['order_lines.category_id → categories.id', '1-1', true],
    ]);
  });

  it('suggests nothing for a column with a foreign key, its own key, or another type family', async () => {
    const { plan } = await run(`CREATE TABLE users (user_id int PRIMARY KEY);
CREATE TABLE posts (id int PRIMARY KEY, user_id int REFERENCES users (user_id), owner_id int, author_id text);
CREATE TABLE authors (id int PRIMARY KEY);`);
    expect(plan.suggestions.map((s) => s.label)).toEqual([]);
  });

  it('suggests nothing when the option is off', async () => {
    const { plan } = await run(SQL_CORPUS['no-fk.sql'], false);
    expect(plan.suggestions).toEqual([]);
  });

  it('remaps plan ids to deck ids and drops what does not map', async () => {
    const { plan } = await run(SQL_CORPUS['no-fk.sql']);
    const [first] = suggestForeignKeys(plan);
    expect(first).toBeDefined();
    if (first === undefined) return;
    const ids = new Map([
      [first.fromTable, 'n1'],
      [first.fromColumn, 'c1'],
      [first.toTable, 'n2'],
      [first.toColumn, 'c2'],
    ]);
    expect(remapSuggestions([first, { ...first, fromTable: 'gone' }], ids)).toEqual([
      { ...first, fromTable: 'n1', fromColumn: 'c1', toTable: 'n2', toColumn: 'c2' },
    ]);
  });
});
