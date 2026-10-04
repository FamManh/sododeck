/**
 * Deck + request → the schema slice every writer reads (045, data-model §1, research R4–R6).
 * Scope, reference resolution by id, foreign-key placement, junction tables, table order and the
 * notes made while resolving live here only; writers never re-resolve ids. Never throws on a
 * schema-valid deck: every skip or change is an `ExportNote`. Deterministic.
 */
import { deckDialect, isDbTable } from '@sododeck/model';
import type { DbColumn, Dialect, Edge, Id, Node, SododeckFile } from '@sododeck/schema';

import { translateType } from './common-types';
import { mergeNotes, note, type ExportNote } from './notes';
import { scopeLabel, tablesInScope } from './scope';
import type {
  SchemaExportRequest,
  SchemaSlice,
  SliceColumn,
  SliceEnum,
  SliceForeignKey,
  SliceIndex,
  SliceIndexPart,
  SliceRelationship,
  SliceTable,
  SliceType,
  SqlDialect,
} from './types';

const DIALECT_NAMES: Record<SqlDialect, string> = {
  postgres: 'Postgres',
  mysql: 'MySQL',
  sqlite: 'SQLite',
};

export function dialectName(dialect: SqlDialect): string {
  return DIALECT_NAMES[dialect];
}

export function isSqlDialect(dialect: Dialect | null): dialect is SqlDialect {
  return dialect === 'postgres' || dialect === 'mysql' || dialect === 'sqlite';
}

/** The SQL dialect a request writes: the picked one, else the deck's; `null` on a Generic deck. */
export function sqlDialectOf(deck: SododeckFile, request: SchemaExportRequest): SqlDialect | null {
  if (request.dialect !== null) return request.dialect;
  const dialect = deckDialect(deck);
  return isSqlDialect(dialect) ? dialect : null;
}

