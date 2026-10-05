import { CATALOGUE, DB_FIDELITY_CODES } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { CHANGE_MAPPING, SKIP_MAPPING, toFidelityReport } from './fidelity';
import { SKIP_REASON_TEXT } from './report-text';
import type { ImportReport } from './types';

const report = (patch: Partial<ImportReport> = {}): ImportReport => ({
  source: { fileName: 'shop.sql', format: 'sql', dialect: 'postgres' },
  mapped: { tables: 3, relationships: 2, enums: 1, indexes: 0, checks: 0, groups: 0, stickies: 0 },
  skipped: [],
  changed: [],
  suggestions: null,
  ...patch,
});

describe('toFidelityReport (SQL / DBML, 062 R9)', () => {
  it('says everything was imported when nothing was skipped or changed', () => {
    expect(toFidelityReport(report())).toEqual({
      report: 'sododeck-import',
      reportVersion: 1,
      source: { format: 'sql', name: 'shop.sql', dialect: 'postgres' },
      created: {
        tables: 3,
        relationships: 2,
        enums: 1,
        indexes: 0,
        checks: 0,
        groups: 0,
        stickies: 0,
      },
      complete: true,
      items: [],
    });
  });

  it('maps every skip reason and change kind to a catalogued code and one group', () => {
    const reasons = Object.keys(SKIP_REASON_TEXT) as (keyof typeof SKIP_REASON_TEXT)[];
    expect(Object.keys(SKIP_MAPPING).sort()).toEqual([...reasons].sort());
    expect(Object.keys(CHANGE_MAPPING)).toHaveLength(7);
    const codes = [...Object.values(SKIP_MAPPING), ...Object.values(CHANGE_MAPPING)].map(
      (m) => m.code,
    );
    expect([...codes].sort()).toEqual([...DB_FIDELITY_CODES].sort());
    for (const { code, group } of [
      ...Object.values(SKIP_MAPPING),
      ...Object.values(CHANGE_MAPPING),
    ]) {
      expect(CATALOGUE[code].group).toBe(group);
    }
  });

  it.each([
    ['view', 'left-out'],
    ['schema', 'collapsed'],
    ['dangling-fk', 'left-out'],
    ['parse-error', 'not-supported'],
    ['unknown', 'not-supported'],
  ] as const)('puts a %s statement under %s', (reason, group) => {
    const [item] = toFidelityReport(
      report({ skipped: [{ line: 7, excerpt: 'CREATE …', reason }] }),
    ).items;
    expect(item).toMatchObject({
      code: `import-db-${reason}`,
      group,
      line: 7,
      excerpt: 'CREATE …',
    });
  });

  it('keeps the detail as the message, the target, and a fix where the input can change', () => {
    const items = toFidelityReport(
      report({
        skipped: [
          {
            line: 9,
            excerpt: 'ALTER TABLE …',
            reason: 'dangling-fk',
            detail: 'references accounts',
          },
          { line: 3, excerpt: 'CREATE VIEW v', reason: 'view' },
        ],
        changed: [
          { line: 5, target: 'orders.total', kind: 'type-converted', detail: 'money → decimal' },
          {
            line: 34,
            firstLine: 27,
            target: 'places',
            kind: 'renamed-duplicate',
            detail: 'places appears twice in this import; the second is imported as places_copy',
          },
        ],
      }),
    ).items;
    expect(items).toEqual([
      {
        code: 'import-db-view',
        group: 'left-out',
        line: 3,
        excerpt: 'CREATE VIEW v',
        message: 'Views are not modelled.',
      },
      {
        code: 'import-db-type-converted',
        group: 'collapsed',
        line: 5,
        target: 'orders.total',
        message: 'Money → decimal.',
      },
      {
        code: 'import-db-dangling-fk',
        group: 'left-out',
        line: 9,
        excerpt: 'ALTER TABLE …',
        message: 'References accounts.',
        fix: 'Include the referenced table in the import.',
      },
      {
        code: 'import-db-renamed-duplicate',
        group: 'merged',
        lines: [27, 34],
        target: 'places',
        message: 'Places appears twice in this import; the second is imported as places_copy.',
        fix: 'Give each table a unique name in the input.',
      },
    ]);
  });

  it('puts changes without a line after the others', () => {
    const items = toFidelityReport(
      report({
        changed: [{ target: 'orders', kind: 'schema-dropped', detail: 'schema sales dropped' }],
        skipped: [{ line: 1, excerpt: 'SET x', reason: 'session' }],
      }),
    ).items;
    expect(items.map((i) => i.code)).toEqual(['import-db-session', 'import-db-schema-dropped']);
  });
});
