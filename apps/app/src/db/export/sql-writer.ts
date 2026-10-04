/**
 * SQL DDL for Postgres, MySQL and SQLite from the schema slice (045, contracts/schema-writers.md,
 * research R4, R6–R13). Pure and deterministic; every skip or change is a note, also written as a
 * `-- ` comment above the table it concerns. Per-dialect differences are the small helpers below.
 */
import type { DbAction, Id } from '@sododeck/schema';

import { qualified, sqlIdent, sqlString } from './identifiers';
import { mergeNotes, note, type ExportNote } from './notes';
import { dialectName, displayName } from './schema-slice';
import type {
  DefaultValue,
  SchemaSlice,
  SliceColumn,
  SliceEnum,
  SliceForeignKey,
  SliceIndex,
  SliceTable,
  SqlDialect,
  SqlOptions,
  WriterOutput,
} from './types';

const ACTIONS: Record<DbAction, string> = {
  cascade: 'CASCADE',
  restrict: 'RESTRICT',
  'set-null': 'SET NULL',
  'set-default': 'SET DEFAULT',
  'no-action': 'NO ACTION',
};

const INTEGER = /^(tiny|small|medium|big)?int(eger)?[248]?$/i;
const BARE_DEFAULTS = /^(current_timestamp|current_date|current_time|null)$/i;
const MYSQL_METHODS = new Set(['btree', 'hash']);

function comments(text: string, indent = ''): string[] {
  return text.split('\n').map((line) => `${indent}-- ${line}`.trimEnd());
}

/** `(…)` wraps the whole text (not `(a) + (b)`). */
function isParenthesised(expr: string): boolean {
  const text = expr.trim();
  if (!text.startsWith('(') || !text.endsWith(')')) return false;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    if (depth === 0 && i < text.length - 1) return false;
  }
  return depth === 0;
}

