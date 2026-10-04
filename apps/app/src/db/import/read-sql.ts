/**
 * SQL reader (044 T015): statements from `splitSql` → `RawSchema`. Modelled statements are
 * rewritten by `prepareStatement` and parsed one at a time by the dialect's parser (passed in, so
 * this module stays pure and the parser is loaded only by the worker); everything else, and every
 * part of a statement that is not mapped, becomes a report entry (FR-017). The parser's AST is
 * read defensively: it is untyped data that differs per dialect.
 */
import type { DbAction } from '@sododeck/schema';

import { prepareStatement, type ColumnSource } from './prepare-statement';
import { excerpt } from './report-text';
import type {
  ChangedEntry,
  ParseError,
  RawColumn,
  RawDefault,
  RawEnum,
  RawIndex,
  RawRef,
  RawRefEnd,
  RawSchema,
  RawTable,
  SkipReason,
  SkippedEntry,
  SqlDialect,
  Statement,
  StatementKind,
} from './types';

/** The part of a `node-sql-parser` `Parser` used here. */
export interface SqlParser {
  astify(sql: string, options: { database: string }): unknown;
  exprToSQL(expr: unknown, options: { database: string }): string;
}

const DATABASE: Record<SqlDialect, string> = {
  postgres: 'PostgresQL',
  mysql: 'MySQL',
  sqlite: 'sqlite',
};

const SKIP_OF_KIND: Partial<Record<StatementKind, SkipReason>> = {
  view: 'view',
  function: 'function',
  procedure: 'procedure',
  trigger: 'trigger',
  sequence: 'sequence',
  extension: 'extension',
  schema: 'schema',
  policy: 'policy',
  partition: 'partition',
  grant: 'grant',
  data: 'data',
  session: 'session',
  drop: 'drop-or-rename',
  other: 'unknown',
};

const ACTIONS: Record<string, DbAction> = {
  cascade: 'cascade',
  restrict: 'restrict',
  'set null': 'set-null',
  'set default': 'set-default',
  'no action': 'no-action',
};

// --- defensive AST access ---------------------------------------------------------------------

type Rec = Record<string, unknown>;
const rec = (value: unknown): Rec | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : undefined;
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** A column name from a `column_ref` (a string in MySQL / SQLite, `{expr: {value}}` in Postgres). */
function refName(ref: unknown): string | undefined {
  const r = rec(ref);
  if (r === undefined) return str(ref);
  const column = r.column;
  if (typeof column === 'string') return column;
  const value = rec(rec(column)?.expr)?.value;
  return typeof value === 'string' ? value : undefined;
}

/** `{db, table}` → name parts. */
function tableName(value: unknown): { schema?: string; name: string } | undefined {
  const r = rec(Array.isArray(value) ? value[0] : value);
  const name = str(r?.table);
  if (name === undefined) return undefined;
  const schema = str(r?.db) ?? str(r?.schema);
  return schema === undefined || schema === '' ? { name } : { schema, name };
}

/** The literal text of a `single_quote_string` style node. */
function literalString(node: unknown): string | undefined {
  const r = rec(node);
  if (r === undefined) return undefined;
  const type = str(r.type);
  if (type !== undefined && /string$/.test(type) && typeof r.value === 'string') return r.value;
  return undefined;
}

// --- reader -----------------------------------------------------------------------------------

interface ReaderState {
  dialect: SqlDialect;
  parser: SqlParser;
  tables: RawTable[];
  refs: RawRef[];
  enums: RawEnum[];
  skipped: SkippedEntry[];
  changed: ChangedEntry[];
  error?: ParseError;
}

const key = (schema: string | undefined, name: string) =>
  `${(schema ?? '').toLowerCase()}\u0000${name.toLowerCase()}`;

function findTable(
  state: ReaderState,
  ref: { schema?: string; name: string },
): RawTable | undefined {
  // An unqualified reference also finds a table stored with a schema (and the reverse).
  const exact = state.tables.find((t) => key(t.schema, t.name) === key(ref.schema, ref.name));
  if (exact !== undefined) return exact;
  return state.tables.find(
    (t) =>
      t.name.toLowerCase() === ref.name.toLowerCase() &&
      (ref.schema === undefined || t.schema === undefined),
  );
}

