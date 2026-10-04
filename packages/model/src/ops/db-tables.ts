/**
 * Table part operations (040, research R12): the columns, indexes and checks of a `db-table`
 * node. Each op validates the one part it writes with the generated Zod (and S14 for a column),
 * checks the ids it names, then writes field by field in one transaction (one undo step), so two
 * tabs editing different keys of one column both keep their change (US4).
 *
 * Flags (`pk`, `notNull`, `unique`, `increment`, an index's `unique`) are written `true` or
 * removed; a file's `false` stays valid and is kept until changed. Removing a part and its
 * cascade live in `cascade.ts` with the rest of the delete policy.
 */
import type { DbCheck, DbColumn, DbIndex, Id, Issue } from '@sododeck/schema';

import type { YObject, YValue } from '../convert';
import { DeckEditError } from '../errors';
import { dbPartIds, type IdPrefix } from '../ids';
import {
  childList,
  collectionMap,
  enumsList,
  insertAt,
  planMove,
  TABLE_LISTS,
  type DeckDoc,
  type ListMap,
  type TableList,
} from '../layout';
import { readObject } from '../read';
import { assertValid, validateObject } from '../validate';
import { createList, createObject, writeFields } from '../write';
import { requireEntry, type EditContext } from './context';
import { applyPatch } from './patch';
import type { Patch } from './types';

export type NewDbColumn = Omit<DbColumn, 'id'> & { id?: Id };
export type NewDbIndex = Omit<DbIndex, 'id'> & { id?: Id };
export type NewDbCheck = Omit<DbCheck, 'id'> & { id?: Id };

/** What each table list holds: its item kind, generated id prefix, label and flag keys. */
const PARTS = {
  columns: { prefix: 'dbcol', label: 'Column', flags: ['pk', 'notNull', 'unique', 'increment'] },
  indexes: { prefix: 'dbidx', label: 'Index', flags: ['unique'] },
  checks: { prefix: 'dbchk', label: 'Check', flags: [] },
} as const satisfies Record<
  TableList,
  { prefix: IdPrefix; label: string; flags: readonly string[] }
>;

/** The data `addColumn` / `addIndex` / `addCheck` take, by list. */
export interface NewPart {
  columns: NewDbColumn;
  indexes: NewDbIndex;
  checks: NewDbCheck;
}

/** The patch `updateColumn` / `updateIndex` / `updateCheck` take, by list. */
export interface PartPatch {
  columns: Patch<DbColumn>;
  indexes: Patch<DbIndex>;
  checks: Patch<DbCheck>;
}

function invalid(path: string, message: string): never {
  throw new DeckEditError('invalid', [{ path, message }]);
}

/** The node of a table, or throws `not-found`, or `invalid` when the node is not a table. */
export function requireTable(ctx: EditContext, tableId: Id): YObject {
  const node = requireEntry(collectionMap(ctx.doc, 'nodes'), tableId, 'Node');
  if (node.get('type') !== 'db-table') invalid('', `Node "${tableId}" is not a table.`);
  return node;
}

/** The part `partId` of a table list, or throws `not-found`. */
export function requirePart(node: YObject, tableId: Id, list: TableList, partId: Id): YObject {
  const item = childList(node, list)?.get(partId);
  if (item === undefined) {
    throw new DeckEditError('not-found', [
      {
        path: '',
        message: `${PARTS[list].label} "${partId}" of table "${tableId}" does not exist.`,
      },
    ]);
  }
  return item;
}

/** A table's list, attached on first write. Call inside a transaction. */
function attachedList(node: YObject, list: TableList): ListMap {
  const existing = childList(node, list);
  if (existing !== undefined) return existing;
  const created = createList(TABLE_LISTS[list], []);
  node.set(list, created as unknown as YValue);
  return created;
}

/** Column ids of a stored node (any type), in no particular order. */
export function columnIdsOf(node: YObject): Set<Id> {
  return new Set(childList(node, 'columns')?.keys() ?? []);
}

