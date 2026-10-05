import { emptySododeckFile, FORMAT_VERSION, SCHEMA_URL, type Issue } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  CATALOGUE,
  checkDeck,
  issueEntry,
  pictureEntry,
  problemEntries,
  problemEntry,
  problemReport,
  REPORT_LIMIT,
  sortEntries,
  stringifyReport,
  type FidelityReport,
  type Problem,
  type ProblemEntry,
} from '../src';

const problem = (patch: Partial<Problem> = {}): Problem => ({
  key: 'step-without-connection:f:s2',
  kind: 'step-without-connection',
  target: { type: 'flow', flowId: 'f', stepId: 's2' },
  title: 'Step without connection',
  detail: 'Checkout · step 2 used a deleted connection',
  objectTitle: 'Checkout',
  order: 2,
  severity: 'error',
  ...patch,
});

const entry = (path: string, code = 'schema-type', message = 'm'): ProblemEntry => ({
  code,
  severity: 'error',
  path,
  message,
  fix: 'f.',
});

describe('issueEntry', () => {
  it('keeps the issue and adds severity error and its own fix', () => {
    const issue: Issue = {
      code: 'schema-required',
      path: '/nodes/3/title',
      subject: 'payments',
      message: '"title" is missing.',
      fix: 'Add "title" (a string) to node "payments".',
    };
    expect(issueEntry(issue)).toEqual({
      code: 'schema-required',
      severity: 'error',
      path: '/nodes/3/title',
      subject: 'payments',
      message: '"title" is missing.',
      fix: 'Add "title" (a string) to node "payments".',
    });
  });

  it('falls back to the catalogue fix and reads evidence from the input by path', () => {
    const issue: Issue = { code: 'group-frame-pair', path: '/groups/0', message: 'Half.' };
    const input = { groups: [{ id: 'g', title: 'G', position: { x: 1, y: 2 } }] };
    expect(issueEntry(issue, input)).toMatchObject({
      fix: CATALOGUE['group-frame-pair'].fix,
      evidence: '{"id":"g","title":"G","position":{"x":1,"y":2}}',
    });
  });

  it('keeps evidence the issue already has', () => {
    const issue: Issue = {
      code: 'duplicate-id',
      path: '/nodes/1/id',
      message: 'D',
      evidence: '"a"',
    };
    expect(issueEntry(issue, { nodes: [{ id: 'b' }, { id: 'c' }] }).evidence).toBe('"a"');
  });
});

describe('problemEntry', () => {
  it('uses the kind as code, title + detail as message and the catalogue fix', () => {
    expect(problemEntry(problem(), { path: '/flows/0/steps/1', subject: 's2' })).toEqual({
      code: 'step-without-connection',
      severity: 'error',
      path: '/flows/0/steps/1',
      subject: 's2',
      message: 'Step without connection: Checkout · step 2 used a deleted connection.',
      evidence: 'Checkout · step 2 used a deleted connection',
      fix: CATALOGUE['step-without-connection'].fix,
    });
  });
});

describe('problemEntries', () => {
  it('locates every problem in the file and sorts them in file order', () => {
    const file = {
      ...emptySododeckFile(),
      nodes: [
        { id: 'a', type: 'service', title: 'A' },
        { id: 'b', type: 'service', title: 'B' },
      ],
      edges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'b' },
      ],
      flows: [{ id: 'f', title: 'F', steps: [{ id: 's1', edge: 'gone' }] }],
    };
    expect(
      problemEntries(checkDeck(file).list, file).map((e) => [e.code, e.path, e.subject]),
    ).toEqual([
      ['duplicate-connection', '/edges/0', 'e1'],
      ['step-without-connection', '/flows/0/steps/0', 's1'],
    ]);
  });
});

describe('pictureEntry', () => {
  it('reports a damaged picture as a warning on its assets entry', () => {
    expect(pictureEntry({ id: 'ab12', name: 'logo.png', reason: 'size-mismatch' })).toEqual({
      code: 'picture-damaged',
      severity: 'warning',
      path: '/assets/ab12',
      subject: 'ab12',
      message: 'Picture "logo.png" is damaged: its data does not match its size.',
      evidence: 'size-mismatch',
      fix: CATALOGUE['picture-damaged'].fix,
    });
  });

  it('names a picture without a name by its id', () => {
    expect(pictureEntry({ id: 'ab12', reason: 'hash-mismatch' }).message).toBe(
      'Picture ab12 is damaged: its data does not match its id.',
    );
  });
});

