/**
 * DBML from the schema slice (045, research R14): tables with column settings, indexes, checks
 * and notes, enums, and standalone `Ref`s with optional markers (`?`) and referential actions.
 * n–n is written natively (`<>`), never as a junction table. Pure and deterministic.
 */
import type { DbAction, Id } from '@sododeck/schema';

import { dbmlIdent, dbmlString } from './identifiers';
import { note, type ExportNote } from './notes';
import { displayName, isSqlDialect } from './schema-slice';
import type {
  DefaultValue,
  SchemaSlice,
  SliceColumn,
  SliceEnum,
  SliceRelationship,
  SliceTable,
  SqlDialect,
  WriterOutput,
} from './types';

const DATABASE_TYPES: Record<SqlDialect, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
};

const ACTIONS: Record<DbAction, string> = {
  cascade: 'cascade',
  restrict: 'restrict',
  'set-null': 'set null',
  'set-default': 'set default',
  'no-action': 'no action',
};

const OPERATORS = { 'n-1': '>', '1-n': '<', '1-1': '-', 'n-n': '<>' } as const;

/** Types DBML reads bare: a name with an optional `(…)` size. */
const PLAIN_TYPE = /^[A-Za-z_][A-Za-z0-9_]*(\([^()]*\))?$/;

const DBML_METHODS = new Set(['btree', 'hash']);

function qualifiedName(schema: string | null, name: string): string {
  return schema === null ? dbmlIdent(name) : `${dbmlIdent(schema)}.${dbmlIdent(name)}`;
}

function defaultText(value: DefaultValue): string {
  if (value.kind === 'expr') return `\`${value.expr}\``;
  return typeof value.value === 'string' ? dbmlString(value.value) : String(value.value);
}

function comments(text: string, indent = ''): string[] {
  return text.split('\n').map((line) => `${indent}// ${line}`.trimEnd());
}

