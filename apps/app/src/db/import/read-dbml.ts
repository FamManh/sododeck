/**
 * DBML reader (044 T027): DBML text → `RawSchema` through the DBML compiler's raw database. The
 * compiler module is passed in (the worker loads it lazily), so this module stays pure. DBML is
 * one document: its first compile error blocks the whole import with that line (FR-003).
 */
import type * as Dbml from '@dbml/parse';
import type { Cardinality, DbAction } from '@sododeck/schema';

import { excerpt } from './report-text';
import type {
  ParseError,
  RawColumn,
  RawDefault,
  RawRef,
  RawRefEnd,
  RawSchema,
  RawTable,
  SkippedEntry,
  SqlDialect,
} from './types';

/** The part of `@dbml/parse` used here. */
export type DbmlModule = Pick<typeof Dbml, 'Compiler' | 'MemoryProjectLayout' | 'DEFAULT_ENTRY'>;

const ACTIONS: Record<string, DbAction> = {
  cascade: 'cascade',
  restrict: 'restrict',
  'set null': 'set-null',
  'set default': 'set-default',
  'no action': 'no-action',
};

const DATABASE_TYPES: Record<string, SqlDialect> = {
  postgresql: 'postgres',
  postgres: 'postgres',
  mysql: 'mysql',
  sqlite: 'sqlite',
};

export interface DbmlReadResult {
  raw: RawSchema;
  error?: ParseError;
}

const lineOf = (token: { start: { line: number } } | undefined) => token?.start.line ?? 1;

function defaultOf(value: Dbml.Column['dbdefault']): RawDefault | undefined {
  if (value === undefined) return undefined;
  switch (value.type) {
    case 'number':
      return { kind: 'value', value: Number(value.value) };
    case 'boolean':
      return { kind: 'value', value: String(value.value) === 'true' };
    case 'string':
      return { kind: 'value', value: String(value.value) };
    case 'expression':
      return { kind: 'expr', expr: String(value.value) };
  }
}

/** `0..1`, `1` → one; `*`, `0..*` → many; `0..` → optional. */
function sideOf(relation: string): { many: boolean; optional: boolean } {
  return { many: relation.includes('*'), optional: relation.startsWith('0..') };
}

const INLINE_CARDINALITY: Record<string, Cardinality> = {
  '>': 'n-1',
  '<': '1-n',
  '-': '1-1',
  '<>': 'n-n',
};

const endOf = (schema: string | null, table: string, columns: readonly string[]): RawRefEnd => ({
  ...(schema === null ? {} : { schema }),
  name: table,
  columns: [...columns],
});

/** Comment lines directly above line `line` (1-based): 045 writes an enum's note this way. */
function commentAbove(lines: readonly string[], line: number): string | undefined {
  const found: string[] = [];
  for (let k = line - 2; k >= 0; k--) {
    const match = /^\s*\/\/ ?(.*)$/.exec(lines[k] ?? '');
    if (match === null) break;
    found.unshift(match[1] ?? '');
  }
  return found.length === 0 ? undefined : found.join('\n');
}

function columnOf(field: Dbml.Column): RawColumn {
  const typeName = field.type.type_name;
  const column: RawColumn = {
    name: field.name,
    type: typeName,
    ...(field.type.schemaName === null ? {} : { typeSchema: field.type.schemaName }),
    line: lineOf(field.token),
  };
  if (field.pk === true) column.pk = true;
  if (field.not_null === true) column.notNull = true;
  if (field.unique === true) column.unique = true;
  if (field.increment === true) column.increment = true;
  const value = defaultOf(field.dbdefault);
  if (value !== undefined) column.default = value;
  if (field.note !== undefined) column.note = field.note.value;
  const [check] = field.checks;
  if (check !== undefined) column.check = check.expression;
  return column;
}

function tableOf(table: Dbml.Table): RawTable {
  const raw: RawTable = {
    name: table.name,
    ...(table.schemaName === null ? {} : { schema: table.schemaName }),
    columns: table.fields.map(columnOf),
    indexes: table.indexes.map((index) => ({
      ...(index.name === undefined ? {} : { name: index.name }),
      parts: index.columns.map((part) =>
        part.type === 'expression' ? { expr: part.value } : { column: part.value },
      ),
      ...(index.unique === true ? { unique: true } : {}),
      ...(index.pk === true ? { pk: true } : {}),
      ...(index.type === undefined ? {} : { method: index.type.toLowerCase() }),
      ...(index.note === undefined ? {} : { note: index.note.value }),
      line: lineOf(index.token),
    })),
    checks: [
      ...table.checks.map((check) => ({
        ...(check.name === undefined ? {} : { name: check.name }),
        expr: check.expression,
        line: lineOf(check.token),
      })),
      // A column's second and later checks become table checks.
      ...table.fields.flatMap((field) =>
        field.checks
          .slice(1)
          .map((check) => ({ expr: check.expression, line: lineOf(check.token) })),
      ),
    ],
    line: lineOf(table.token),
  };
  if (table.note !== undefined) raw.note = table.note.value;
  if (table.headerColor !== undefined && table.headerColor !== 'none')
    raw.headerColor = table.headerColor;
  return raw;
}

function emptySchema(): RawSchema {
  return {
    format: 'dbml',
    tables: [],
    refs: [],
    enums: [],
    groups: [],
    notes: [],
    skipped: [],
    changed: [],
  };
}

