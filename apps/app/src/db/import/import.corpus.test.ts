/**
 * The fixture corpus (044 T016, T023, FR-029): every file through split → detect → read → plan
 * with deterministic ids, compared with its expected JSON (reviewed by hand; `vitest -u` rewrites
 * it), plus "no silent drop" (SC-005) and the backlog's acceptance criteria (SC-001, SC-002).
 */
import { describe, expect, it } from 'vitest';

import { CORPUS, SQL_CORPUS, type CorpusFile } from '../fixtures/import/corpus';
import { createAllocator } from './build-plan';
import { createParsers } from './load-parsers';
import { runImport } from './pipeline';
import { splitSql } from './split-sql';
import type { ImportTarget, StatementKind } from './types';

const TARGET: ImportTarget = {
  kind: 'deck',
  deckDialect: 'generic',
  deckHasTables: false,
  deckHasDescription: false,
  tableNames: [],
  enumNames: [],
};
const parsers = createParsers();

const run = (file: CorpusFile) =>
  runImport(
    { text: CORPUS[file], fileName: file, format: 'auto', dialect: 'auto', detectFk: true },
    TARGET,
    parsers,
    createAllocator(),
  );

const MODELLED: readonly StatementKind[] = [
  'create-table',
  'create-type',
  'create-index',
  'alter-table',
  'comment-on',
];

describe('import corpus', () => {
  it.each(Object.keys(CORPUS) as CorpusFile[])('maps %s as expected', async (file) => {
    const { plan, preview } = await run(file);
    await expect(`${JSON.stringify({ preview, plan }, null, 2)}\n`).toMatchFileSnapshot(
      `../fixtures/import/__expected__/${file}.json`,
    );
  });

  it.each(Object.keys(SQL_CORPUS) as (keyof typeof SQL_CORPUS)[])(
    'maps or reports every statement of %s (SC-005)',
    async (file) => {
      const { plan } = await run(file);
      const reported = new Set(plan.report.skipped.map((s) => s.line));
      for (const statement of splitSql(SQL_CORPUS[file])) {
        if (!MODELLED.includes(statement.kind))
          expect(reported, statement.text).toContain(statement.line);
      }
      const creates = splitSql(SQL_CORPUS[file]).filter((s) => s.kind === 'create-table').length;
      const skippedCreates = plan.report.skipped.filter((s) =>
        /^CREATE (\w+ )*TABLE/i.test(s.excerpt),
      ).length;
      expect(plan.report.mapped.tables + skippedCreates).toBeGreaterThanOrEqual(creates);
    },
  );

  it('imports the 30-table dump with every foreign key between the right column rows (SC-001)', async () => {
    const { plan, preview } = await run('pg-30-tables.sql');
    expect(preview).toMatchObject({
      detectedDialect: 'postgres',
      dialectOutcome: 'set',
      counts: { tables: 30, relationships: 35, enums: 2 },
    });
    expect(preview.error).toBeUndefined();
    const { nodes, edges } = plan.fragment.deck;
    const columnOf = new Map(
      nodes.flatMap((n) => (n.columns ?? []).map((c) => [c.id, `${n.title}.${c.name}`])),
    );
    const label = (ids: readonly string[] | undefined) =>
      (ids ?? []).map((id) => columnOf.get(id)).join(',');
    const rendered = edges.map((e) => `${label(e.fromColumns)} → ${label(e.toColumns)}`);
    expect(rendered).toContain(
      'shipment_items.order_id,shipment_items.product_id → order_items.order_id,order_items.product_id',
    );
    expect(rendered).toContain('employees.manager_id → employees.id');
    expect(rendered).toContain('addresses.customer_id → customers.id');
    expect(
      edges.every(
        (e) => (e.fromColumns?.length ?? 0) > 0 && e.fromColumns?.length === e.toColumns?.length,
      ),
    ).toBe(true);
  });

  it('lists the view at its line (SC-002)', async () => {
    const { plan } = await run('pg-30-tables.sql');
    const line =
      CORPUS['pg-30-tables.sql'].split('\n').findIndex((l) => l.startsWith('CREATE VIEW')) + 1;
    expect(plan.report.skipped).toContainEqual({
      line,
      excerpt: 'CREATE VIEW public.order_totals AS',
      reason: 'view',
    });
  });

  it('blocks a file with a syntax error at its line', async () => {
    const { preview } = await run('syntax-error.sql');
    expect(preview.error?.line).toBe(12);
  });
});
