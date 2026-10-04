/**
 * DBML reader (044 T027): DBML text → `RawSchema` through the DBML compiler's raw database. The
 * compiler module is passed in (the worker loads it lazily), so this module stays pure. DBML is
 * one document: its first compile error blocks the whole import with that line (FR-003).
 */
import type * as Dbml from '@dbml/parse';
import type { Cardinality, DbAction } from '@sododeck/schema';

import { suggestDbmlSetting } from '../sync/suggest-setting';
import type { TextProblem } from '../sync/types';
import { excerpt } from './report-text';
import type {
  ParseError,
  RawNonInput,
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
  /** The first problem, for the import dialog (044). */
  error?: ParseError;
  /** Every compiler diagnostic with a range (046); empty when the text is clean. */
  problems: TextProblem[];
}

/** The import dialog's limit (044); text over it is not parsed. Kept here so `db` needs no `editor`. */
const MAX_TEXT_BYTES = 5 * 1024 * 1024;

type Pos = { line: number; column: number };
type Range = { start: Pos; end: Pos };

/** The compiler's 0-based `startPos` / `endPos` of a diagnostic's node or token, as a 1-based range. */
function rangeOf(nodeOrToken: unknown): {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
} {
  const node = nodeOrToken as { startPos?: Pos; endPos?: Pos } | undefined;
  const start = node?.startPos ?? { line: 0, column: 0 };
  const end = node?.endPos ?? start;
  return {
    line: start.line + 1,
    column: start.column + 1,
    endLine: end.line + 1,
    endColumn: Math.max(end.column + 1, start.line === end.line ? start.column + 2 : 1),
  };
}

const UNKNOWN_SETTING = /^Custom setting '([^']*)'/;

function problemOf(diagnostic: string, nodeOrToken: unknown): TextProblem {
  const unknown = UNKNOWN_SETTING.exec(diagnostic);
  const suggestion = unknown === null ? undefined : suggestDbmlSetting(unknown[1] ?? '');
  return {
    ...rangeOf(nodeOrToken),
    severity: 'error',
    message:
      unknown === null
        ? diagnostic
        : `Unknown setting '${unknown[1] ?? ''}'${suggestion === undefined ? '' : `, did you mean ${suggestion}?`}`,
    ...(suggestion === undefined ? {} : { suggestion }),
    code: unknown === null ? 'syntax' : 'unknown-setting',
  };
}

const rangeInput = (kind: RawNonInput['kind'], token: Range | undefined): RawNonInput => ({
  kind,
  line: lineOf(token),
  ...(token === undefined
    ? {}
    : { column: token.start.column, endLine: token.end.line, endColumn: token.end.column }),
});

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
    inputs: [],
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
  if (new Blob([text]).size > MAX_TEXT_BYTES) {
    const message = 'The text is over 5 MB, which is too large to read.';
    return {
      raw: emptySchema(),
      error: { line: 1, column: 1, message },
      problems: [
        {
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 2,
          severity: 'error',
          message,
          code: 'syntax',
        },
      ],
    };
  }
  const compiler = new dbml.Compiler(new dbml.MemoryProjectLayout({ [entry.absolute]: text }));
  const errors = compiler.parse.errors(entry);
  if (errors.length > 0) {
    const problems = errors.map((e) => problemOf(e.diagnostic, e.nodeOrToken));
    const [first] = problems;
    return {
      raw: emptySchema(),
      ...(first === undefined
        ? {}
        : {
            error: { line: first.line, column: first.column, message: errors[0]?.diagnostic ?? '' },
          }),
      problems,
    };
  }
  const db = compiler.parse.rawDb(entry);
  if (db === undefined) {
    return {
      raw: emptySchema(),
      error: { line: 1, message: 'could not be read' },
      problems: [
        {
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 2,
          severity: 'error',
          message: 'could not be read',
          code: 'syntax',
        },
      ],
    };
  }
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

  // Blocks the code panel does not read as input (046 R15): the planner warns on each.
  const inputs: RawNonInput[] = [];
  for (const group of db.tableGroups) inputs.push(rangeInput('table-group', group.token));
  for (const note of db.notes) inputs.push(rangeInput('note', note.token));
  for (const table of db.tables) {
    if (table.headerColor !== undefined && table.headerColor !== 'none')
      inputs.push({ kind: 'header-color', line: lineOf(table.token) });
  }
  for (const ref of db.refs) {
    if (ref.color !== undefined) inputs.push(rangeInput('ref-color', ref.token));
  }
  for (const record of db.records) inputs.push(rangeInput('records', record.token));
  if (db.project !== undefined && 'token' in db.project)
    inputs.push(rangeInput('project', db.project.token));
  raw.inputs = inputs.sort((a, b) => a.line - b.line);

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
  return { raw, problems: [] };
}