/** Reads DBML `text` with the compiler module `dbml`. */
export function readDbml(text: string, dbml: DbmlModule): DbmlReadResult {
  const entry = dbml.DEFAULT_ENTRY;
  const compiler = new dbml.Compiler(new dbml.MemoryProjectLayout({ [entry.absolute]: text }));
  const [first] = compiler.parse.errors(entry);
  if (first !== undefined) {
    const start = (first.nodeOrToken as { startPos?: { line: number; column: number } } | undefined)
      ?.startPos;
    return {
      raw: emptySchema(),
      error: {
        line: (start?.line ?? 0) + 1,
        ...(start === undefined ? {} : { column: start.column + 1 }),
        message: first.diagnostic,
      },
    };
  }
  const db = compiler.parse.rawDb(entry);
  if (db === undefined)
    return { raw: emptySchema(), error: { line: 1, message: 'could not be read' } };
  const lines = text.split('\n');
  const raw = emptySchema();
  raw.tables = db.tables.map(tableOf);

  // Inline refs (`[ref: > t.c]`) are read from their column, in written order; the compiler also
  // lists them among the refs (reversed), where they are skipped by position.
  const inlineAt = new Set<number>();
  for (const table of db.tables) {
    for (const field of table.fields) {
      for (const ref of field.inline_refs) {
        inlineAt.add(ref.token.start.offset);
        raw.refs.push({
          from: endOf(table.schemaName, table.name, [field.name]),
          to: endOf(ref.schemaName, ref.tableName, ref.fieldNames),
          cardinality: INLINE_CARDINALITY[ref.relation] ?? 'n-1',
          line: lineOf(ref.token),
          excerpt: excerpt(lines[lineOf(ref.token) - 1] ?? ''),
        });
      }
    }
  }
  for (const ref of db.refs) {
    if (inlineAt.has(ref.token.start.offset)) continue;
    const [a, b] = ref.endpoints;
    const left = sideOf(a.relation);
    const right = sideOf(b.relation);
    const onDelete = ref.onDelete === undefined ? undefined : ACTIONS[ref.onDelete.toLowerCase()];
    const onUpdate = ref.onUpdate === undefined ? undefined : ACTIONS[ref.onUpdate.toLowerCase()];
    const rawRef: RawRef = {
      ...(ref.name === null || ref.name === '' ? {} : { name: ref.name }),
      from: endOf(a.schemaName, a.tableName, a.fieldNames),
      to: endOf(b.schemaName, b.tableName, b.fieldNames),
      cardinality: `${left.many ? 'n' : '1'}-${right.many ? 'n' : '1'}` as Cardinality,
      ...(left.optional ? { fromOptional: true } : {}),
      ...(right.optional ? { toOptional: true } : {}),
      ...(onDelete === undefined ? {} : { onDelete }),
      ...(onUpdate === undefined ? {} : { onUpdate }),
      line: lineOf(ref.token),
      excerpt: excerpt(lines[lineOf(ref.token) - 1] ?? ''),
    };
    raw.refs.push(rawRef);
    if (ref.color !== undefined) {
      raw.changed.push({
        line: rawRef.line,
        target: `${a.tableName} → ${b.tableName}`,
        kind: 'option-dropped',
        detail: 'relationship colour is not stored',
      });
    }
  }

  raw.enums = db.enums.map((e) => {
    const note = commentAbove(lines, lineOf(e.token));
    return {
      name: e.name,
      ...(e.schemaName === null ? {} : { schema: e.schemaName }),
      values: e.values.map((v) => ({
        name: v.name,
        ...(v.note === undefined ? {} : { note: v.note.value }),
      })),
      ...(note === undefined ? {} : { note }),
      line: lineOf(e.token),
    };
  });
  raw.groups = db.tableGroups.map((group) => ({
    name: group.name ?? 'Group',
    tables: group.tables.map((t) =>
      t.schemaName === null ? { name: t.name } : { schema: t.schemaName, name: t.name },
    ),
    ...(group.color === undefined || group.color === 'none' ? {} : { color: group.color }),
    ...(group.note === undefined ? {} : { note: group.note.value }),
    line: lineOf(group.token),
  }));
  raw.notes = db.notes.map((n) => ({ text: n.content, line: lineOf(n.token) }));

  const project = db.project;
  if (project !== undefined && 'token' in project) {
    if (project.note !== undefined) raw.projectNote = project.note.value;
    const type = (project as Record<string, unknown>).database_type;
    const dialect = typeof type === 'string' ? DATABASE_TYPES[type.toLowerCase()] : undefined;
    if (dialect !== undefined) raw.dialect = dialect;
  }

  const skipped: SkippedEntry[] = [
    ...db.records.map((r) => ({
      line: lineOf(r.token),
      excerpt: excerpt(lines[lineOf(r.token) - 1] ?? ''),
      reason: 'data' as const,
    })),
    ...db.deps.map((d) => ({
      line: lineOf(d.token),
      excerpt: excerpt(lines[lineOf(d.token) - 1] ?? ''),
      reason: 'unknown' as const,
      detail: 'dependencies are not modelled',
    })),
    ...db.diagramViews.map((v) => ({
      line: lineOf(v.token),
      excerpt: excerpt(lines[lineOf(v.token) - 1] ?? ''),
      reason: 'unknown' as const,
      detail: 'diagram views are not imported',
    })),
  ];
  raw.skipped = skipped.sort((x, y) => x.line - y.line);
  return { raw };
}
