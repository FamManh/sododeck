/**
 * Schema lint rules (047, contracts/lint-rules.md): the `db-*` kinds beyond the dangling
 * references of 040. Pure and linear: one pass builds the indexes (tables by name, columns by id,
 * key sets), every rule reads them. Rules apply to `db-table` nodes, relationships (edges with
 * column ends between two tables) and `file.enums` only. Lives next to `problems.ts` (which calls
 * `checkSchema`) so that file stays about the generic checks.
 */
import type { DbColumn, DbEnum, Dialect, Edge, Id, Node, SododeckFile } from '@sododeck/schema';

import { isDbTable } from './card-types';
import { idTypeOf, sameColumnType, typeEntry } from './db-types';
import { deckDialect } from './dialect';
import type { Add, ProblemFix } from './problems';

const norm = (text: string | undefined) => (text ?? '').trim().toLowerCase();
const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

const DIALECT_NAMES: Readonly<Record<Dialect, string>> = {
  generic: 'Generic',
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
};

/** An edge with column ends on both sides, between two tables (042). */
export function isRelationship(edge: Edge, nodeById: ReadonlyMap<Id, Node>): boolean {
  if (edge.fromColumns === undefined || edge.toColumns === undefined) return false;
  const from = nodeById.get(edge.from);
  const to = nodeById.get(edge.to);
  return from !== undefined && to !== undefined && isDbTable(from) && isDbTable(to);
}

/** A relationship whose ends all resolve and have the same length: the only kind the rules read. */
interface Link {
  edge: Edge;
  /** The referencing (foreign key) end: `from`, except for `1-n` where `to` holds the key (045). */
  child: Side;
  /** The referenced end. */
  parent: Side;
}

interface Side {
  table: Node;
  columns: readonly DbColumn[];
}

interface Context {
  file: SododeckFile;
  dialect: Dialect;
  tables: readonly Node[];
  columnsById: ReadonlyMap<Id, DbColumn>;
  enums: ReadonlyMap<Id, DbEnum>;
  /** Table name, qualified with its schema only when the deck uses several. */
  tableName: (table: Node) => string;
  add: Add;
}

export function checkSchema(file: SododeckFile, nodeById: ReadonlyMap<Id, Node>, add: Add): void {
  const tables = file.nodes.filter(isDbTable);
  const enumList = file.enums ?? [];
  if (tables.length === 0 && enumList.length === 0) return;

  const schemas = new Set<string>();
  for (const table of tables) schemas.add(norm(table.schema));
  for (const e of enumList) schemas.add(norm(e.schema));
  const qualify = schemas.size > 1;
  const columnsById = new Map<Id, DbColumn>();
  for (const table of tables) for (const c of table.columns ?? []) columnsById.set(c.id, c);

  const ctx: Context = {
    file,
    dialect: deckDialect(file),
    tables,
    columnsById,
    enums: new Map(enumList.map((e) => [e.id, e])),
    tableName: (table) =>
      qualify && table.schema !== undefined ? `${table.schema}.${table.title}` : table.title,
    add,
  };

  checkTables(ctx);
  checkEnums(ctx, enumList);
  checkTypes(ctx);
  const links = relationshipLinks(file, nodeById);
  checkRelationships(ctx, links);
  checkRequiredLoops(ctx, links);
  for (const edge of file.edges) {
    if (edge.cardinality !== 'n-n') continue;
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (from === undefined || to === undefined || !isDbTable(from) || !isDbTable(to)) continue;
    add({
      kind: 'db-many-to-many',
      ids: [edge.id],
      target: { type: 'edges', ids: [edge.id] },
      on: [edge.id],
      detail: `n–n between ${ctx.tableName(from)} and ${ctx.tableName(to)}: create a junction table?`,
      objectTitle: from.title,
      short: 'n–n',
      fixes: [{ kind: 'create-junction', edgeId: edge.id, label: 'Create junction table' }],
    });
  }
}