/** Flags in `patch` set to `false` become `null` (removed): the editor never writes `false`. */
function flagsAsRemovals(list: TableList, patch: object): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  for (const flag of PARTS[list].flags) if (out[flag] === false) out[flag] = null;
  return out;
}

/** References a part holds that do not resolve: a column's enum, an index's column parts. */
function refIssues(
  doc: DeckDoc,
  node: YObject,
  list: TableList,
  part: Record<string, unknown>,
  keys: readonly string[],
): Issue[] {
  const issues: Issue[] = [];
  if (list === 'columns' && keys.includes('enumRef') && typeof part.enumRef === 'string') {
    if (enumsList(doc)?.has(part.enumRef) !== true) {
      issues.push({ path: 'enumRef', message: `Enum "${part.enumRef}" does not exist.` });
    }
  }
  if (list === 'indexes' && keys.includes('columns') && Array.isArray(part.columns)) {
    const columns = columnIdsOf(node);
    part.columns.forEach((item, i) => {
      if (typeof item === 'string' && !columns.has(item)) {
        issues.push({
          path: `columns.${String(i)}`,
          message: `"${item}" is not a column of this table.`,
        });
      }
    });
  }
  return issues;
}

function assertRefs(issues: Issue[]): void {
  if (issues.length > 0) throw new DeckEditError('missing-reference', issues);
}

/** Refuses explicit ids already used by a database part, or repeated in the same insert. */
function assertFreePartIds(doc: DeckDoc, ids: readonly { path: string; id: Id }[]): void {
  if (ids.length === 0) return;
  const taken = dbPartIds(doc);
  const issues: Issue[] = [];
  for (const { path, id } of ids) {
    if (taken.has(id)) issues.push({ path, message: `Id "${id}" is already used in this deck.` });
    taken.add(id);
  }
  if (issues.length > 0) throw new DeckEditError('duplicate-id', issues);
}

/** Adds a part at `index` of a table list (default: last) and returns its id. */
export function addPart<L extends TableList>(
  ctx: EditContext,
  tableId: Id,
  list: L,
  data: NewPart[L],
  index?: number,
): Id {
  const node = requireTable(ctx, tableId);
  const { id: explicitId, ...fields } = data as Record<string, unknown> & { id?: Id };
  const id = explicitId ?? ctx.allocate(PARTS[list].prefix);
  const flags: readonly string[] = PARTS[list].flags;
  const entries: [string, unknown][] = [['id', id], ...Object.entries(fields)];
  const candidate = Object.fromEntries(
    entries.filter(([key, value]) => !flags.includes(key) || value === true),
  );
  assertValid(validateObject(TABLE_LISTS[list], candidate));
  assertFreePartIds(ctx.doc, explicitId === undefined ? [] : [{ path: 'id', id }]);
  assertRefs(refIssues(ctx.doc, node, list, candidate, Object.keys(candidate)));
  ctx.transact(() => {
    insertAt(attachedList(node, list), id, createObject(TABLE_LISTS[list], candidate, ''), index);
  });
  if (explicitId !== undefined) ctx.reserve([id]);
  return id;
}

/** Changes fields of a part; `null` clears an optional field, `false` removes a flag. */
export function updatePart<L extends TableList>(
  ctx: EditContext,
  tableId: Id,
  list: L,
  partId: Id,
  patch: PartPatch[L],
): void {
  const node = requireTable(ctx, tableId);
  const item = requirePart(node, tableId, list, partId);
  const kind = TABLE_LISTS[list];
  const { candidate, changed } = applyPatch(
    readObject(kind, partId, item),
    flagsAsRemovals(list, patch),
    [],
  );
  if (changed.length === 0) return;
  assertValid(validateObject(kind, candidate));
  assertRefs(refIssues(ctx.doc, node, list, candidate, changed));
  ctx.transact(() => {
    writeFields(item, kind, candidate, changed);
  }, `${list}:${tableId}:${partId}`);
}