function skip(state: ReaderState, st: Statement, reason: SkipReason, detail?: string): void {
  state.skipped.push({
    line: st.line,
    excerpt: excerpt(st.text),
    reason,
    ...(detail === undefined ? {} : { detail }),
  });
}

type Parsed = { ok: true; ast: Rec } | { ok: false; error: ParseError };

function parseOne(state: ReaderState, st: Statement, text: string): Parsed {
  try {
    const ast = state.parser.astify(text, { database: DATABASE[state.dialect] });
    const first = rec(Array.isArray(ast) ? ast[0] : ast);
    return first === undefined
      ? { ok: false, error: { line: st.line, message: 'could not be read' } }
      : { ok: true, ast: first };
  } catch (error) {
    const start = rec(rec(rec(error)?.location)?.start);
    const line = typeof start?.line === 'number' ? start.line : 1;
    const column = typeof start?.column === 'number' ? start.column : undefined;
    const message = error instanceof Error ? shortMessage(error.message) : 'could not be read';
    return {
      ok: false,
      error: { line: st.line + line - 1, ...(column === undefined ? {} : { column }), message },
    };
  }
}

/** The parser's "Expected …" list is long; keep what was found. */
function shortMessage(message: string): string {
  const found = /but (.+) found\.?$/.exec(message);
  return found?.[1] === undefined ? message.slice(0, 120) : `unexpected ${found[1]}`;
}

function defaultOf(state: ReaderState, node: unknown): { value?: RawDefault; increment?: boolean } {
  const r = rec(node);
  if (r === undefined) return {};
  const type = str(r.type);
  const literal = literalString(r);
  if (literal !== undefined) return { value: { kind: 'value', value: literal } };
  if (type === 'number' && typeof r.value === 'number')
    return { value: { kind: 'value', value: r.value } };
  if (type === 'bool' && typeof r.value === 'boolean')
    return { value: { kind: 'value', value: r.value } };
  if (type === 'null') return {};
  if (type === 'cast') {
    const inner = defaultOf(state, r.expr);
    if (inner.value?.kind === 'value') return inner;
  }
  if (type === 'function') {
    const name = arr(rec(r.name)?.name)
      .map((part) => str(rec(part)?.value) ?? '')
      .join('.');
    if (/^nextval$/i.test(name)) return { increment: true };
  }
  // MySQL hangs `ON UPDATE …` on the default; it is reported, not part of the expression.
  const { over: _over, ...plain } = r;
  return { value: { kind: 'expr', expr: exprText(state, plain) } };
}

function exprText(state: ReaderState, node: unknown): string {
  try {
    return state.parser.exprToSQL(node, { database: DATABASE[state.dialect] }).trim();
  } catch {
    return '';
  }
}

function actionsOf(definition: unknown): Pick<RawRef, 'onDelete' | 'onUpdate'> {
  const out: Pick<RawRef, 'onDelete' | 'onUpdate'> = {};
  for (const item of arr(rec(definition)?.on_action)) {
    const r = rec(item);
    const value = str(rec(r?.value)?.value)?.toLowerCase();
    const action = value === undefined ? undefined : ACTIONS[value];
    if (action === undefined) continue;
    if (str(r?.type)?.toLowerCase() === 'on delete') out.onDelete = action;
    if (str(r?.type)?.toLowerCase() === 'on update') out.onUpdate = action;
  }
  return out;
}

function refOf(
  st: Statement,
  from: RawRefEnd,
  reference: unknown,
  name: string | undefined,
): RawRef | undefined {
  const r = rec(reference);
  const target = tableName(r?.table);
  if (target === undefined) return undefined;
  const columns = arr(r?.definition).flatMap((c) => refName(c) ?? []);
  return {
    ...(name === undefined || name === '' ? {} : { name }),
    from,
    to: { ...target, columns },
    ...actionsOf(r),
    line: st.line,
    excerpt: excerpt(st.text),
  };
}

const ENUM_TYPE = /^enum\s*\((.*)\)$/s;