function relationshipLinks(file: SododeckFile, nodeById: ReadonlyMap<Id, Node>): Link[] {
  const links: Link[] = [];
  for (const edge of file.edges) {
    if (!isRelationship(edge, nodeById)) continue;
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    const { fromColumns, toColumns } = edge;
    if (from === undefined || to === undefined) continue;
    if (fromColumns === undefined || toColumns === undefined) continue;
    if (fromColumns.length !== toColumns.length) continue;
    const resolve = (table: Node, ids: readonly Id[]) => {
      const found: DbColumn[] = [];
      for (const id of ids) {
        const column = (table.columns ?? []).find((c) => c.id === id);
        if (column === undefined) return undefined;
        found.push(column);
      }
      return found;
    };
    const left = resolve(from, fromColumns);
    const right = resolve(to, toColumns);
    if (left === undefined || right === undefined) continue;
    const start = { table: from, columns: left };
    const end = { table: to, columns: right };
    links.push(
      edge.cardinality === '1-n'
        ? { edge, child: end, parent: start }
        : { edge, child: start, parent: end },
    );
  }
  return links;
}

/** Names that must be unique per table, per schema, and keys of the table itself. */
function checkTables(ctx: Context): void {
  const { add } = ctx;
  const byName = new Map<string, Node>();
  for (const table of ctx.tables) {
    const columns = table.columns ?? [];
    const name = ctx.tableName(table);
    const on = [table.id];
    const target = { type: 'node', id: table.id } as const;
    const base = { on, target, objectTitle: table.title };

    const tableKey = `${norm(table.schema)}|${norm(table.title)}`;
    const first = norm(table.title) === '' ? undefined : byName.get(tableKey);
    if (first === undefined) byName.set(tableKey, table);
    else {
      add({
        kind: 'db-duplicate-table',
        ids: [table.id],
        on: [first.id, table.id],
        target: { type: 'nodes', ids: [first.id, table.id] },
        objectTitle: table.title,
        detail: `Two tables named ${table.title.trim()}${table.schema === undefined ? '' : ` in ${table.schema}`}`,
        fixes: [{ kind: 'rename', target: { type: 'table', tableId: table.id }, label: 'Rename' }],
      });
    }

    if (columns.length > 0 && !columns.some((c) => c.pk === true)) {
      const idColumn = columns.find((c) => norm(c.name) === 'id');
      const idType = idTypeOf(ctx.dialect);
      const fix: ProblemFix =
        idColumn === undefined
          ? {
              kind: 'add-id-pk',
              tableId: table.id,
              type: idType,
              label: `Add id ${idType} PK`,
            }
          : { kind: 'make-pk', tableId: table.id, columnId: idColumn.id, label: 'Make id the PK' };
      add({
        ...base,
        kind: 'db-no-primary-key',
        ids: [table.id],
        detail: `${name} has no primary key`,
        ...(idColumn === undefined ? {} : { column: { tableId: table.id, columnId: idColumn.id } }),
        fixes: [fix],
      });
    }

    const seenColumns = new Set<string>();
    for (const column of columns) {
      const columnName = norm(column.name);
      const where = { tableId: table.id, columnId: column.id };
      if (columnName === '') {
        add({
          ...base,
          kind: 'db-empty-column',
          ids: [table.id, column.id, 'name'],
          detail: `${name} has a column without a name`,
          column: where,
          fixes: [
            {
              kind: 'rename',
              target: { type: 'column', ...where },
              label: 'Rename',
            },
          ],
        });
      } else if (seenColumns.has(columnName)) {
        add({
          ...base,
          kind: 'db-duplicate-column',
          ids: [table.id, column.id],
          detail: `${name} has two columns named ${column.name.trim()}`,
          column: where,
          fixes: [{ kind: 'rename', target: { type: 'column', ...where }, label: 'Rename' }],
        });
      } else seenColumns.add(columnName);

      if (norm(column.type) === '') {
        add({
          ...base,
          kind: 'db-empty-column',
          title: 'Column without a type',
          ids: [table.id, column.id, 'type'],
          detail: `${name}.${column.name} has no type`,
          column: where,
          fixes: [{ kind: 'pick-type', ...where, label: 'Change type' }],
        });
      }

      const nullDefault = column.notNull === true && /^\s*null\s*$/i.test(column.defaultExpr ?? '');
      if (nullDefault) {
        add({
          ...base,
          kind: 'db-null-default',
          ids: [table.id, column.id],
          detail: `${name}.${column.name} is not null with default NULL`,
          column: where,
          fixes: [
            { kind: 'remove-default', ...where, label: 'Remove default' },
            { kind: 'allow-null', ...where, label: 'Allow null' },
          ],
        });
      }
      checkDefault(ctx, table, column, base);
    }

    const seenIndexes = new Set<string>();
    for (const index of table.indexes ?? []) {
      const indexName = norm(index.name);
      if (indexName === '') continue;
      if (!seenIndexes.has(indexName)) {
        seenIndexes.add(indexName);
        continue;
      }
      add({
        ...base,
        kind: 'db-duplicate-index',
        ids: [table.id, index.id],
        detail: `${name} has two indexes named ${(index.name ?? '').trim()}`,
        fixes: [
          {
            kind: 'rename',
            target: { type: 'index', tableId: table.id, indexId: index.id },
            label: 'Rename',
          },
        ],
      });
    }
  }
}

