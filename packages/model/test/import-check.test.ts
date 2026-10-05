import { readFileSync } from 'node:fs';

import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { inspectDeckText, problemReport, stringifyReport, type ProblemEntry } from '../src';

const broken = (name: string) =>
  readFileSync(new URL(`./fixtures/broken/${name}`, import.meta.url), 'utf8');

const refused = (text: string): ProblemEntry[] => {
  const result = inspectDeckText(text);
  if (result.ok) throw new Error('expected the file to be refused');
  return result.entries;
};
const located = (entries: readonly ProblemEntry[]) =>
  entries.map((e) => [e.code, e.path ?? `line ${String(e.line)}:${String(e.column)}`]);

describe('inspectDeckText: refused files (062 US1)', () => {
  it('lists a missing title and a duplicate id together, in file order', () => {
    const entries = refused(broken('missing-title-and-duplicate-id.sododeck'));
    expect(located(entries)).toEqual([
      ['schema-required', '/nodes/2/title'],
      ['duplicate-id', '/nodes/3/id'],
    ]);
    expect(entries[0]).toEqual({
      code: 'schema-required',
      severity: 'error',
      path: '/nodes/2/title',
      subject: 'payments',
      message: '"title" is missing.',
      fix: 'Add "title" (a string) to node "payments".',
    });
    expect(entries[1]).toMatchObject({ subject: 'api', evidence: '"api"' });
  });

  it('gives a file that is not JSON one invalid-json entry with line and column', () => {
    const entries = refused(broken('not-json.sododeck'));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      code: 'invalid-json',
      severity: 'error',
      line: 9,
      column: 7,
    });
    expect(entries[0]?.path).toBeUndefined();
    expect(entries[0]?.column).toBeGreaterThan(0);
    expect(entries[0]?.message).toMatch(/^The file is not valid JSON: /);
    expect(entries[0]?.fix).toBe(
      'Fix the JSON syntax at line 9, column 7 (often a missing comma or quote just before it).',
    );
  });

  it('reads line and column from the position when the engine gives only that', () => {
    const entries = refused('{\n  "a": 1,\n  oops\n}');
    expect(entries[0]).toMatchObject({ code: 'invalid-json', line: 3, column: 3 });
  });

  it('refuses an empty file as not JSON', () => {
    expect(refused('')[0]?.code).toBe('invalid-json');
  });

  it('refuses a newer format version with the version found', () => {
    expect(refused(broken('version-2.sododeck'))).toEqual([
      {
        code: 'unsupported-version',
        severity: 'error',
        path: '/version',
        message: 'The file is written for format version 2; this app reads version 1.',
        evidence: '2',
        fix: 'Open it in a newer Sododeck, or write it for format version 1.',
      },
    ]);
  });

  it.each([
    ['wrong-type.sododeck', 'schema-type', '/nodes/1/title'],
    ['unknown-enum.sododeck', 'schema-enum', '/edges/0/protocol'],
    ['unknown-field.sododeck', 'schema-unknown-field', '/nodes/0/kind'],
    ['rule-row-cells.sododeck', 'rule-row-cells', '/rules/fee/rows/0/when'],
    ['ambiguous-end.sododeck', 'ambiguous-end', '/groups/0/id'],
  ])('%s → %s at %s', (file, code, path) => {
    const entries = refused(broken(file));
    expect(located(entries)).toEqual([[code, path]]);
    for (const entry of entries) {
      expect(entry.fix).not.toBe('');
      expect(entry.message).not.toBe('');
    }
  });

  it('reads evidence from the file when the check gives none', () => {
    const [entry] = refused(broken('rule-row-cells.sododeck'));
    expect(entry?.evidence).toBe('[">= 100"]');
  });

  it('strips a byte order mark', () => {
    const text = `\uFEFF${JSON.stringify(emptySododeckFile())}`;
    expect(inspectDeckText(text).ok).toBe(true);
  });

  it('copies the same file to the same bytes (SC-003)', () => {
    const copy = () =>
      stringifyReport(
        problemReport({
          source: { kind: 'file', name: 'x.sododeck' },
          status: 'refused',
          app: '0.0.0',
          entries: refused(broken('missing-title-and-duplicate-id.sododeck')),
        }),
      );
    expect(copy()).toBe(copy());
  });

  it('sorts 10,000 duplicate ids in under a second (SC-004)', () => {
    const nodes = Array.from({ length: 20_000 }, (_, i) => ({
      id: `n${String(i % 10_000)}`,
      type: 'service',
      title: 'x',
    }));
    const text = JSON.stringify({ ...emptySododeckFile(), nodes });
    const start = performance.now();
    const entries = refused(text);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(entries).toHaveLength(10_000);
    expect(entries[0]?.path).toBe('/nodes/10000/id');
    expect(entries.at(-1)?.path).toBe('/nodes/19999/id');
  });
});

describe('inspectDeckText: decks that open (062 US2)', () => {
  const opened = (text: string): ProblemEntry[] => {
    const result = inspectDeckText(text);
    if (!result.ok) throw new Error('expected the file to open');
    return result.entries;
  };

  it('lists a damaged picture and a step without connection, in file order', () => {
    const entries = opened(broken('dangling-step-and-bad-picture.sododeck'));
    expect(located(entries)).toEqual([
      ['step-without-connection', '/flows/0/steps/2'],
      ['picture-damaged', `/assets/${'a'.repeat(64)}`],
    ]);
    expect(entries[1]).toMatchObject({
      severity: 'warning',
      subject: 'a'.repeat(64),
      message: 'Picture "logo.png" is damaged: its data does not match its size.',
    });
  });

  it.each([
    ['dangling-connector.sododeck', 'broken-reference', '/edges/2'],
    ['broken-rule-reference.sododeck', 'missing-rule', '/nodes/2'],
  ])('%s opens with %s at %s', (file, code, path) => {
    expect(located(opened(broken(file)))).toEqual([[code, path]]);
  });

  it('opens a clean deck with no entries', () => {
    const result = inspectDeckText(JSON.stringify(emptySododeckFile()));
    expect(result.ok).toBe(true);
    expect(result.entries).toEqual([]);
  });
});