/** Values of a MySQL inline `enum('a','b')` type. */
function inlineEnumValues(type: string): string[] | undefined {
  const match = ENUM_TYPE.exec(type);
  if (match?.[1] === undefined) return undefined;
  return [...match[1].matchAll(/'((?:[^'\\]|''|\\.)*)'/g)].map((m) =>
    (m[1] ?? '').replace(/''/g, "'").replace(/\\(.)/g, '$1'),
  );
}

function onUpdateDropped(state: ReaderState, line: number, target: string): void {
  state.changed.push({
    line,
    target,
    kind: 'option-dropped',
    detail: `${target}: ON UPDATE CURRENT_TIMESTAMP is not stored`,
  });
}

function columnOf(
  state: ReaderState,
  st: Statement,
  table: RawTable,
  def: Rec,
  source: ColumnSource | undefined,
): RawColumn | undefined {
  const name = refName(def.column) ?? source?.name;
  if (name === undefined) return undefined;
  const typed = source?.type ?? str(rec(def.definition)?.dataType)?.toLowerCase() ?? '';
  const line = source?.line ?? st.line;
  const column: RawColumn = { name, type: typed, line };
  const enumValues = inlineEnumValues(typed);
  if (enumValues !== undefined) column.enumValues = enumValues;
  if (def.primary_key !== undefined && def.primary_key !== null) column.pk = true;
  if (str(rec(def.nullable)?.type) === 'not null') column.notNull = true;
  if (typeof def.unique === 'string' && /unique/i.test(def.unique)) column.unique = true;
  if (def.auto_increment !== undefined && def.auto_increment !== null) column.increment = true;
  if (def.generated_by_default !== undefined && def.generated_by_default !== null)
    column.increment = true;
  const dflt = rec(def.default_val);
  if (dflt !== undefined) {
    const value = dflt.value;
    const { value: parsed, increment } = defaultOf(state, value);
    if (parsed !== undefined) column.default = parsed;
    if (increment === true) column.increment = true;
    if (rec(rec(value)?.over)?.type === 'on update')
      onUpdateDropped(state, line, `${table.name}.${name}`);
  }
  const check = rec(def.check);
  if (check !== undefined) {
    const expr = arr(check.definition)[0];
    const text = expr === undefined ? '' : unwrap(exprText(state, expr));
    if (text !== '') column.check = text;
  }
  const comment =
    literalString(rec(rec(def.comment)?.value)) ?? literalString(rec(def.comment)?.value);
  if (comment !== undefined) column.note = comment;
  const dropped = [
    ...(source?.dropped ?? []),
    ...(def.collate !== undefined && def.collate !== null ? ['collation'] : []),
    ...(def.character_set !== undefined && def.character_set !== null ? ['character set'] : []),
    ...(/\bzerofill\b/.test(typed) ? ['zerofill'] : []),
  ];
  for (const option of dropped) {
    state.changed.push({
      line,
      target: `${table.name}.${name}`,
      kind: 'option-dropped',
      detail: `${table.name}.${name}: ${option} is not stored`,
    });
  }
  const reference = def.reference_definition;
  if (reference !== undefined && reference !== null) {
    const ref = refOf(st, { ...tableRef(table), columns: [name] }, reference, undefined);
    if (ref !== undefined) state.refs.push(ref);
    // MySQL `ON UPDATE CURRENT_TIMESTAMP` comes back as a reference without a table.
    else if (arr(rec(reference)?.on_action).length > 0)
      onUpdateDropped(state, line, `${table.name}.${name}`);
  }
  return column;
}

const tableRef = (t: RawTable) =>
  t.schema === undefined ? { name: t.name } : { schema: t.schema, name: t.name };

/** `(a > b)` → `a > b`: one pair of parentheses around the whole expression adds nothing. */
export function unwrap(expr: string): string {
  const text = expr.trim();
  if (!text.startsWith('(') || !text.endsWith(')')) return text;
  let depth = 0;
  for (let k = 0; k < text.length; k++) {
    if (text[k] === '(') depth++;
    else if (text[k] === ')') depth--;
    if (depth === 0 && k < text.length - 1) return text;
  }
  return unwrap(text.slice(1, -1));
}