/** Tie order of tables (FR-017): schema, then name, then id; plain code-unit comparison. */
function compareTables(a: SliceTable, b: SliceTable): number {
  return cmp(a.schema ?? '', b.schema ?? '') || cmp(a.name, b.name) || cmp(a.id, b.id);
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `schema.name` or `name`. */
export function displayName(table: Pick<SliceTable, 'schema' | 'name'>): string {
  return table.schema === null ? table.name : `${table.schema}.${table.name}`;
}

function schemaOf(node: Node): string | null {
  const schema = node.schema?.trim();
  return schema === undefined || schema === '' || schema === 'public' ? null : schema;
}

function withSize(type: string, size: string | undefined): string {
  return size === undefined || size === '' ? type : `${type}(${size})`;
}

function columnsText(table: SliceTable, ids: readonly Id[]): string {
  const names = ids.map((id) => table.columns.find((c) => c.id === id)?.name ?? id);
  return names.length === 1 ? (names[0] ?? '') : `(${names.join(', ')})`;
}

function endText(table: SliceTable, ids: readonly Id[]): string {
  return ids.length === 0 ? displayName(table) : `${displayName(table)}.${columnsText(table, ids)}`;
}

export function buildSchemaSlice(deck: SododeckFile, request: SchemaExportRequest): SchemaSlice {
  const isSql = request.format === 'sql';
  const refFormats = isSql || request.format === 'dbml';
  const deckDia = deckDialect(deck);
  const sqlDialect = isSql ? sqlDialectOf(deck, request) : null;
  const dialect: Dialect = sqlDialect ?? deckDia;
  /** Generic deck, SQL: the dialect its common types are translated to. */
  const translateTo = isSql && deckDia === 'generic' ? sqlDialect : null;
  const notes: ExportNote[] = [];

  const enumById = new Map((deck.enums ?? []).map((e) => [e.id, e]));
  const sliceEnums = new Map<Id, SliceEnum>();
  const sliceEnumOf = (id: Id): SliceEnum | undefined => {
    const cached = sliceEnums.get(id);
    if (cached !== undefined) return cached;
    const stored = enumById.get(id);
    if (stored === undefined) return undefined;
    const schema = stored.schema?.trim();
    const entry: SliceEnum = {
      id: stored.id,
      name: stored.name,
      schema: schema === undefined || schema === '' || schema === 'public' ? null : schema,
      ...(stored.note === undefined ? {} : { note: stored.note }),
      values: stored.values.map((v) => ({
        name: v.name,
        ...(v.note === undefined ? {} : { note: v.note }),
      })),
    };
    sliceEnums.set(id, entry);
    return entry;
  };

  // Every table of the deck gets a fallback name by deck position, so names do not move with scope.
  const allTables = deck.nodes.filter(isDbTable);
  const nameOf = new Map(
    allTables.map((node, i) => [node.id, node.title.trim() || `table_${String(i + 1)}`]),
  );
  const inScope = new Set(tablesInScope(deck, request.scope));
  const nodeById = new Map(allTables.map((n) => [n.id, n]));

  const buildType = (
    column: DbColumn,
    tableName: string,
    tableId: Id,
  ): { type: SliceType; enum?: SliceEnum } => {
    const where = { tableId, columnId: column.id };
    const label = `${tableName}.${column.name}`;
    const stored = column.type;
    if (column.enumRef !== undefined) {
      const found = sliceEnumOf(column.enumRef);
      if (found !== undefined) {
        return { type: { stored, written: found.name }, enum: found };
      }
      notes.push(
        note(
          'stale-reference',
          `${label} uses an enum that no longer exists; written as ${stored.trim() || 'text'}`,
          where,
        ),
      );
    }
    const size = column.size?.trim() === '' ? undefined : column.size;
    const sized = size === undefined ? {} : { size };
    if (stored.trim() === '') {
      notes.push(note('empty-type', `${label} has no type; written as text`, where));
      return { type: { stored, ...sized, written: 'text' } };
    }
    if (translateTo !== null) {
      const t = translateType(stored, size, translateTo);
      if (!t.mapped) {
        notes.push(
          note(
            'unmapped-type',
            `\`${stored.trim()}\` kept as written: not in the common type list for ${dialectName(translateTo)}`,
            where,
          ),
        );
      }
      if (t.sizeDefaulted) {
        notes.push(
          note('default-size', `${label}: varchar without length written as varchar(255)`, where),
        );
      }
      return { type: { stored, ...sized, written: t.written } };
    }
    const written = withSize(stored.trim(), size);
    if (sqlDialect === 'mysql' && /^(varchar|character varying)$/i.test(written)) {
      notes.push(
        note('default-size', `${label}: varchar without length written as varchar(255)`, where),
      );
      return { type: { stored, ...sized, written: 'varchar(255)' } };
    }
    return { type: { stored, ...sized, written } };
  };

  const buildTable = (node: Node): SliceTable => {
    const name = nameOf.get(node.id) ?? node.id;
    if (node.title.trim() === '') {
      notes.push(
        note('unnamed-table', `A table has no name; written as ${name}`, { tableId: node.id }),
      );
    }
    const schema = schemaOf(node);
    const label = schema === null ? name : `${schema}.${name}`;
    const columns: SliceColumn[] = (node.columns ?? []).map((column) => {
      const { type, enum: columnEnum } = buildType(column, label, node.id);
      return {
        id: column.id,
        name: column.name,
        type,
        pk: column.pk === true,
        notNull: column.notNull === true,
        unique: column.unique === true,
        increment: column.increment === true,
        ...(column.default !== undefined
          ? { default: { kind: 'value' as const, value: column.default } }
          : column.defaultExpr !== undefined
            ? { default: { kind: 'expr' as const, expr: column.defaultExpr } }
            : {}),
        ...(column.check === undefined || column.check.trim() === ''
          ? {}
          : { check: column.check }),
        ...(column.note === undefined || column.note === '' ? {} : { note: column.note }),
        ...(columnEnum === undefined ? {} : { enum: columnEnum }),
      };
    });
    const columnIds = new Set(columns.map((c) => c.id));
    const indexes: SliceIndex[] = [];
    for (const index of node.indexes ?? []) {
      const indexName = index.name ?? index.id;
      const parts: SliceIndexPart[] = [];
      for (const part of index.columns) {
        if (typeof part !== 'string') parts.push({ kind: 'expr', expr: part.expr });
        else if (columnIds.has(part)) parts.push({ kind: 'column', column: part });
        else {
          notes.push(
            note(
              'stale-reference',
              `Index ${indexName} on ${label} names a column that no longer exists; part skipped`,
              { tableId: node.id },
            ),
          );
        }
      }
      if (parts.length === 0) {
        notes.push(
          note('stale-reference', `Index ${indexName} on ${label} has no part left; not written`, {
            tableId: node.id,
          }),
        );
        continue;
      }
      indexes.push({
        id: index.id,
        ...(index.name === undefined || index.name.trim() === '' ? {} : { name: index.name }),
        parts,
        unique: index.unique === true,
        ...(index.method === undefined || index.method.trim() === ''
          ? {}
          : { method: index.method.trim().toLowerCase() }),
        ...(index.note === undefined || index.note === '' ? {} : { note: index.note }),
      });
    }
    return {
      id: node.id,
      name,
      schema,
      ...(node.description === undefined || node.description.trim() === ''
        ? {}
        : { note: node.description }),
      columns,
      primaryKey: columns.filter((c) => c.pk).map((c) => c.id),
      indexes,
      checks: (node.checks ?? [])
        .filter((c) => c.expr.trim() !== '')
        .map((c) => ({
          ...(c.name === undefined || c.name === '' ? {} : { name: c.name }),
          expr: c.expr,
        })),
      foreignKeys: [],
      junction: false,
    };
  };

  const tables = deck.nodes
    .filter((n) => isDbTable(n) && inScope.has(n.id))
    .map(buildTable)
    .sort(compareTables);
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const position = new Map(tables.map((t, i) => [t.id, i]));
  /** Out-of-scope tables are described by their stored name only. */
  const outsideName = (id: Id): string => {
    const node = nodeById.get(id);
    if (node === undefined) return id;
    const schema = schemaOf(node);
    const name = nameOf.get(id) ?? id;
    return schema === null ? name : `${schema}.${name}`;
  };

  // Relationships: edges between two tables (research R5).
  const relationships: SliceRelationship[] = [];
  const outside: { tableId: Id; reference: string }[] = [];
  for (const edge of deck.edges) {
    const fromNode = nodeById.get(edge.from);
    const toNode = nodeById.get(edge.to);
    if (fromNode === undefined || toNode === undefined) continue;
    const fromIn = inScope.has(edge.from);
    const toIn = inScope.has(edge.to);
    if (!fromIn && !toIn) continue;
    if (!fromIn || !toIn) {
      addOutside(edge, fromIn ? edge.from : edge.to);
      continue;
    }
    const from = tableById.get(edge.from);
    const to = tableById.get(edge.to);
    if (from === undefined || to === undefined) continue;
    relationships.push(resolveRelationship(edge, from, to));
  }
  // By table, then in deck order (stable sort): ids are random, so they cannot order an import
  // the way its file did (044 round-trip).
  relationships.sort((a, b) => (position.get(a.from) ?? 0) - (position.get(b.from) ?? 0));

  function addOutside(edge: Edge, inside: Id): void {
    const n2n = edge.cardinality === 'n-n';
    const fromColumns = edge.fromColumns ?? [];
    const toColumns = edge.toColumns ?? [];
    if (!n2n && fromColumns.length === 0 && toColumns.length === 0) return;
    const nameColumns = (tableId: Id, ids: readonly Id[]) => {
      const node = nodeById.get(tableId);
      const names = ids.map((id) => node?.columns?.find((c) => c.id === id)?.name ?? id);
      if (names.length === 0) return outsideName(tableId);
      return `${outsideName(tableId)}.${names.length === 1 ? (names[0] ?? '') : `(${names.join(', ')})`}`;
    };
    const other = inside === edge.from ? edge.to : edge.from;
    const reference = n2n
      ? `${outsideName(edge.from)} ↔ ${outsideName(edge.to)} (n–n)`
      : `${nameColumns(edge.from, fromColumns)} → ${nameColumns(edge.to, toColumns)}`;
    outside.push({ tableId: inside, reference });
    notes.push(
      note(
        'fk-out-of-scope',
        `${reference} not written: ${outsideName(other)} not in this export`,
        {
          tableId: inside,
        },
      ),
    );
  }

  function resolveRelationship(edge: Edge, from: SliceTable, to: SliceTable): SliceRelationship {
    const n2n = edge.cardinality === 'n-n';
    const resolve = (table: SliceTable, ids: readonly Id[] | undefined) => {
      const present = new Set(table.columns.map((c) => c.id));
      const list = (ids ?? []).filter((id) => present.has(id));
      const columns = n2n && (ids ?? []).length === 0 ? [...table.primaryKey] : list;
      return { columns, stale: list.length !== (ids ?? []).length };
    };
    const fromEnd = resolve(from, edge.fromColumns);
    const toEnd = resolve(to, edge.toColumns);
    const fromColumns = fromEnd.columns;
    const toColumns = toEnd.columns;
    const stale = fromEnd.stale || toEnd.stale;
    const route = `${displayName(from)} ${n2n ? '↔' : '→'} ${displayName(to)}`;
    let unwritable: SliceRelationship['unwritable'] = null;
    const where = { tableId: from.id };
    if (stale) {
      unwritable = 'stale';
      notes.push(
        note(
          'stale-reference',
          `Relationship ${route} names a column that no longer exists; ${refFormats ? 'not written' : 'column left out'}`,
          where,
        ),
      );
    } else if (n2n && (fromColumns.length === 0 || toColumns.length === 0)) {
      unwritable = 'no-key';
      const keyless = fromColumns.length === 0 ? from : to;
      if (refFormats) {
        notes.push(
          note(
            'no-key',
            `${route} (n–n) not written: ${displayName(keyless)} has no primary key`,
            where,
          ),
        );
      }
    } else if (!n2n && (fromColumns.length === 0 || toColumns.length === 0)) {
      unwritable = 'no-columns';
      if (refFormats) {
        notes.push(
          note('no-columns', `Relationship ${route} names no columns; not a foreign key`, where),
        );
      }
    } else if (!n2n && fromColumns.length !== toColumns.length) {
      unwritable = 'length-mismatch';
      if (refFormats) {
        notes.push(
          note(
            'length-mismatch',
            `Relationship ${route} has ${String(fromColumns.length)} and ${String(toColumns.length)} columns; not written`,
            where,
          ),
        );
      }
    }
    const label = edge.label?.trim();
    return {
      id: edge.id,
      from: from.id,
      to: to.id,
      fromColumns,
      toColumns,
      ...(edge.cardinality === undefined ? {} : { cardinality: edge.cardinality }),
      fromOptional: edge.fromOptional === true,
      toOptional: edge.toOptional === true,
      ...(edge.onDelete === undefined ? {} : { onDelete: edge.onDelete }),
      ...(edge.onUpdate === undefined ? {} : { onUpdate: edge.onUpdate }),
      ...(label === undefined || label === '' ? {} : { label }),
      unwritable,
    };
  }

  // Foreign keys (research R5) and junction tables (R6): SQL only.
  const fksOf = new Map<Id, SliceForeignKey[]>();
  const junctions: SliceTable[] = [];
  if (isSql) {
    const taken = new Set(tables.map((t) => t.name.toLowerCase()));
    for (const rel of relationships) {
      if (rel.unwritable !== null) continue;
      const from = tableById.get(rel.from);
      const to = tableById.get(rel.to);
      if (from === undefined || to === undefined) continue;
      if (rel.cardinality === 'n-n') {
        if (!request.sql.junctionTables) {
          notes.push(
            note(
              'junction-skipped',
              `${displayName(from)} ↔ ${displayName(to)} (n–n) not written: junction tables are off`,
              { tableId: from.id },
            ),
          );
          continue;
        }
        junctions.push(junctionTable(rel, from, to, taken));
        continue;
      }
      const fk: SliceForeignKey =
        rel.cardinality === '1-n'
          ? fkOf(rel, to.id, rel.toColumns, from.id, rel.fromColumns)
          : fkOf(rel, from.id, rel.fromColumns, to.id, rel.toColumns);
      const list = fksOf.get(fk.table) ?? [];
      list.push(fk);
      fksOf.set(fk.table, list);
    }
  }

  function fkOf(
    rel: SliceRelationship,
    table: Id,
    columns: readonly Id[],
    refTable: Id,
    refColumns: readonly Id[],
  ): SliceForeignKey {
    return {
      relationshipId: rel.id,
      table,
      columns,
      refTable,
      refColumns,
      ...(rel.onDelete === undefined ? {} : { onDelete: rel.onDelete }),
      ...(rel.onUpdate === undefined ? {} : { onUpdate: rel.onUpdate }),
      ...(rel.label === undefined ? {} : { name: rel.label }),
      deferred: false,
    };
  }

  function junctionTable(
    rel: SliceRelationship,
    from: SliceTable,
    to: SliceTable,
    taken: Set<string>,
  ): SliceTable {
    const id = `junction:${rel.id}`;
    const base = `${from.name}_${to.name}`;
    let name = base;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base}_${String(n)}`;
    taken.add(name.toLowerCase());
    if (name !== base) {
      notes.push(
        note('junction-renamed', `Junction table ${base} exists; written as ${name}`, {
          tableId: from.id,
        }),
      );
    }
    const self = from.id === to.id;
    const sideColumns = (table: SliceTable, ids: readonly Id[], side: 'from' | 'to') =>
      ids.map((colId): SliceColumn => {
        const ref = table.columns.find((c) => c.id === colId);
        const suffix = self && side === 'to' ? '_2' : '';
        return {
          id: `${id}:${side}:${colId}`,
          name: `${table.name}_${ref?.name ?? colId}${suffix}`,
          type: ref?.type ?? { stored: 'text', written: 'text' },
          pk: true,
          notNull: false,
          unique: false,
          increment: false,
          ...(ref?.enum === undefined ? {} : { enum: ref.enum }),
        };
      });
    const fromCols = sideColumns(from, rel.fromColumns, 'from');
    const toCols = sideColumns(to, rel.toColumns, 'to');
    if (self) {
      notes.push(
        note(
          'self-junction',
          `${displayName(from)} ↔ ${displayName(to)} (n–n): second side's columns written as ${toCols.map((c) => c.name).join(', ')}`,
          { tableId: from.id },
        ),
      );
    }
    const columns = [...fromCols, ...toCols];
    const fk = (
      side: SliceColumn[],
      ref: SliceTable,
      refColumns: readonly Id[],
    ): SliceForeignKey => ({
      relationshipId: rel.id,
      table: id,
      columns: side.map((c) => c.id),
      refTable: ref.id,
      refColumns,
      ...(rel.onDelete === undefined ? {} : { onDelete: rel.onDelete }),
      ...(rel.onUpdate === undefined ? {} : { onUpdate: rel.onUpdate }),
      deferred: false,
    });
    return {
      id,
      name,
      schema: from.schema,
      columns,
      primaryKey: columns.map((c) => c.id),
      indexes: [],
      checks: [],
      foreignKeys: [fk(fromCols, from, rel.fromColumns), fk(toCols, to, rel.toColumns)],
      junction: true,
      joins: [from.id, to.id],
    };
  }

  // Dependency order (research R4): Kahn's algorithm, ties by schema, name, id; a table that only
  // waits on a cycle is created first and its foreign keys into the cycle are deferred.
  // A table's FKs in the order of their first column, then by relationship id.
  const withFks = tables.map((t) => {
    const at = (fk: SliceForeignKey) => t.columns.findIndex((c) => c.id === fk.columns[0]);
    const foreignKeys = [...(fksOf.get(t.id) ?? [])].sort(
      (a, b) => at(a) - at(b) || cmp(a.relationshipId, b.relationshipId),
    );
    return { ...t, foreignKeys };
  });
  const sqlOrder: Id[] = [];
  const created = new Set<Id>();
  const pending = [...withFks];
  const waitsOn = (t: SliceTable) =>
    t.foreignKeys.some((fk) => fk.refTable !== t.id && !created.has(fk.refTable));
  while (pending.length > 0) {
    let i = pending.findIndex((t) => !waitsOn(t));
    if (i === -1) i = 0;
    const [next] = pending.splice(i, 1);
    if (next === undefined) break;
    next.foreignKeys = next.foreignKeys.map((fk) =>
      fk.refTable !== next.id && !created.has(fk.refTable) ? { ...fk, deferred: true } : fk,
    );
    created.add(next.id);
    sqlOrder.push(next.id);
  }
  // Junction tables right after the later of their two tables.
  for (const junction of junctions) {
    const [a, b] = junction.joins ?? [junction.id, junction.id];
    const after = Math.max(sqlOrder.indexOf(a), sqlOrder.indexOf(b));
    let at = after + 1;
    while (at < sqlOrder.length && (sqlOrder[at] ?? '').startsWith('junction:')) at++;
    sqlOrder.splice(at, 0, junction.id);
  }
  const finalTables = withFks.map((t) => ({ ...t }));
  const byFinal = new Map(finalTables.map((t) => [t.id, t]));
  const deferredFks = sqlOrder.flatMap((id) =>
    (byFinal.get(id)?.foreignKeys ?? []).filter((fk) => fk.deferred),
  );

  const used = new Set<Id>();
  for (const table of finalTables) {
    for (const column of table.columns) if (column.enum !== undefined) used.add(column.enum.id);
  }
  const enums = (deck.enums ?? [])
    .filter((e) => used.has(e.id))
    .flatMap((e) => sliceEnumOf(e.id) ?? []);

  return {
    deckName: deck.name?.trim() || 'Untitled deck',
    scopeLabel: scopeLabel(deck, request.scope),
    dialect,
    tables: finalTables,
    junctions,
    sqlOrder,
    enums,
    relationships,
    deferredFks,
    notes: mergeNotes(notes, [...finalTables.map((t) => t.id), ...junctions.map((j) => j.id)]),
    outside,
  };
}

export { endText as relationshipEndText };
