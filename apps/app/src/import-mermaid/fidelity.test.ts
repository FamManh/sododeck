import { CATALOGUE, MERMAID_FIDELITY_CODES } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { prepare } from './detect';
import { flowchartToDeck } from './flowchart-to-deck';
import { toFidelityReport } from './fidelity';
import type { ImportReport, SkipReason } from './import-report';
import { parseFlowchart } from './parse-flowchart';

const report = (patch: Partial<ImportReport> = {}): ImportReport => ({
  kind: 'flowchart',
  counts: { components: 2, connections: 1, groups: 0, steps: 0 },
  skipped: [],
  notes: [],
  ...patch,
});

describe('toFidelityReport (Mermaid, 062 R9)', () => {
  it('says everything was imported when nothing was skipped', () => {
    expect(toFidelityReport(report(), 'a.mmd')).toEqual({
      report: 'sododeck-import',
      reportVersion: 1,
      source: { format: 'mermaid-flowchart', name: 'a.mmd' },
      created: { components: 2, connections: 1, groups: 0, steps: 0 },
      complete: true,
      items: [],
    });
  });

  it.each<[SkipReason, string, string]>([
    ['appearance', 'import-mermaid-appearance', 'left-out'],
    ['interaction', 'import-mermaid-interaction', 'left-out'],
    ['extra-diagram', 'import-mermaid-extra-diagram', 'left-out'],
    ['unsupported', 'import-mermaid-unsupported', 'not-supported'],
    ['unreadable', 'import-mermaid-unreadable', 'not-supported'],
    ['flattened', 'import-mermaid-flattened', 'collapsed'],
  ])('maps %s to %s under %s', (reason, code, group) => {
    const [item] = toFidelityReport(report({ skipped: [{ line: 4, text: 'x', reason }] })).items;
    expect(item).toMatchObject({ code, group, line: 4, excerpt: 'x' });
    expect(item?.message).not.toBe('');
  });

  it('gives a fix hint only where changing the input helps', () => {
    const items = toFidelityReport(
      report({
        skipped: [
          { line: 2, text: 'style a fill:#f9f', reason: 'appearance' },
          { line: 3, text: 'a =>> b', reason: 'unreadable' },
        ],
      }),
    ).items;
    expect(items[0]?.fix).toBeUndefined();
    expect(items[1]?.fix).toBe('Check the syntax on this line.');
  });

  it('names a merged declaration with both lines and a fix', () => {
    const [item] = toFidelityReport(
      report({
        skipped: [{ line: 9, text: 'api(API v2)', reason: 'merged', key: 'api', lines: [3, 9] }],
      }),
    ).items;
    expect(item).toEqual({
      code: 'import-mermaid-merged-declaration',
      group: 'merged',
      lines: [3, 9],
      excerpt: 'api(API v2)',
      message: '"api" is declared more than once; the declarations were combined into one.',
      fix: 'Declare "api" once, or give the second one its own id.',
    });
  });

  it('turns notes into collapsed items after the lines, and keeps input order', () => {
    const items = toFidelityReport(
      report({
        kind: 'sequence',
        skipped: [
          { line: 5, text: 'b', reason: 'unsupported' },
          { line: 2, text: 'a', reason: 'appearance' },
        ],
        notes: ['Branching in sequence blocks was flattened'],
      }),
    ).items;
    expect(items.map((i) => [i.code, i.line ?? null])).toEqual([
      ['import-mermaid-appearance', 2],
      ['import-mermaid-unsupported', 5],
      ['import-mermaid-note', null],
    ]);
  });

  it('uses only catalogued codes (FR-019)', () => {
    for (const code of MERMAID_FIDELITY_CODES) expect(CATALOGUE[code].group).toBeDefined();
  });

  it('reports a flowchart with a style line, a nested subgraph, a click and a node declared twice (SC-005)', () => {
    const text = [
      'flowchart LR',
      '  subgraph outer',
      '    subgraph inner',
      '      api[Gateway]',
      '    end',
      '  end',
      '  web --> api(API v2)',
      '  style api fill:#f9f',
      '  click api callback',
    ].join('\n');
    const { report: parsed } = flowchartToDeck(parseFlowchart(prepare(text)));
    const fidelity = toFidelityReport(parsed);
    expect(fidelity.complete).toBe(false);
    expect(fidelity.items.map((i) => [i.group, i.code])).toEqual([
      ['merged', 'import-mermaid-merged-declaration'],
      ['left-out', 'import-mermaid-appearance'],
      ['left-out', 'import-mermaid-interaction'],
    ]);
  });
});