function setUnique(
  table: RawTable,
  columns: readonly string[],
  name: string | undefined,
  line: number,
): void {
  const [only] = columns;
  const column =
    columns.length === 1 && only !== undefined
      ? table.columns.find((c) => c.name.toLowerCase() === only.toLowerCase())
      : undefined;
  // A single-column UNIQUE is the column's flag (FR-010); its constraint name is not kept.
  if (column !== undefined) {
    column.unique = true;
    return;
  }
  table.indexes.push({
    ...(name === undefined ? {} : { name }),
    parts: columns.map((c) => ({ column: c })),
    unique: true,
    line,
  });
}

/** A table constraint or index (`PRIMARY KEY`, `UNIQUE`, `FOREIGN KEY`, `CHECK`, MySQL `KEY`). */
function constraintOf(state: ReaderState, st: Statement, table: RawTable, def: Rec): void {
  const type = str(def.constraint_type)?.toLowerCase();
  const name = str(def.constraint) ?? str(def.index);
  const columns = arr(def.definition).flatMap((c) => refName(c) ?? []);
  if (def.resource === 'index') {
    const keyword = str(def.keyword)?.toLowerCase() ?? '';
    const method = str(rec(def.index_type)?.type)?.toLowerCase();
    const index: RawIndex = {
      ...(name === undefined ? {} : { name }),
      parts: columns.map((c) => ({ column: c })),
      ...(method === undefined ? {} : { method }),
      line: st.line,
    };
    if (/fulltext|spatial/.test(keyword)) {
      state.changed.push({
        line: st.line,
        target: name ?? table.name,
        kind: 'option-dropped',
        detail: `${keyword.split(' ')[0] ?? ''} index kept as a plain index`,
      });
    }
    table.indexes.push(index);
    return;
  }
  switch (type) {
    case 'primary key':
      table.primaryKey = columns;
      return;
    case 'unique':
    case 'unique key':
    case 'unique index':
      setUnique(table, columns, name ?? undefined, st.line);
      return;
    case 'foreign key': {
      const ref = refOf(st, { ...tableRef(table), columns }, def.reference_definition, name);
      if (ref !== undefined) state.refs.push(ref);
      return;
    }
    case 'check': {
      const expr = arr(def.definition)[0];
      const text = expr === undefined ? '' : unwrap(exprText(state, expr));
      if (text !== '') {
        table.checks.push({ ...(name === undefined ? {} : { name }), expr: text, line: st.line });
      }
      return;
    }
    default:
      skip(
        state,
        st,
        'unknown',
        `constraint ${name ?? type ?? ''} is not modelled`.replace(/\s+/g, ' '),
      );
  }
}

function tableOptions(state: ReaderState, st: Statement, table: RawTable, options: unknown): void {
  const dropped: string[] = [];
  for (const option of arr(options)) {
    const r = rec(option);
    const keyword = str(r?.keyword)?.toLowerCase() ?? '';
    if (keyword === 'comment') {
      const raw = r?.value;
      const value =
        literalString(raw) ??
        str(raw)
          ?.replace(/^'(.*)'$/s, '$1')
          .replace(/''/g, "'");
      if (value !== undefined) table.note = value;
      continue;
    }
    if (keyword !== '') dropped.push(keyword.toUpperCase());
  }
  if (dropped.length > 0) {
    state.changed.push({
      line: st.line,
      target: table.name,
      kind: 'option-dropped',
      detail: `table options not stored: ${dropped.join(', ')}`,
    });
  }
}

function readCreateTable(state: ReaderState, st: Statement): void {
  const prepared = prepareStatement(st.text, st.line, state.dialect);
  const parsed = parseOne(state, st, prepared.text);
  if (!parsed.ok) {
    // A table that cannot be read would be lost: the import is blocked (FR-003).
    state.error ??= parsed.error;
    skip(state, st, 'parse-error', parsed.error.message);
    return;
  }
  const { ast } = parsed;
  if (ast.query_expr !== null && ast.query_expr !== undefined) {
    skip(state, st, 'unknown', 'tables created from a query are not imported');
    return;
  }
  const name = tableName(ast.table);
  if (name === undefined) {
    skip(state, st, 'unknown');
    return;
  }
  const table: RawTable = { ...name, columns: [], indexes: [], checks: [], line: st.line };
  state.tables.push(table);
  let next = 0;
  const later: Rec[] = [];
  for (const item of arr(ast.create_definitions)) {
    const def = rec(item);
    if (def === undefined) continue;
    if (def.resource === 'column') {
      const column = columnOf(state, st, table, def, prepared.columns[next++]);
      if (column !== undefined) table.columns.push(column);
    } else later.push(def);
  }
  // Constraints after the columns, so a single-column UNIQUE finds its column.
  for (const def of later) constraintOf(state, st, table, def);
  tableOptions(state, st, table, ast.table_options);
}

