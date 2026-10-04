/** SC-006: a 300-table, 3,600-column file reads and plans within 3 s (Node, no layout). */
import { describe, expect, it } from 'vitest';

import { largeDbml, largeSql } from '../fixtures/import/large';
import { createParsers } from './load-parsers';
import { runImport } from './pipeline';
import type { ImportTarget } from './types';

const TARGET: ImportTarget = {
  kind: 'new-deck',
  deckDialect: 'generic',
  deckHasTables: false,
  deckHasDescription: false,
  tableNames: [],
  enumNames: [],
};

describe('import performance (SC-006)', () => {
  it.each([
    ['SQL', largeSql(300, 12), 'sql'],
    ['DBML', largeDbml(300, 12), 'dbml'],
  ] as const)('plans 300 tables of %s in under 3 s', async (_, text, format) => {
    const parsers = createParsers();
    // Load the parser first: the dialog loads it while the user picks a file.
    if (format === 'sql') await parsers.sql('postgres');
    else await parsers.dbml();
    const started = performance.now();
    const { plan } = await runImport(
      { text, format, dialect: 'postgres', detectFk: true },
      TARGET,
      parsers,
    );
    const elapsed = performance.now() - started;
    expect(plan.report.mapped.tables).toBe(300);
    expect(plan.fragment.deck.nodes.reduce((n, t) => n + (t.columns?.length ?? 0), 0)).toBe(3600);
    expect(plan.report.mapped.relationships).toBe(299);
    expect(elapsed).toBeLessThan(3000);
    console.info(`044 perf: ${format} 300 tables planned in ${String(Math.round(elapsed))} ms`);
  });
});