type Base = { on: readonly Id[]; target: { type: 'node'; id: Id }; objectTitle: string };

/** A default the type cannot hold: only data defaults on numbers, booleans and enum columns. */
function checkDefault(ctx: Context, table: Node, column: DbColumn, base: Base): void {
  const value = column.default;
  if (value === undefined) return;
  let fits = true;
  if (column.enumRef !== undefined) {
    const values = ctx.enums.get(column.enumRef)?.values;
    if (values !== undefined) fits = values.some((v) => v.name === String(value));
  } else {
    const kind = typeEntry(ctx.dialect, column.type)?.kind;
    // MySQL and SQLite keep booleans in integer columns, so a number takes true / false too.
    const isBoolean =
      typeof value === 'boolean' ||
      value === 0 ||
      value === 1 ||
      value === 'true' ||
      value === 'false';
    if (kind === 'number') {
      fits =
        isBoolean ||
        typeof value === 'number' ||
        (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
    } else if (kind === 'boolean') {
      fits = isBoolean;
    }
  }
  if (fits) return;
  const where = { tableId: table.id, columnId: column.id };
  ctx.add({
    ...base,
    kind: 'db-default-type',
    ids: [table.id, column.id],
    detail: `${ctx.tableName(table)}.${column.name} is ${column.type} with default '${String(value)}'`,
    column: where,
    fixes: [{ kind: 'remove-default', ...where, label: 'Remove default' }],
  });
}

function checkEnums(ctx: Context, enums: readonly DbEnum[]): void {
  const byName = new Map<string, DbEnum>();
  const ref = (e: DbEnum) =>
    ({
      type: 'object',
      ref: { scope: 'meta', id: '', child: { kind: 'enum', id: e.id } },
    }) as const;
  for (const e of enums) {
    const key = `${norm(e.schema)}|${norm(e.name)}`;
    const base = { on: [e.id], target: ref(e), objectTitle: e.name };
    if (byName.has(key)) {
      ctx.add({
        ...base,
        kind: 'db-duplicate-enum',
        ids: [e.id],
        detail: `Two enums named ${e.name.trim()}${e.schema === undefined ? '' : ` in ${e.schema}`}`,
        fixes: [{ kind: 'rename', target: { type: 'enum', enumId: e.id }, label: 'Rename' }],
      });
    } else byName.set(key, e);

    const seen = new Set<string>();
    const repeated = new Set<string>();
    for (const value of e.values) {
      const name = norm(value.name);
      if (seen.has(name) && !repeated.has(name)) {
        repeated.add(name);
        ctx.add({
          ...base,
          kind: 'db-duplicate-enum',
          ids: [e.id, 'value', name],
          detail: `${e.name} has the value ${value.name} twice`,
          fixes: [{ kind: 'add-values', enumId: e.id, label: 'Add values' }],
        });
      }
      seen.add(name);
    }
    if (e.values.length === 0) {
      ctx.add({
        ...base,
        kind: 'db-empty-enum',
        ids: [e.id],
        detail: `Enum ${e.name} has no values`,
        fixes: [{ kind: 'add-values', enumId: e.id, label: 'Add values' }],
      });
    }
  }
}

/** One warning per type name that the deck's dialect does not list. */
function checkTypes(ctx: Context): void {
  const groups = new Map<string, { type: string; tables: Node[]; columns: DbColumn[] }>();
  for (const table of ctx.tables) {
    for (const column of table.columns ?? []) {
      if (column.enumRef !== undefined || norm(column.type) === '') continue;
      if (typeEntry(ctx.dialect, column.type) !== undefined) continue;
      const key = norm(column.type).replace(/\s*\(.*\)$/, '');
      let group = groups.get(key);
      if (group === undefined) {
        group = { type: key, tables: [], columns: [] };
        groups.set(key, group);
      }
      if (!group.tables.includes(table)) group.tables.push(table);
      group.columns.push(column);
    }
  }
  const list = DIALECT_NAMES[ctx.dialect];
  for (const [key, group] of groups) {
    const firstTable = group.tables[0];
    const firstColumn = group.columns[0];
    if (firstTable === undefined || firstColumn === undefined) continue;
    const where = { tableId: firstTable.id, columnId: firstColumn.id };
    const ids = group.tables.map((t) => t.id);
    ctx.add({
      kind: 'db-unknown-type',
      ids: [key],
      on: ids,
      target: { type: 'nodes', ids },
      title: `Type not in the ${list} list`,
      detail: `${key} is not a ${list} type · ${plural(group.columns.length, 'column')}`,
      objectTitle: key,
      column: where,
      fixes: [{ kind: 'pick-type', ...where, label: 'Change type' }],
    });
  }
}

const typeText = (column: DbColumn) =>
  column.size === undefined || column.type.includes('(')
    ? column.type
    : `${column.type}(${column.size})`;

const refText = (ctx: Context, side: Side) =>
  `${ctx.tableName(side.table)}.${side.columns.map((c) => c.name).join(', ')}`;

function checkRelationships(ctx: Context, links: readonly Link[]): void {
  const seen = new Set<string>();
  for (const link of links) {
    const { edge, child, parent } = link;
    const first = child.columns[0];
    if (first === undefined) continue;
    const where = { tableId: child.table.id, columnId: first.id };
    const base = {
      on: [edge.id, child.table.id],
      target: { type: 'edges', ids: [edge.id] } as const,
      objectTitle: child.table.title,
    };

    // Type mismatch: every pair that differs; the fix changes the referencing columns.
    const bad = child.columns.flatMap((c, i) => {
      const other = parent.columns[i];
      return other === undefined || sameColumnType(c, other, ctx.dialect)
        ? []
        : [{ column: c, other }];
    });
    const firstBad = bad[0];
    if (firstBad !== undefined) {
      const { column, other } = firstBad;
      ctx.add({
        ...base,
        kind: 'db-type-mismatch',
        ids: [edge.id],
        detail: `${ctx.tableName(child.table)}.${column.name} is ${typeText(column)}, ${ctx.tableName(parent.table)}.${other.name} is ${typeText(other)}`,
        column: { tableId: child.table.id, columnId: column.id },
        short: `${column.type} → ${other.type}`,
        fixes: [
          {
            kind: 'match-type',
            tableId: child.table.id,
            label: 'Change type',
            changes: bad.map((b) => ({
              columnId: b.column.id,
              type: b.other.type,
              ...(b.other.size === undefined ? {} : { size: b.other.size }),
            })),
          },
        ],
      });
    }

    const route = `${refText(ctx, child)} → ${refText(ctx, parent)}`;
    if (!referencesKey(parent)) {
      ctx.add({
        ...base,
        kind: 'db-fk-not-key',
        ids: [edge.id],
        detail: `${route}: not a primary key or unique`,
        column: where,
        short: 'not key',
        fixes: [{ kind: 'pick-column', edgeId: edge.id, label: 'Pick column' }],
      });
    }

    const key = JSON.stringify([
      child.table.id,
      parent.table.id,
      child.columns.map((c) => c.id),
      parent.columns.map((c) => c.id),
    ]);
    if (seen.has(key)) {
      ctx.add({
        ...base,
        kind: 'db-duplicate-relationship',
        ids: [edge.id],
        detail: `${route} appears twice`,
        column: where,
        fixes: [{ kind: 'delete-edge', edgeId: edge.id, label: 'Delete duplicate' }],
      });
    } else seen.add(key);
  }
}

/** The referenced columns, as a set, are the primary key, a unique column or a unique index. */
function referencesKey(parent: Side): boolean {
  const ids = new Set(parent.columns.map((c) => c.id));
  const same = (other: ReadonlySet<Id>) =>
    other.size === ids.size && [...ids].every((id) => other.has(id));
  const columns = parent.table.columns ?? [];
  const primary = new Set(columns.filter((c) => c.pk === true).map((c) => c.id));
  if (primary.size > 0 && same(primary)) return true;
  const only = parent.columns[0];
  if (parent.columns.length === 1 && only?.unique === true) return true;
  return (parent.table.indexes ?? []).some((index) => {
    if (index.unique !== true) return false;
    const parts = index.columns.filter((p): p is string => typeof p === 'string');
    return parts.length === index.columns.length && same(new Set(parts));
  });
}

/**
 * Tables that reference each other through not-null columns can never get a first row. Tarjan's
 * strongly connected components over those relationships (iterative: decks can be large).
 */
function checkRequiredLoops(ctx: Context, links: readonly Link[]): void {
  const required = links.filter((l) => l.child.columns.every((c) => c.notNull === true));
  if (required.length === 0) return;
  const next = new Map<Id, Id[]>();
  for (const l of required) {
    const list = next.get(l.child.table.id);
    if (list === undefined) next.set(l.child.table.id, [l.parent.table.id]);
    else list.push(l.parent.table.id);
  }
  const index = new Map<Id, number>();
  const low = new Map<Id, number>();
  const onStack = new Set<Id>();
  const stack: Id[] = [];
  const components: Id[][] = [];
  let counter = 0;
  for (const root of next.keys()) {
    if (index.has(root)) continue;
    const work: { id: Id; i: number }[] = [{ id: root, i: 0 }];
    index.set(root, counter);
    low.set(root, counter++);
    stack.push(root);
    onStack.add(root);
    while (work.length > 0) {
      const frame = work[work.length - 1];
      if (frame === undefined) break;
      const targets = next.get(frame.id) ?? [];
      const target = targets[frame.i++];
      if (target !== undefined) {
        if (!index.has(target)) {
          index.set(target, counter);
          low.set(target, counter++);
          stack.push(target);
          onStack.add(target);
          work.push({ id: target, i: 0 });
        } else if (onStack.has(target)) {
          low.set(frame.id, Math.min(low.get(frame.id) ?? 0, index.get(target) ?? 0));
        }
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent !== undefined) {
        low.set(parent.id, Math.min(low.get(parent.id) ?? 0, low.get(frame.id) ?? 0));
      }
      if (low.get(frame.id) !== index.get(frame.id)) continue;
      const component: Id[] = [];
      for (;;) {
        const top = stack.pop();
        if (top === undefined) break;
        onStack.delete(top);
        component.push(top);
        if (top === frame.id) break;
      }
      components.push(component);
    }
  }

  const order = new Map(ctx.tables.map((t, i) => [t.id, i]));
  const titles = new Map(ctx.tables.map((t) => [t.id, ctx.tableName(t)]));
  for (const component of components) {
    const members = new Set(component);
    const inside = required.filter(
      (l) => members.has(l.child.table.id) && members.has(l.parent.table.id),
    );
    const selfOnly =
      component.length === 1 && inside.some((l) => l.child.table.id === l.parent.table.id);
    if (component.length < 2 && !selfOnly) continue;
    const sorted = [...component].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    const ids = [...component].sort();
    const walk = loopWalk(sorted, inside);
    const names = walk.map((id) => titles.get(id) ?? id);
    const edgeIds = inside.map((l) => l.edge.id);
    ctx.add({
      kind: 'db-required-loop',
      ids,
      on: [...edgeIds, ...sorted],
      target: { type: 'edges', ids: edgeIds },
      detail: `${names.join(' → ')}: every reference is not null`,
      objectTitle: names[0] ?? '',
      short: 'loop',
    });
  }
}

/** Tables in the order a reference chain visits them, back to the first (one loop is enough). */
function loopWalk(sorted: readonly Id[], edges: readonly Link[]): Id[] {
  const [start] = sorted;
  if (start === undefined) return [];
  const walk = [start];
  const visited = new Set(walk);
  let at = start;
  for (;;) {
    const step = edges.find(
      (l) => l.child.table.id === at && l.parent.table.id !== at && !visited.has(l.parent.table.id),
    );
    if (step === undefined) break;
    at = step.parent.table.id;
    walk.push(at);
    visited.add(at);
  }
  for (const id of sorted) if (!visited.has(id)) walk.push(id);
  return [...walk, start];
}