function readCreateType(state: ReaderState, st: Statement): void {
  const parsed = parseOne(state, st, prepareStatement(st.text, st.line, state.dialect).text);
  if (!parsed.ok) {
    state.error ??= parsed.error;
    skip(state, st, 'parse-error', parsed.error.message);
    return;
  }
  const { ast } = parsed;
  if (ast.resource !== 'enum') {
    skip(state, st, 'unknown', 'only enum types are imported');
    return;
  }
  const named = rec(ast.name);
  const name = str(named?.name);
  if (name === undefined) {
    skip(state, st, 'unknown');
    return;
  }
  const schema = str(named?.schema);
  const values = arr(rec(ast.create_definitions)?.value).flatMap((v) => literalString(v) ?? []);
  state.enums.push({
    name,
    ...(schema === undefined || schema === '' ? {} : { schema }),
    values: values.map((v) => ({ name: v })),
    line: st.line,
  });
}

function readCreateIndex(state: ReaderState, st: Statement): void {
  const prepared = prepareStatement(st.text, st.line, state.dialect);
  const parsed = parseOne(state, st, prepared.text);
  if (!parsed.ok) {
    skip(state, st, 'parse-error', parsed.error.message);
    return;
  }
  const { ast } = parsed;
  const target = tableName(ast.table);
  const table = target === undefined ? undefined : findTable(state, target);
  if (table === undefined) {
    skip(state, st, 'unknown-table');
    return;
  }
  const indexName = str(ast.index) ?? str(rec(ast.index)?.name);
  const method = str(rec(ast.index_using)?.type)?.toLowerCase();
  const parts = arr(ast.index_columns).map((part) => {
    const r = rec(part);
    if (r?.type === 'column_ref') {
      const name = refName(r);
      if (name !== undefined) return { column: name };
    }
    return { expr: exprText(state, part) };
  });
  if (parts.length === 0) {
    skip(state, st, 'unknown');
    return;
  }
  table.indexes.push({
    ...(indexName === undefined ? {} : { name: indexName }),
    parts,
    ...(str(ast.index_type)?.toLowerCase() === 'unique' ? { unique: true } : {}),
    ...(method === undefined ? {} : { method }),
    line: st.line,
  });
  if (ast.where !== null && ast.where !== undefined) {
    state.changed.push({
      line: st.line,
      target: indexName ?? table.name,
      kind: 'option-dropped',
      detail: 'the index condition (WHERE) is not stored',
    });
  }
}