export function writeSql(
  slice: SchemaSlice,
  dialect: SqlDialect,
  options: SqlOptions,
): WriterOutput {
  const notes: ExportNote[] = [];
  const all = [...slice.tables, ...slice.junctions];
  const tableById = new Map(all.map((t) => [t.id, t]));
  const ident = (name: string) => sqlIdent(name, dialect);
  const schemaFor = (schema: string | null) => (dialect === 'sqlite' ? null : schema);
  const tableName = (t: SliceTable) => qualified(schemaFor(t.schema), t.name, dialect);
  const enumName = (e: SliceEnum) => qualified(schemaFor(e.schema), e.name, dialect);
  const columnName = (tableId: Id, columnId: Id) =>
    tableById.get(tableId)?.columns.find((c) => c.id === columnId)?.name ?? columnId;
  const columnList = (tableId: Id, ids: readonly Id[]) =>
    ids.map((id) => ident(columnName(tableId, id))).join(', ');
  const str = (text: string) => sqlString(text, dialect);

  // Schemas (research R11).
  const schemas = [...new Set([...all.map((t) => t.schema), ...slice.enums.map((e) => e.schema)])]
    .filter((s): s is string => s !== null)
    .sort();
  if (dialect === 'sqlite') {
    for (const schema of schemas) {
      notes.push(
        note(
          'schema-dropped',
          `Schemas are not supported by SQLite: ${schema}.* written without schema`,
        ),
      );
    }
  }
  // Same name twice (SQLite after dropping schemas; any dialect within one schema).
  const groups = new Map<string, SliceTable[]>();
  for (const t of all) {
    const key = JSON.stringify([schemaFor(t.schema) ?? '', t.name.toLowerCase()]);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  for (const group of groups.values()) {
    const [first] = group;
    if (first === undefined || group.length < 2) continue;
    const dropped = dialect === 'sqlite' && new Set(group.map((t) => t.schema)).size > 1;
    notes.push(
      note(
        'name-clash',
        `${group.length === 2 ? 'Two' : String(group.length)} tables named ${first.name}${dropped ? ' after dropping schemas' : ''}`,
        { tableId: first.id },
      ),
    );
  }
  if (dialect === 'postgres' && !options.enumsAndIndexes && slice.enums.length > 0) {
    notes.push(
      note('enum-not-created', 'Enum types are not created (option off); columns still name them'),
    );
  }

  const defaultText = (value: DefaultValue): string => {
    if (value.kind === 'value') {
      const v = value.value;
      if (typeof v === 'string') return str(v);
      if (typeof v === 'number') return String(v);
      if (dialect === 'sqlite') return v ? '1' : '0';
      return v ? 'TRUE' : 'FALSE';
    }
    const expr = value.expr.trim();
    if (dialect === 'postgres' || isParenthesised(expr) || BARE_DEFAULTS.test(expr)) return expr;
    return `(${expr})`;
  };

  const references = (fk: SliceForeignKey): string => {
    const ref = tableById.get(fk.refTable);
    const target = ref === undefined ? ident(fk.refTable) : tableName(ref);
    return [
      `REFERENCES ${target} (${columnList(fk.refTable, fk.refColumns)})`,
      ...(fk.onDelete === undefined ? [] : [`ON DELETE ${ACTIONS[fk.onDelete]}`]),
      ...(fk.onUpdate === undefined ? [] : [`ON UPDATE ${ACTIONS[fk.onUpdate]}`]),
    ].join(' ');
  };

  /** Inline (column-level) FKs: Postgres single-column ones not deferred; SQLite every single one. */
  const inlineFk = (fk: SliceForeignKey) =>
    fk.columns.length === 1 && (dialect === 'sqlite' || (dialect === 'postgres' && !fk.deferred));
  /** Table-level FKs: composite ones (Postgres, SQLite) and every one on MySQL; not deferred ones. */
  const tableFk = (fk: SliceForeignKey) =>
    dialect === 'mysql'
      ? !fk.deferred
      : fk.columns.length > 1 && (dialect === 'sqlite' || !fk.deferred);

  const columnType = (t: SliceTable, c: SliceColumn, local: ExportNote[]): string => {
    const e = c.enum;
    if (e === undefined) return c.type.written;
    if (dialect === 'postgres') return enumName(e);
    if (e.values.length === 0) {
      local.push(
        note(
          'empty-enum',
          `Enum ${e.name} has no values; ${displayName(t)}.${c.name} written as text`,
          {
            tableId: t.id,
            columnId: c.id,
          },
        ),
      );
      return 'text';
    }
    return dialect === 'mysql' ? `enum(${e.values.map((v) => str(v.name)).join(', ')})` : 'text';
  };

  const columnLine = (t: SliceTable, c: SliceColumn, local: ExportNote[]): string => {
    let type = columnType(t, c, local);
    const singlePk = t.primaryKey.length === 1 && t.primaryKey[0] === c.id;
    const where = { tableId: t.id, columnId: c.id };
    const label = `${displayName(t)}.${c.name}`;
    const parts: string[] = [];
    let autoincrement = false;
    if (c.increment) {
      const integer = INTEGER.test(type);
      if (dialect === 'postgres') {
        if (integer) parts.push('GENERATED BY DEFAULT AS IDENTITY');
        else
          local.push(
            note(
              'increment-dropped',
              `${label}: auto-increment needs an integer type in Postgres; dropped`,
              where,
            ),
          );
      } else if (dialect === 'mysql') {
        if (c.pk || c.unique) parts.push('AUTO_INCREMENT');
        else
          local.push(
            note(
              'increment-dropped',
              `${label}: auto-increment needs a key in MySQL; dropped`,
              where,
            ),
          );
      } else if (singlePk && integer) {
        // SQLite only auto-increments an `INTEGER PRIMARY KEY` (same affinity as any int type).
        type = 'integer';
        autoincrement = true;
      } else {
        local.push(
          note(
            'increment-dropped',
            `${label}: auto-increment needs an integer primary key in SQLite; dropped`,
            where,
          ),
        );
      }
    }
    if (c.notNull) parts.push('NOT NULL');
    if (c.unique) parts.push('UNIQUE');
    if (c.default !== undefined) parts.push(`DEFAULT ${defaultText(c.default)}`);
    if (c.check !== undefined) parts.push(`CHECK (${c.check})`);
    if (dialect === 'sqlite' && c.enum !== undefined && c.enum.values.length > 0) {
      parts.push(
        `CHECK (${ident(c.name)} IN (${c.enum.values.map((v) => str(v.name)).join(', ')}))`,
      );
    }
    if (singlePk) parts.push(autoincrement ? 'PRIMARY KEY AUTOINCREMENT' : 'PRIMARY KEY');
    for (const fk of t.foreignKeys) {
      if (inlineFk(fk) && fk.columns[0] === c.id) parts.push(references(fk));
    }
    if (dialect === 'mysql' && c.note !== undefined) parts.push(`COMMENT ${str(c.note)}`);
    return [ident(c.name), type, ...parts].join(' ');
  };

  const usedIndexNames = new Set(
    all.flatMap((t) =>
      t.indexes.flatMap((i) => (i.name === undefined ? [] : [i.name.toLowerCase()])),
    ),
  );
  const indexName = (t: SliceTable, index: SliceIndex): string => {
    if (index.name !== undefined) return index.name;
    const [first] = index.parts;
    const part = first?.kind === 'column' ? columnName(t.id, first.column) : 'expr';
    const base = `${t.name}_${part}_${index.unique ? 'uniq' : 'idx'}`;
    let name = base;
    for (let n = 2; usedIndexNames.has(name.toLowerCase()); n++) name = `${base}_${String(n)}`;
    usedIndexNames.add(name.toLowerCase());
    return name;
  };

  const indexStatements = (t: SliceTable, local: ExportNote[]): string[] => {
    const lines: string[] = [];
    for (const index of t.indexes) {
      const name = indexName(t, index);
      const parts = index.parts
        .map((p) =>
          p.kind === 'column'
            ? ident(columnName(t.id, p.column))
            : dialect === 'sqlite'
              ? p.expr
              : `(${p.expr})`,
        )
        .join(', ');
      const method = index.method;
      let using = '';
      let trailing = '';
      if (method !== undefined) {
        if (dialect === 'postgres') using = ` USING ${method}`;
        else if (dialect === 'mysql' && MYSQL_METHODS.has(method))
          trailing = ` USING ${method.toUpperCase()}`;
        else if (!(dialect === 'sqlite' && method === 'btree')) {
          local.push(
            note(
              'method-dropped',
              `Index method ${method} is not supported by ${dialectName(dialect)}; ${name} written without it`,
              {
                tableId: t.id,
              },
            ),
          );
        }
      }
      if (index.note !== undefined && dialect !== 'postgres')
        lines.push(...comments(`${name}: ${index.note}`));
      const ifNot = options.ifNotExists && dialect !== 'mysql' ? 'IF NOT EXISTS ' : '';
      lines.push(
        `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${ifNot}${ident(name)} ON ${tableName(t)}${using} (${parts})${trailing};`,
      );
      if (index.note !== undefined && dialect === 'postgres') {
        lines.push(`COMMENT ON INDEX ${qualified(t.schema, name, dialect)} IS ${str(index.note)};`);
      }
    }
    return lines;
  };

  const createTable = (t: SliceTable, local: ExportNote[]): string[] => {
    const entries: { before: string[]; text: string }[] = t.columns.map((c) => ({
      before: dialect === 'sqlite' && c.note !== undefined ? comments(c.note, '  ') : [],
      text: columnLine(t, c, local),
    }));
    if (t.primaryKey.length > 1) {
      entries.push({ before: [], text: `PRIMARY KEY (${columnList(t.id, t.primaryKey)})` });
    }
    for (const fk of t.foreignKeys) {
      if (tableFk(fk)) {
        entries.push({
          before: [],
          text: `FOREIGN KEY (${columnList(t.id, fk.columns)}) ${references(fk)}`,
        });
      }
    }
    for (const check of t.checks) {
      entries.push({
        before: [],
        text: `${check.name === undefined ? '' : `CONSTRAINT ${ident(check.name)} `}CHECK (${check.expr})`,
      });
    }
    const ifNot = options.ifNotExists ? 'IF NOT EXISTS ' : '';
    const close = dialect === 'mysql' && t.note !== undefined ? `) COMMENT=${str(t.note)};` : ');';
    return [
      `CREATE TABLE ${ifNot}${tableName(t)} (`,
      ...entries.flatMap((entry, i) => [
        ...entry.before,
        `  ${entry.text}${i < entries.length - 1 ? ',' : ''}`,
      ]),
      close,
    ];
  };

  const postgresComments = (t: SliceTable): string[] => {
    if (dialect !== 'postgres') return [];
    return [
      ...(t.note === undefined ? [] : [`COMMENT ON TABLE ${tableName(t)} IS ${str(t.note)};`]),
      ...t.columns.flatMap((c) =>
        c.note === undefined
          ? []
          : [`COMMENT ON COLUMN ${tableName(t)}.${ident(c.name)} IS ${str(c.note)};`],
      ),
    ];
  };

  const enumNotes = (e: SliceEnum): string[] => [
    ...(e.note === undefined || dialect === 'postgres'
      ? []
      : comments(`enum ${e.name}: ${e.note}`)),
    ...e.values.flatMap((v) =>
      v.note === undefined ? [] : comments(`${e.name}.${v.name}: ${v.note}`),
    ),
  ];

  const blocks: string[][] = [];
  if (schemas.length > 0 && dialect !== 'sqlite') {
    blocks.push(
      schemas.map((s) =>
        dialect === 'postgres'
          ? `CREATE SCHEMA IF NOT EXISTS ${ident(s)};`
          : `CREATE DATABASE IF NOT EXISTS ${ident(s)};`,
      ),
    );
  }
  const tableNotes = new Map<Id, ExportNote[]>();
  for (const n of slice.notes) {
    if (n.tableId !== undefined)
      tableNotes.set(n.tableId, [...(tableNotes.get(n.tableId) ?? []), n]);
  }
  const enumsDone = new Set<Id>();
  for (const id of slice.sqlOrder) {
    const t = tableById.get(id);
    if (t === undefined) continue;
    const local: ExportNote[] = [];
    const usedEnums = t.columns.flatMap((c) =>
      c.enum === undefined || enumsDone.has(c.enum.id) ? [] : [c.enum],
    );
    const before: string[] = [];
    for (const e of usedEnums) {
      if (enumsDone.has(e.id)) continue;
      enumsDone.add(e.id);
      if (dialect === 'postgres') {
        if (!options.enumsAndIndexes) continue;
        blocks.push([
          ...enumNotes(e),
          `CREATE TYPE ${enumName(e)} AS ENUM (${e.values.map((v) => str(v.name)).join(', ')});`,
          ...(e.note === undefined ? [] : [`COMMENT ON TYPE ${enumName(e)} IS ${str(e.note)};`]),
        ]);
      } else {
        before.push(...enumNotes(e));
      }
    }
    const statement = createTable(t, local);
    const after = [
      ...postgresComments(t),
      ...(options.enumsAndIndexes ? indexStatements(t, local) : []),
    ];
    const own = [
      ...notes.filter((n) => n.tableId === t.id),
      ...(tableNotes.get(t.id) ?? []),
      ...local,
    ];
    notes.push(...local);
    const [a, b] = t.joins ?? [];
    blocks.push([
      ...own.flatMap((n) => comments(n.message)),
      ...(t.junction && a !== undefined && b !== undefined
        ? [`-- n-n ${displayName(tableById.get(a) ?? t)} ↔ ${displayName(tableById.get(b) ?? t)}`]
        : []),
      ...before,
      ...(dialect === 'sqlite' && t.note !== undefined ? comments(t.note) : []),
      ...statement,
      ...after,
    ]);
  }
  const deferred = slice.deferredFks.flatMap((fk) => {
    if (dialect === 'sqlite') return [];
    const t = tableById.get(fk.table);
    if (t === undefined) return [];
    return [
      `ALTER TABLE ${tableName(t)} ADD FOREIGN KEY (${columnList(t.id, fk.columns)}) ${references(fk)};`,
    ];
  });
  if (deferred.length > 0) blocks.push(deferred);

  const order = [...slice.tables.map((t) => t.id), ...slice.junctions.map((t) => t.id)];
  const total = mergeNotes([...slice.notes, ...notes], order);
  const general = total.filter((n) => n.tableId === undefined);
  const header = [
    `-- ${slice.deckName} · ${slice.scopeLabel} · ${dialectName(dialect)}`,
    `-- Generated by Sododeck. Notes: ${String(total.length)}`,
    ...general.flatMap((n) => comments(n.message)),
  ];
  return {
    text: `${[header, ...blocks].map((block) => block.join('\n')).join('\n\n')}\n`,
    notes: mergeNotes(notes, order),
  };
}
