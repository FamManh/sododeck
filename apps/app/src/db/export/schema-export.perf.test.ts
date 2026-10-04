// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { generateBenchDeck } from '../../bench/generate-deck';
import { schemaExport } from './schema-export';
import { DEFAULT_SQL_OPTIONS, type SchemaExportRequest } from './types';

/** FR-022, SC-004, research R2: each format writes 150 tables / 1,800 columns in < 50 ms. */
const BUDGET_MS = 50;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

describe('schema export performance', () => {
  const { deck } = generateBenchDeck(150, 400, 42, { tables: 150 });
  const tableIds = new Set(deck.nodes.filter((n) => n.type === 'db-table').map((n) => n.id));

  it('uses a deck of the stated size', () => {
    expect(tableIds.size).toBe(150);
    expect(deck.nodes.reduce((sum, n) => sum + (n.columns?.length ?? 0), 0)).toBe(1800);
    const relationships = deck.edges.filter((e) => tableIds.has(e.from) && tableIds.has(e.to));
    expect(relationships.length).toBeGreaterThanOrEqual(250);
  });

  it.each([
    ['sql', 'postgres'],
    ['sql', 'mysql'],
    ['sql', 'sqlite'],
    ['dbml', null],
    ['mermaid-er', null],
    ['dictionary', null],
  ] as const)('writes %s (%s) under the budget', (format, dialect) => {
    const request: SchemaExportRequest = {
      format,
      scope: { kind: 'deck' },
      dialect,
      sql: DEFAULT_SQL_OPTIONS,
    };
    schemaExport(deck, request);
    const times = Array.from({ length: 5 }, () => {
      const start = performance.now();
      schemaExport(deck, request);
      return performance.now() - start;
    });
    expect(median(times)).toBeLessThan(BUDGET_MS);
  });
});