const ALTER_HEAD =
  /^ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?(ONLY\s+)?((?:"[^"]+"|`[^`]+`|[\w$]+)(?:\s*\.\s*(?:"[^"]+"|`[^`]+`|[\w$]+))?)\s*/i;

const unquote = (name: string) => name.replace(/^["`](.*)["`]$/s, '$1');

function splitName(text: string): { schema?: string; name: string } {
  const parts = text.split(/\s*\.\s*(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(unquote);
  const [a, b] = parts;
  return b === undefined ? { name: a ?? text } : { schema: a ?? '', name: b };
}

function readAlterTable(state: ReaderState, st: Statement): void {
  const head = ALTER_HEAD.exec(st.text);
  const target = head?.[3] === undefined ? undefined : splitName(head[3]);
  const table = target === undefined ? undefined : findTable(state, target);
  if (head === null || table === undefined) {
    skip(state, st, 'unknown-table');
    return;
  }
  const actions = st.text.slice(head[0].length);
  // Identity and serial defaults added after the table (pg_dump) are auto-increment.
  const identity =
    /^ALTER\s+(COLUMN\s+)?("[^"]+"|[\w$]+)\s+(ADD\s+GENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY|SET\s+DEFAULT\s+nextval\s*\()/i.exec(
      actions.trim(),
    );
  if (identity?.[2] !== undefined) {
    const name = unquote(identity[2]);
    const column = table.columns.find((c) => c.name === name);
    if (column !== undefined) {
      column.increment = true;
      return;
    }
  }
  if (/^\s*(DROP|RENAME)\b/i.test(actions)) {
    skip(state, st, 'drop-or-rename');
    return;
  }
  if (!/^\s*ADD\b/i.test(actions)) {
    skip(state, st, 'alter');
    return;
  }
  const prepared = prepareStatement(st.text, st.line, state.dialect);
  const parsed = parseOne(state, st, prepared.text);
  if (!parsed.ok) {
    skip(state, st, 'parse-error', parsed.error.message);
    return;
  }
  const { ast } = parsed;
  let next = 0;
  let unapplied = false;
  for (const item of arr(ast.expr)) {
    const def = rec(item);
    if (def === undefined) continue;
    if (def.action !== 'add') {
      unapplied = true;
      continue;
    }
    if (def.resource === 'column') {
      const column = columnOf(state, st, table, def, prepared.columns[next++]);
      if (column !== undefined) table.columns.push(column);
    } else {
      const inner = rec(def.create_definitions) ?? def;
      constraintOf(state, st, table, inner);
    }
  }
  if (unapplied) skip(state, st, 'alter');
}

function readCommentOn(state: ReaderState, st: Statement): void {
  const parsed = parseOne(state, st, st.text);
  if (!parsed.ok) {
    skip(state, st, 'parse-error', parsed.error.message);
    return;
  }
  const { ast } = parsed;
  const target = rec(ast.target);
  const value = literalString(rec(rec(ast.expr)?.expr)) ?? undefined;
  const named = rec(target?.name);
  if (target?.type === 'table') {
    const name = tableName(named);
    const table = name === undefined ? undefined : findTable(state, name);
    if (table === undefined) {
      skip(state, st, 'unknown-table');
      return;
    }
    if (value === undefined) delete table.note;
    else table.note = value;
    return;
  }
  if (target?.type === 'column') {
    const tableNamed = str(named?.table);
    const schema = str(named?.schema) ?? str(named?.db);
    const table =
      tableNamed === undefined
        ? undefined
        : findTable(
            state,
            schema === undefined ? { name: tableNamed } : { schema, name: tableNamed },
          );
    const columnName = refName(named);
    const column = table?.columns.find((c) => c.name === columnName);
    if (column === undefined) {
      skip(state, st, 'unknown-table');
      return;
    }
    if (value === undefined) delete column.note;
    else column.note = value;
    return;
  }
  skip(state, st, 'unknown');
}

export interface SqlReadResult {
  raw: RawSchema;
  /** The first statement that blocks the import (an unreadable table or type). */
  error?: ParseError;
}

/** Reads `statements` as `dialect` with `parser`. */
export function readSql(
  statements: readonly Statement[],
  dialect: SqlDialect,
  parser: SqlParser,
): SqlReadResult {
  const state: ReaderState = {
    dialect,
    parser,
    tables: [],
    refs: [],
    enums: [],
    skipped: [],
    changed: [],
  };
  for (const st of statements) {
    switch (st.kind) {
      case 'create-table':
        readCreateTable(state, st);
        break;
      case 'create-type':
        readCreateType(state, st);
        break;
      case 'create-index':
        readCreateIndex(state, st);
        break;
      case 'alter-table':
        readAlterTable(state, st);
        break;
      case 'comment-on':
        readCommentOn(state, st);
        break;
      default:
        skip(state, st, SKIP_OF_KIND[st.kind] ?? 'unknown');
    }
  }
  return {
    raw: {
      format: 'sql',
      tables: state.tables,
      refs: state.refs,
      enums: state.enums,
      groups: [],
      notes: [],
      skipped: state.skipped,
      changed: state.changed,
    },
    ...(state.error === undefined ? {} : { error: state.error }),
  };
}
