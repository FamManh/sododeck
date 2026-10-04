import { emptySododeckFile, type Node, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import type { RawColumn, RawSchema, RawTable } from '../import/types';
import { emptyPlan } from './types';
import {
  lineProblem,
  nonInputProblems,
  validateEnumDefaults,
  validatePlan,
  validateText,
} from './validate';

const col = (name: string, line: number, extra: Partial<RawColumn> = {}): RawColumn => ({
  name,
  type: 'int',
  line,
  ...extra,
});
const tbl = (name: string, line: number, columns: RawColumn[], extra: Partial<RawTable> = {}) =>
  ({ name, line, columns, indexes: [], checks: [], ...extra }) satisfies RawTable;
const raw = (extra: Partial<RawSchema>): RawSchema => ({
  format: 'dbml',
  tables: [],
  refs: [],
  enums: [],
  groups: [],
  notes: [],
  skipped: [],
  changed: [],
  ...extra,
});
const deckOf = (nodes: Node[]): SododeckFile => ({ ...emptySododeckFile(), nodes });
const dbTable = (id: string, title: string, columns: string[] = ['id']): Node => ({
  id,
  type: 'db-table',
  title,
  columns: columns.map((name) => ({ id: `${id}.${name}`, name, type: 'int' })),
});
const SCHEMA = { kind: 'schema' } as const;
const codes = (problems: { code: string }[]) => problems.map((p) => p.code);

describe('validateText', () => {
  it('flags a duplicate table (case-insensitive, public is no schema) at the second', () => {
    const problems = validateText(
      deckOf([]),
      raw({
        tables: [
          tbl('Orders', 1, []),
          tbl('orders', 5, []),
          tbl('orders', 9, [], { schema: 'public' }),
        ],
      }),
      SCHEMA,
    );
    expect(problems.map((p) => [p.code, p.line, p.severity])).toEqual([
      ['duplicate-table', 5, 'error'],
      ['duplicate-table', 9, 'error'],
    ]);
  });

  it('keeps tables of different schemas apart', () => {
    const problems = validateText(
      deckOf([]),
      raw({ tables: [tbl('a', 1, [], { schema: 'one' }), tbl('a', 5, [], { schema: 'two' })] }),
      SCHEMA,
    );
    expect(problems).toEqual([]);
  });

  it('flags a duplicate column, a duplicate named index and a duplicate enum', () => {
    const problems = validateText(
      deckOf([]),
      raw({
        tables: [
          tbl('t', 1, [col('a', 2), col('A', 3)], {
            indexes: [
              { name: 'i', parts: [{ column: 'a' }], line: 4 },
              { name: 'I', parts: [{ column: 'a' }], line: 5 },
              { parts: [{ column: 'a' }], line: 6 },
              { parts: [{ column: 'a' }], line: 7 },
            ],
          }),
        ],
        enums: [
          { name: 'e', values: [], line: 8 },
          { name: 'E', values: [], line: 9 },
        ],
      }),
      SCHEMA,
    );
    expect(problems.map((p) => [p.code, p.line])).toEqual([
      ['duplicate-column', 3],
      ['duplicate-index', 5],
      ['duplicate-enum', 9],
    ]);
  });

  it('flags a relationship end that names no table or no column', () => {
    const end = (name: string, columns: string[]) => ({ name, columns });
    const problems = validateText(
      deckOf([]),
      raw({
        tables: [tbl('a', 1, [col('id', 2)]), tbl('b', 3, [col('id', 4)])],
        refs: [
          { from: end('a', ['id']), to: end('nope', ['id']), line: 10, excerpt: '' },
          { from: end('a', ['id']), to: end('b', ['zzz']), line: 11, excerpt: '' },
        ],
      }),
      SCHEMA,
    );
    expect(problems.map((p) => [p.code, p.line])).toEqual([
      ['missing-ref-table', 10],
      ['missing-ref-column', 11],
    ]);
  });

  it('in Selection, resolves a relationship end against the deck tables outside the selection', () => {
    const deck = deckOf([dbTable('a', 'a'), dbTable('o', 'other', ['id', 'x'])]);
    const end = (name: string, columns: string[]) => ({ name, columns });
    const ok = validateText(
      deck,
      raw({
        tables: [tbl('a', 1, [col('id', 2)])],
        refs: [{ from: end('a', ['id']), to: end('other', ['x']), line: 5, excerpt: '' }],
      }),
      { kind: 'selection', baseline: ['a'] },
    );
    expect(ok).toEqual([]);
    const bad = validateText(
      deck,
      raw({
        tables: [tbl('a', 1, [col('id', 2)])],
        refs: [{ from: end('a', ['id']), to: end('other', ['nope']), line: 5, excerpt: '' }],
      }),
      { kind: 'selection', baseline: ['a'] },
    );
    expect(codes(bad)).toEqual(['missing-ref-column']);
  });

  it('in Selection, refuses a new table that takes the name of a table outside', () => {
    const deck = deckOf([dbTable('a', 'a'), dbTable('o', 'Other')]);
    const problems = validateText(deck, raw({ tables: [tbl('a', 1, []), tbl('other', 4, [])] }), {
      kind: 'selection',
      baseline: ['a'],
    });
    expect(problems.map((p) => [p.code, p.line])).toEqual([['duplicate-table', 4]]);
  });
});

describe('validateEnumDefaults', () => {
  it('flags a default that is not a value of the enum, with a suggestion', () => {
    const schema = raw({
      tables: [tbl('t', 1, [col('status', 2, { default: { kind: 'value', value: 'oops' } })])],
    });
    const problems = validateEnumDefaults(
      schema,
      new Map([['e1', ['pending', 'paid']]]),
      () => 'e1',
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ code: 'enum-default', line: 2, suggestion: 'pending' });
  });

  it('accepts a default that is a value, and ignores columns without an enum', () => {
    const schema = raw({
      tables: [
        tbl('t', 1, [
          col('a', 2, { default: { kind: 'value', value: 'paid' } }),
          col('b', 3, { default: { kind: 'value', value: 'x' } }),
        ]),
      ],
    });
    const problems = validateEnumDefaults(
      schema,
      new Map([['e1', ['pending', 'paid']]]),
      (_t, c) => (c === 0 ? 'e1' : undefined),
    );
    expect(problems).toEqual([]);
  });
});