/** Moves a part to `toIndex` of its list (clamped): one order key change. */
export function movePart(
  ctx: EditContext,
  tableId: Id,
  list: TableList,
  partId: Id,
  toIndex: number,
): void {
  const node = requireTable(ctx, tableId);
  requirePart(node, tableId, list, partId);
  const parts = childList(node, list);
  const move = parts === undefined ? undefined : planMove(parts, partId, toIndex);
  if (move !== undefined) ctx.transact(move);
}

/**
 * A node patch with the table rules applied (040): `columns`, `indexes` and `checks` change only
 * through their own ops; `expanded: false` removes the key (absent means collapsed).
 */
export function tablePatch(patch: object): object {
  const record = patch as Record<string, unknown>;
  for (const list of Object.keys(TABLE_LISTS)) {
    if (record[list] !== undefined) {
      invalid(list, `"${list}" change only through the column, index and check operations.`);
    }
  }
  return record.expanded === false ? { ...record, expanded: null } : patch;
}

/**
 * Database checks for a node being added (040): ids of its columns, indexes and checks must be
 * free in the database-parts scope (on any node type, as on load); on a table, index parts and
 * enum references must resolve.
 */
export function assertNewTableParts(ctx: EditContext, node: Record<string, unknown>): void {
  const ids: { path: string; id: Id }[] = [];
  for (const list of Object.keys(TABLE_LISTS)) {
    const items = node[list];
    if (!Array.isArray(items)) continue;
    items.forEach((item: unknown, i) => {
      const id = (item as { id?: unknown }).id;
      if (typeof id === 'string') ids.push({ path: `${list}.${String(i)}.id`, id });
    });
  }
  assertFreePartIds(ctx.doc, ids);
  if (node.type !== 'db-table') return;
  const columns = new Set(
    (Array.isArray(node.columns) ? node.columns : []).map((c: unknown) => (c as { id: Id }).id),
  );
  const enums = enumsList(ctx.doc);
  const issues: Issue[] = [];
  (Array.isArray(node.columns) ? node.columns : []).forEach((c: unknown, i) => {
    const ref = (c as { enumRef?: unknown }).enumRef;
    if (typeof ref === 'string' && enums?.has(ref) !== true) {
      issues.push({
        path: `columns.${String(i)}.enumRef`,
        message: `Enum "${ref}" does not exist.`,
      });
    }
  });
  (Array.isArray(node.indexes) ? node.indexes : []).forEach((index: unknown, i) => {
    const parts = (index as { columns?: unknown }).columns;
    if (!Array.isArray(parts)) return;
    parts.forEach((part: unknown, j) => {
      if (typeof part === 'string' && !columns.has(part)) {
        issues.push({
          path: `indexes.${String(i)}.columns.${String(j)}`,
          message: `"${part}" is not a column of this table.`,
        });
      }
    });
  });
  assertRefs(issues);
}

/**
 * Column ends of an edge that name no column of their end table (040, FR-018). Only the listed
 * `keys` are checked (an edit checks what it changes, so a broken edge stays editable), and only
 * ends whose card is a `db-table`; other cards are checked by shape only.
 */
export function columnEndIssues(
  doc: DeckDoc,
  edge: Record<string, unknown>,
  keys: readonly string[],
): Issue[] {
  const issues: Issue[] = [];
  const nodes = collectionMap(doc, 'nodes');
  for (const side of ['from', 'to'] as const) {
    const key = `${side}Columns`;
    const ids = edge[key];
    const tableId = edge[side];
    if (!keys.includes(key) || !Array.isArray(ids) || typeof tableId !== 'string') continue;
    const node = nodes.get(tableId);
    if (node?.get('type') !== 'db-table') continue;
    const columns = columnIdsOf(node);
    ids.forEach((id: unknown, i) => {
      if (typeof id === 'string' && !columns.has(id)) {
        issues.push({
          path: `${key}.${String(i)}`,
          message: `"${id}" is not a column of table "${tableId}".`,
        });
      }
    });
  }
  return issues;
}