export function writeDbml(slice: SchemaSlice): WriterOutput {
  const notes: ExportNote[] = [];
  const tableById = new Map(slice.tables.map((t) => [t.id, t]));
  const enumRef = (e: SliceEnum) => qualifiedName(e.schema, e.name);
  const tableRef = (t: SliceTable) => qualifiedName(t.schema, t.name);
  const columnName = (t: SliceTable, id: Id) => t.columns.find((c) => c.id === id)?.name ?? id;

  const columnType = (c: SliceColumn): string => {
    if (c.enum !== undefined) return enumRef(c.enum);
    return PLAIN_TYPE.test(c.type.written)
      ? c.type.written
      : `"${c.type.written.replaceAll('"', '\\"')}"`;
  };

  const columnLine = (t: SliceTable, c: SliceColumn): string => {
    const settings = [
      ...(c.pk && t.primaryKey.length === 1 ? ['pk'] : []),
      ...(c.increment ? ['increment'] : []),
      ...(c.notNull ? ['not null'] : []),
      ...(c.unique ? ['unique'] : []),
      ...(c.default === undefined ? [] : [`default: ${defaultText(c.default)}`]),
      ...(c.note === undefined ? [] : [`note: ${dbmlString(c.note)}`]),
    ];
    return `  ${dbmlIdent(c.name)} ${columnType(c)}${settings.length === 0 ? '' : ` [${settings.join(', ')}]`}`;
  };

  const indexLines = (t: SliceTable): string[] => {
    const lines: string[] = [];
    if (t.primaryKey.length > 1) {
      lines.push(`    (${t.primaryKey.map((id) => dbmlIdent(columnName(t, id))).join(', ')}) [pk]`);
    }
    for (const index of t.indexes) {
      const parts = index.parts.map((p) =>
        p.kind === 'column' ? dbmlIdent(columnName(t, p.column)) : `\`${p.expr}\``,
      );
      const [only] = index.parts;
      const target =
        parts.length === 1 && only?.kind === 'column' ? (parts[0] ?? '') : `(${parts.join(', ')})`;
      const settings: string[] = [];
      if (index.unique) settings.push('unique');
      if (index.method !== undefined) {
        if (DBML_METHODS.has(index.method)) settings.push(`type: ${index.method}`);
        else {
          notes.push(
            note(
              'method-dropped',
              `Index method ${index.method} is not supported by DBML; ${index.name ?? `an index of ${displayName(t)}`} written without it`,
              { tableId: t.id },
            ),
          );
        }
      }
      if (index.name !== undefined) settings.push(`name: ${dbmlString(index.name)}`);
      if (index.note !== undefined) settings.push(`note: ${dbmlString(index.note)}`);
      lines.push(`    ${target}${settings.length === 0 ? '' : ` [${settings.join(', ')}]`}`);
    }
    return lines.length === 0 ? [] : ['', '  indexes {', ...lines, '  }'];
  };

  const checkLines = (t: SliceTable): string[] => {
    const lines = [
      ...t.checks.map(
        (c) => `    \`${c.expr}\`${c.name === undefined ? '' : ` [name: ${dbmlString(c.name)}]`}`,
      ),
      // DBML has no column-level check; the column's check joins the table's.
      ...t.columns.flatMap((c) => (c.check === undefined ? [] : [`    \`${c.check}\``])),
    ];
    return lines.length === 0 ? [] : ['', '  checks {', ...lines, '  }'];
  };

  const tableBlock = (t: SliceTable): string[] => [
    `Table ${tableRef(t)} {`,
    ...t.columns.map((c) => columnLine(t, c)),
    ...indexLines(t),
    ...checkLines(t),
    ...(t.note === undefined ? [] : ['', `  Note: ${dbmlString(t.note)}`]),
    '}',
  ];

  const endRef = (t: SliceTable, ids: readonly Id[]) => {
    const names = ids.map((id) => dbmlIdent(columnName(t, id)));
    return names.length === 1
      ? `${tableRef(t)}.${names[0] ?? ''}`
      : `${tableRef(t)}.(${names.join(', ')})`;
  };

  const refLine = (rel: SliceRelationship): string | null => {
    const from = tableById.get(rel.from);
    const to = tableById.get(rel.to);
    if (from === undefined || to === undefined || rel.unwritable !== null) return null;
    const op = OPERATORS[rel.cardinality ?? 'n-1'];
    const marked = `${rel.fromOptional ? '?' : ''}${op}${rel.toOptional ? '?' : ''}`;
    const settings = [
      ...(rel.onDelete === undefined ? [] : [`delete: ${ACTIONS[rel.onDelete]}`]),
      ...(rel.onUpdate === undefined ? [] : [`update: ${ACTIONS[rel.onUpdate]}`]),
    ];
    const name = rel.label === undefined ? '' : ` ${dbmlIdent(rel.label)}`;
    return `Ref${name}: ${endRef(from, rel.fromColumns)} ${marked} ${endRef(to, rel.toColumns)}${settings.length === 0 ? '' : ` [${settings.join(', ')}]`}`;
  };

  // Table blocks first, so the method notes they make reach the comments.
  const tables = slice.tables.map((t) => ({ t, block: tableBlock(t) }));
  const blocks: string[][] = [];
  if (isSqlDialect(slice.dialect)) {
    blocks.push([
      `Project ${dbmlIdent(slice.deckName)} {`,
      `  database_type: '${DATABASE_TYPES[slice.dialect]}'`,
      '}',
    ]);
  }
  const general = slice.notes.filter((n) => n.tableId === undefined);
  if (general.length > 0) blocks.push(general.flatMap((n) => comments(n.message)));
  for (const e of slice.enums) {
    blocks.push([
      ...(e.note === undefined ? [] : comments(e.note)),
      `Enum ${enumRef(e)} {`,
      ...e.values.map(
        (v) =>
          `  ${dbmlIdent(v.name)}${v.note === undefined ? '' : ` [note: ${dbmlString(v.note)}]`}`,
      ),
      '}',
    ]);
  }
  for (const { t, block } of tables) {
    const own = [...slice.notes, ...notes].filter((n) => n.tableId === t.id);
    blocks.push([...own.flatMap((n) => comments(n.message)), ...block]);
  }
  const refs = slice.relationships.flatMap((rel) => refLine(rel) ?? []);
  if (refs.length > 0) blocks.push(refs);
  return { text: `${blocks.map((b) => b.join('\n')).join('\n\n')}\n`, notes };
}
