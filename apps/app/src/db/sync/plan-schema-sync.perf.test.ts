// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { generateBenchDeck } from '../../bench/generate-deck';
import { schemaExport } from '../export/schema-export';
import { DEFAULT_SQL_OPTIONS } from '../export/types';
import { createParsers } from '../import/load-parsers';
import { readDbml } from '../import/read-dbml';
import { planSchemaSync } from './plan-schema-sync';
import type { SyncContext } from './types';

/** research R14, SC-005: planning 150 tables / 1,800 columns / 250 relationships takes ≤ 30 ms. */
const PLAN_BUDGET_MS = 30;
/** The worker reads it in ~75 ms (044 R15); the same code on a test machine gets a wide margin. */
const READ_BUDGET_MS = 500;

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

describe('schema sync performance', () => {
  const { deck } = generateBenchDeck(150, 400, 42, { tables: 150 });
  const text = schemaExport(deck, {
    format: 'dbml',
    scope: { kind: 'deck' },
    dialect: null,
    sql: DEFAULT_SQL_OPTIONS,
  }).text;
  let counter = 0;
  const context = (): SyncContext => ({
    scope: { kind: 'schema' },
    memory: new Map(),
    newId: (prefix) => `${prefix}.p${String(counter++)}`,
    viewport: { x: 0, y: 0, width: 1000, height: 600 },
  });

  it('uses a deck of the stated size', () => {
    const tables = deck.nodes.filter((n) => n.type === 'db-table');
    expect(tables).toHaveLength(150);
    expect(tables.reduce((sum, n) => sum + (n.columns?.length ?? 0), 0)).toBe(1800);
    expect(deck.edges.length).toBeGreaterThanOrEqual(250);
  });

  it('reads the text, then plans it (empty and with an edit) within the budgets', async () => {
    const dbml = await createParsers().dbml();
    readDbml(text, dbml);
    const start = performance.now();
    const { raw, problems } = readDbml(text, dbml);
    const readMs = performance.now() - start;
    expect(problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(readMs).toBeLessThan(READ_BUDGET_MS);

    planSchemaSync(deck, raw, context());
    const times = Array.from({ length: 5 }, () => {
      const t0 = performance.now();
      const result = planSchemaSync(deck, raw, context());
      expect(result.plan.isEmpty).toBe(true);
      return performance.now() - t0;
    });
    expect(median(times)).toBeLessThan(PLAN_BUDGET_MS);

    // One column added to a table: a real plan, same budget.
    const editedText = text.replace(/(Table \w+ \{\n)/, '$1  extra_column integer\n');
    const edited = readDbml(editedText, dbml);
    expect(edited.problems).toEqual([]);
    const withEdit = Array.from({ length: 5 }, () => {
      const t0 = performance.now();
      const result = planSchemaSync(deck, edited.raw, context());
      expect(result.plan.isEmpty).toBe(false);
      expect(result.plan.removeTables).toEqual([]);
      return performance.now() - t0;
    });
    expect(median(withEdit)).toBeLessThan(PLAN_BUDGET_MS);
  });
});