describe('nonInputProblems', () => {
  it('warns on each block that is not an input, on its line', () => {
    const problems = nonInputProblems(
      raw({
        inputs: [
          { kind: 'table-group', line: 4 },
          { kind: 'note', line: 7 },
          { kind: 'header-color', line: 9, column: 3, endLine: 9, endColumn: 20 },
          { kind: 'ref-color', line: 12 },
          { kind: 'records', line: 14 },
        ],
      }),
    );
    expect(problems.map((p) => [p.code, p.severity, p.line])).toEqual([
      ['not-an-input', 'warning', 4],
      ['not-an-input', 'warning', 7],
      ['not-an-input', 'warning', 9],
      ['not-an-input', 'warning', 12],
      ['not-an-input', 'warning', 14],
    ]);
    expect(problems[2]).toMatchObject({ column: 3, endColumn: 20 });
  });

  it('does not warn on the writer’s own Project block, but on one that disagrees', () => {
    const own = raw({ inputs: [{ kind: 'project', line: 1 }], dialect: 'postgres' });
    expect(nonInputProblems(own, 'postgres')).toEqual([]);
    expect(nonInputProblems(own, 'mysql')).toHaveLength(1);
    expect(nonInputProblems({ ...own, projectNote: 'hi' }, 'postgres')).toHaveLength(1);
  });
});

describe('validatePlan', () => {
  const locked: Node = { ...dbTable('t', 'Orders'), locked: true };
  const deck = deckOf([locked]);

  it('refuses to change or remove a locked table, at its line', () => {
    const change = { ...emptyPlan(), updateTables: [{ id: 't', patch: { title: 'x' } }] };
    expect(validatePlan(deck, change, { tableLine: new Map([['t', 6]]), enumUsers: [] })).toEqual([
      expect.objectContaining({ code: 'locked', line: 6, severity: 'error' }),
    ]);
    const remove = { ...emptyPlan(), removeTables: [{ id: 't', name: 'Orders' }] };
    const [problem] = validatePlan(deck, remove, { tableLine: new Map(), enumUsers: [] });
    expect(problem).toMatchObject({ code: 'locked', line: 1 });
    expect(problem?.message).toMatch(/cannot be removed/);
  });

  it('refuses to remove an enum that columns outside the text still use', () => {
    const problems = validatePlan(deckOf([]), emptyPlan(), {
      tableLine: new Map(),
      enumUsers: [
        { id: 'e', name: 'status', users: 2 },
        { id: 'f', name: 'kind', users: 0 },
      ],
    });
    expect(problems.map((p) => p.code)).toEqual(['enum-in-use']);
    expect(problems[0]?.message).toMatch(/status/);
  });

  it('lineProblem spans the whole line', () => {
    expect(lineProblem(3, 'syntax', 'm')).toMatchObject({ line: 3, column: 1, endLine: 3 });
  });
});