describe('sortEntries (FR-006)', () => {
  it('orders by pointer (numbers numerically), then code, then message', () => {
    const sorted = sortEntries([
      entry('/nodes/10'),
      entry('/nodes/2', 'schema-type', 'b'),
      entry('/nodes/2', 'schema-type', 'a'),
      entry('/nodes/2', 'duplicate-id'),
      entry(''),
    ]);
    expect(sorted.map((e) => [e.path, e.code, e.message])).toEqual([
      ['', 'schema-type', 'm'],
      ['/nodes/2', 'duplicate-id', 'm'],
      ['/nodes/2', 'schema-type', 'a'],
      ['/nodes/2', 'schema-type', 'b'],
      ['/nodes/10', 'schema-type', 'm'],
    ]);
  });

  it('puts a line-addressed entry first', () => {
    const notJson: ProblemEntry = {
      code: 'invalid-json',
      severity: 'error',
      line: 3,
      column: 1,
      message: 'x',
      fix: 'y.',
    };
    expect(sortEntries([entry('/a'), notJson])[0]?.code).toBe('invalid-json');
  });
});

describe('problemReport', () => {
  it('builds the contract shape with counts over every entry', () => {
    const report = problemReport({
      source: { kind: 'file', name: 'checkout.sododeck' },
      status: 'refused',
      app: '0.0.0',
      entries: [entry('/a'), { ...entry('/b'), severity: 'warning' }],
    });
    expect(report).toEqual({
      report: 'sododeck-problems',
      reportVersion: 1,
      source: { kind: 'file', name: 'checkout.sododeck' },
      status: 'refused',
      schema: SCHEMA_URL,
      formatVersion: FORMAT_VERSION,
      app: '0.0.0',
      counts: { error: 1, warning: 1, info: 0 },
      problems: [entry('/a'), { ...entry('/b'), severity: 'warning' }],
      omitted: 0,
    });
  });

  it(`keeps at most ${String(REPORT_LIMIT)} entries and counts the rest`, () => {
    const entries = Array.from({ length: REPORT_LIMIT + 7 }, (_, i) => entry(`/n/${String(i)}`));
    const report = problemReport({
      source: { kind: 'deck', name: 'D' },
      status: 'opened',
      app: '1',
      entries,
    });
    expect(report.problems).toHaveLength(REPORT_LIMIT);
    expect(report.omitted).toBe(7);
    expect(report.counts.error).toBe(REPORT_LIMIT + 7);
  });
});

describe('stringifyReport (FR-018, SC-003)', () => {
  it('writes 2-space JSON in the contract key order, without empty optional keys', () => {
    const report = problemReport({
      source: { kind: 'file', name: 'x.sododeck' },
      status: 'refused',
      app: '0.0.0',
      entries: [
        {
          fix: 'Fix.',
          message: 'Bad.',
          column: 5,
          line: 14,
          severity: 'error',
          code: 'invalid-json',
        },
      ],
    });
    const text = stringifyReport(report);
    expect(JSON.parse(text)).toEqual(report);
    expect(Object.keys(JSON.parse(text) as object)).toEqual([
      'report',
      'reportVersion',
      'source',
      'status',
      'schema',
      'formatVersion',
      'app',
      'counts',
      'problems',
      'omitted',
    ]);
    expect(text).toContain(
      '{\n      "code": "invalid-json",\n      "severity": "error",\n      "line": 14,\n      "column": 5,\n      "message": "Bad.",\n      "fix": "Fix."\n    }',
    );
    expect(text.endsWith('\n')).toBe(false);
  });

  it('writes a fidelity report in its key order', () => {
    const report: FidelityReport = {
      items: [
        {
          message: 'Styling is not imported.',
          excerpt: 'style a fill:#f9f',
          line: 3,
          group: 'left-out',
          code: 'import-mermaid-appearance',
        },
      ],
      complete: false,
      created: { components: 1 },
      source: { name: 'a.mmd', format: 'mermaid-flowchart' },
      reportVersion: 1,
      report: 'sododeck-import',
    };
    const parsed = JSON.parse(stringifyReport(report)) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual([
      'report',
      'reportVersion',
      'source',
      'created',
      'complete',
      'items',
    ]);
    expect(Object.keys(parsed.source as object)).toEqual(['format', 'name']);
    expect(Object.keys((parsed.items as object[])[0] ?? {})).toEqual([
      'code',
      'group',
      'line',
      'excerpt',
      'message',
    ]);
  });
});
