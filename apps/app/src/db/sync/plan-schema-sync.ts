/**
 * The schema sync planner (046 contracts/schema-sync.md): the deck, the parsed DBML and a context
 * in; a plan of operations and the problems found out. validate → map → match → plan. Matched
 * objects get patches of the fields DBML expresses and nothing else, so applying the writer's own
 * text is an empty plan (SC-004). Pure: no React, DOM, Yjs or `editor/` imports.
 *
 * The text is mapped to deck shapes by 044's `buildPlan` (one place that knows how DBML columns,
 * defaults, indexes and enums become deck objects); this module only compares those shapes with
 * the deck and works out which object is which.
 */
import { deckDialect, isDbTable } from '@sododeck/model';
import type {
  Cardinality,
  DbCheck,
  DbColumn,
  DbEnum,
  DbIndex,
  DbIndexPart,
  Edge,
  Id,
  Node,
  SododeckFile,
} from '@sododeck/schema';

import { buildPlan } from '../import/build-plan';
import type { ImportTarget, RawRef, RawSchema, RawTable } from '../import/types';
import {
  matchChecks,
  matchColumns,
  matchEnums,
  matchIndexes,
  matchRelationships,
  matchTables,
  matchValues,
  type Matching,
} from './match';
import {
  normaliseDeckTable,
  normaliseRawTable,
  schemaName,
  type NormalDeckTable,
} from './normalise';
import { defaultSizeOf, placeNewTables } from './place-new-tables';
import {
  emptyPlan,
  type CheckPatch,
  type ColumnPatch,
  type EnumOps,
  type IndexPatch,
  type NewRelationship,
  type PartOps,
  type RelationshipPatch,
  type RememberedTable,
  type SchemaPlan,
  type SyncContext,
  type SyncResult,
  type TableOps,
  type TablePatch,
  type TextProblem,
} from './types';
import {
  lineProblem,
  nonInputProblems,
  validateEnumDefaults,
  validatePlan,
  validateText,
} from './validate';

const lc = (text: string) => text.toLowerCase();
const same = (a: string | undefined, b: string | undefined) => (a ?? '') === (b ?? '');
const flag = (value: boolean | undefined) => value === true;
const trimmed = (text: string | undefined): string | undefined => {
  const value = text?.trim();
  return value === undefined || value === '' ? undefined : value;
};
const compactSize = (size: string | undefined) => trimmed(size)?.replace(/\s+/g, '');

const hasErrors = (problems: readonly TextProblem[]) =>
  problems.some((p) => p.severity === 'error');

/** A name as the text spells a table: `schema.name` lower case, `public` left out. */
const nameKeyOf = (name: string, schema: string | undefined) =>
  lc(schemaName(schema) === undefined ? name : `${schemaName(schema) ?? ''}.${name}`);

function partsEqual(a: readonly DbIndexPart[], b: readonly DbIndexPart[]): boolean {
  return signatureOf(a) === signatureOf(b);
}

function signatureOf(parts: readonly DbIndexPart[]): string {
  return parts.map((p) => (typeof p === 'string' ? p : `\`${p.expr}\``)).join(',');
}

function emptyOps<TItem extends { id: Id }, TPatch>(): PartOps<TItem, TPatch> {
  return { adds: [], updates: [], order: [], removes: [] };
}

const isEmptyOps = (ops: PartOps<{ id: Id }, unknown>) =>
  ops.adds.length === 0 &&
  ops.updates.length === 0 &&
  ops.removes.length === 0 &&
  ops.order.length === 0;

/** Final order differs from the one the other operations leave (survivors first, adds last)? */
function needsOrder(
  existing: readonly { id: Id }[],
  matching: Matching,
  finalOrder: readonly Id[],
  isAdded: (id: Id) => boolean,
): boolean {
  const kept = new Set(matching.pairs.map((p) => p.existing));
  const natural = [
    ...existing.filter((_, i) => kept.has(i)).map((item) => item.id),
    ...finalOrder.filter(isAdded),
  ];
  return natural.length !== finalOrder.length || natural.some((id, i) => id !== finalOrder[i]);
}

/** One parsed table, resolved against the deck. */
interface Resolved {
  parsedIndex: number;
  raw: RawTable;
  /** The mapped table (ids are the real new ids until matched). */
  planned: Node;
  /** The table's id in the deck after the apply. */
  id: Id;
  /** Its deck table when matched or restored. */
  existing: NormalDeckTable | undefined;
  restored: RememberedTable | undefined;
  /** Planned column id → final column id. */
  columnId: Map<Id, Id>;
  /** Lower-cased column name → final column id. */
  columnByName: Map<string, Id>;
  columnMatching: Matching | undefined;
}

interface EndInfo {
  id: Id;
  columnByName: Map<string, Id>;
  key: readonly Id[];
}

export function planSchemaSync(deck: SododeckFile, raw: RawSchema, ctx: SyncContext): SyncResult {
  const warnings = nonInputProblems(raw, deckDialect(deck));
  const textProblems = validateText(deck, raw, ctx.scope);
  if (hasErrors(textProblems)) {
    return { plan: emptyPlan(), problems: [...textProblems, ...warnings] };
  }

  // --- map the text to deck shapes ---------------------------------------------------------------
  const parsedTables = raw.tables.map(normaliseRawTable);
  const target: ImportTarget = {
    kind: 'deck',
    deckDialect: deckDialect(deck),
    deckHasTables: true,
    deckHasDescription: true,
    tableNames: [],
    enumNames: [],
  };
  const mapped = buildPlan({ ...raw, tables: parsedTables, groups: [], notes: [] }, {}, target, {
    importDialect: null,
    allocate: (prefix) => ctx.newId(prefix),
  });
  const plannedNodes = mapped.fragment.deck.nodes;
  const plannedEnums = mapped.enums;
  const rawEnumCount = raw.enums.length;

  const enumKeyOfPlan = new Map(plannedEnums.map((e) => [e.planId, e.planId]));
  const defaultProblems = validateEnumDefaults(
    raw,
    new Map(plannedEnums.map((e) => [e.planId, (e.values ?? []).map((v) => v.name)])),
    (t, c) => {
      const column = plannedNodes[t]?.columns?.[c];
      return column?.enumRef === undefined ? undefined : enumKeyOfPlan.get(column.enumRef);
    },
  );
  if (hasErrors(defaultProblems)) {
    return { plan: emptyPlan(), problems: [...defaultProblems, ...warnings] };
  }

  // --- scope ----------------------------------------------------------------------------------
  const deckTables = deck.nodes.filter(isDbTable);
  const baseline = ctx.scope.kind === 'selection' ? new Set(ctx.scope.baseline) : null;
  const scopeNodes = deckTables.filter((n) => baseline === null || baseline.has(n.id));
  const scopeIds = new Set(scopeNodes.map((n) => n.id));
  const outsideNodes = deckTables.filter((n) => !scopeIds.has(n.id));
  const deckIds = collectIds(deck);

  // --- enums ------------------------------------------------------------------------------------
  const deckEnums = deck.enums ?? [];
  const enumById = new Map(deckEnums.map((e) => [e.id, e]));
  /** Enums the text covers: written (has values) and used by a table in scope. */
  const writtenEnums = new Set<Id>();
  for (const node of scopeNodes) {
    for (const column of node.columns ?? []) {
      const found = column.enumRef === undefined ? undefined : enumById.get(column.enumRef);
      if (found !== undefined && found.values.length > 0) writtenEnums.add(found.id);
    }
  }
  const parsedEnumShapes = plannedEnums.slice(0, rawEnumCount).map((e) => ({
    name: e.name,
    ...(schemaName(e.schema) === undefined ? {} : { schema: schemaName(e.schema) ?? '' }),
    values: (e.values ?? []).map((v) => v.name),
  }));
  const enumMatching = matchEnums(
    deckEnums.map((e) => ({
      name: e.name,
      ...(schemaName(e.schema) === undefined ? {} : { schema: schemaName(e.schema) ?? '' }),
      values: e.values.map((v) => v.name),
    })),
    parsedEnumShapes,
  );
  // A rename guess only counts for an enum the text covers; others keep their own names.
  const enumPairs = enumMatching.pairs.filter((p) => {
    const found = deckEnums[p.existing];
    return p.how !== 'rename' || (found !== undefined && writtenEnums.has(found.id));
  });
  const enumFinal = new Map<Id, Id>();
  const matchedEnumIds = new Set<Id>();
  for (const e of plannedEnums) enumFinal.set(e.planId, e.planId);
  for (const pair of enumPairs) {
    const found = deckEnums[pair.existing];
    const planned = plannedEnums[pair.parsed];
    if (found === undefined || planned === undefined) continue;
    enumFinal.set(planned.planId, found.id);
    matchedEnumIds.add(found.id);
  }
  const finalEnumName = new Map<Id, string>();
  for (const e of plannedEnums) finalEnumName.set(enumFinal.get(e.planId) ?? e.planId, e.name);

  const enumOps: EnumOps = { adds: [], updates: [], removes: [] };
  const pairedParsed = new Set(enumPairs.map((p) => p.parsed));
  plannedEnums.slice(0, rawEnumCount).forEach((e, index) => {
    if (pairedParsed.has(index)) return;
    enumOps.adds.push({
      id: e.planId,
      name: e.name,
      ...(schemaName(e.schema) === undefined ? {} : { schema: schemaName(e.schema) ?? '' }),
      ...(trimmed(e.note) === undefined ? {} : { note: trimmed(e.note) ?? '' }),
      values: (e.values ?? []).map((v) => ({
        id: ctx.newId('enumval'),
        name: v.name,
        ...(trimmed(v.note) === undefined ? {} : { note: trimmed(v.note) ?? '' }),
      })),
    });
  });
  for (const pair of enumPairs) {
    const found = deckEnums[pair.existing];
    const planned = plannedEnums[pair.parsed];
    if (found === undefined || planned === undefined) continue;
    const update = diffEnum(found, planned, ctx);
    if (update !== undefined) enumOps.updates.push(update);
  }
  for (const [index, found] of deckEnums.entries()) {
    if (!writtenEnums.has(found.id)) continue;
    if (enumPairs.some((p) => p.existing === index)) continue;
    enumOps.removes.push(found.id);
  }

  // --- tables: which is which ---------------------------------------------------------------
  const existingViews = scopeNodes.map(normaliseDeckTable);
  const freeMemory = new Map<string, RememberedTable>();
  for (const [key, remembered] of ctx.memory) {
    if (idsFree(deckIds, remembered.node)) freeMemory.set(key, remembered);
  }
  const tableMatching = matchTables(
    existingViews.map((t) => ({
      name: t.title,
      ...(t.schema === undefined ? {} : { schema: t.schema }),
      columns: t.columns.map((c) => c.name),
    })),
    parsedTables.map((t) => ({
      name: t.name,
      ...(schemaName(t.schema) === undefined ? {} : { schema: schemaName(t.schema) ?? '' }),
      columns: t.columns.map((c) => c.name),
    })),
    new Set(freeMemory.keys()),
  );

  const resolved: Resolved[] = [];
  parsedTables.forEach((rawTable, p) => {
    const planned = plannedNodes[p];
    if (planned === undefined) return;
    const pair = tableMatching.pairs.find((x) => x.parsed === p);
    const restoredAt = tableMatching.restored.find((x) => x.parsed === p);
    const remembered = restoredAt === undefined ? undefined : freeMemory.get(restoredAt.key);
    let existing: NormalDeckTable | undefined;
    if (pair !== undefined) existing = existingViews[pair.existing];
    else if (remembered !== undefined)
      existing = normaliseDeckTable(stripStaleRefs(remembered.node, enumById, deck));
    const columnId = new Map<Id, Id>();
    const columnByName = new Map<string, Id>();
    let columnMatching: Matching | undefined;
    const plannedColumns = planned.columns ?? [];
    if (existing === undefined) {
      for (const column of plannedColumns) {
        columnId.set(column.id, column.id);
        columnByName.set(lc(column.name), column.id);
      }
    } else {
      columnMatching = matchColumns(
        existing.columns.map((c) => ({ name: c.name, type: lc(c.type) })),
        plannedColumns.map((c) => ({ name: c.name, type: lc(c.type) })),
      );
      const matchedTo = new Map(columnMatching.pairs.map((m) => [m.parsed, m.existing]));
      plannedColumns.forEach((column, i) => {
        const at = matchedTo.get(i);
        const kept = at === undefined ? undefined : existing.columns[at];
        const id = kept?.id ?? column.id;
        columnId.set(column.id, id);
        columnByName.set(lc(column.name), id);
      });
    }
    resolved.push({
      parsedIndex: p,
      raw: rawTable,
      planned,
      id: existing?.node.id ?? planned.id,
      existing,
      restored: remembered,
      columnId,
      columnByName,
      columnMatching,
    });
  });

  const mapPart = (resolvedTable: Resolved, part: DbIndexPart): DbIndexPart =>
    typeof part === 'string' ? (resolvedTable.columnId.get(part) ?? part) : part;
  const finalColumn = (resolvedTable: Resolved, column: DbColumn): DbColumn => {
    const { enumRef, ...rest } = column;
    const finalRef = enumRef === undefined ? undefined : (enumFinal.get(enumRef) ?? enumRef);
    return {
      ...rest,
      id: resolvedTable.columnId.get(column.id) ?? column.id,
      ...(finalRef === undefined ? {} : { enumRef: finalRef }),
    };
  };

  // --- tables: what changes -----------------------------------------------------------------
  const plan = emptyPlan();
  plan.enumOps = enumOps;
  const tableLine = new Map<Id, number>();
  const plainAdds: Node[] = [];

  for (const table of resolved) {
    if (table.existing !== undefined) tableLine.set(table.existing.node.id, table.raw.line);
    const finalColumns = (table.planned.columns ?? []).map((c) => finalColumn(table, c));
    const finalIndexes: DbIndex[] = (table.planned.indexes ?? []).map((index) => ({
      ...index,
      columns: index.columns.map((part) => mapPart(table, part)),
    }));
    if (table.existing === undefined) {
      const { style: _style, group: _group, parent: _parent, ...node } = table.planned;
      const added: Node = {
        ...node,
        columns: finalColumns,
        ...(finalIndexes.length === 0 ? {} : { indexes: finalIndexes }),
      };
      plainAdds.push(added);
      plan.addTables.push({ node: added });
      continue;
    }
    if (table.restored !== undefined) {
      plan.addTables.push({ node: table.existing.node, restoredFrom: 'memory' });
    }
    const patch = diffTable(table.existing, table.raw);
    if (patch !== undefined) plan.updateTables.push({ id: table.existing.node.id, patch });
    const ops = diffParts(
      table,
      finalColumns,
      finalIndexes,
      enumById,
      writtenEnums,
      matchedEnumIds,
    );
    if (ops !== undefined) plan.tableOps.push(ops);
  }

  const unmatchedExisting = tableMatching.removed
    .map((i) => scopeNodes[i])
    .filter((n): n is Node => n !== undefined);
  plan.removeTables = unmatchedExisting.map((n) => ({ id: n.id, name: n.title }));
  plan.removesAll =
    ctx.scope.kind === 'schema' && parsedTables.length === 0 && unmatchedExisting.length > 0;

  // --- relationships ------------------------------------------------------------------------
  const ends = new Map<string, EndInfo>();
  for (const table of resolved) {
    ends.set(nameKeyOf(table.raw.name, table.raw.schema), {
      id: table.id,
      columnByName: table.columnByName,
      key: (table.planned.columns ?? [])
        .filter((c) => c.pk === true)
        .map((c) => table.columnId.get(c.id) ?? c.id),
    });
  }
  for (const node of outsideNodes) {
    ends.set(nameKeyOf(node.title.trim(), node.schema), {
      id: node.id,
      columnByName: new Map((node.columns ?? []).map((c) => [lc(c.name), c.id])),
      key: (node.columns ?? []).filter((c) => c.pk === true).map((c) => c.id),
    });
  }
  const removedIds = new Set(plan.removeTables.map((t) => t.id));
  planRelationships(deck, raw.refs, ends, resolved, scopeIds, removedIds, ctx, plan);

  // --- new tables get a place ---------------------------------------------------------------
  const positions = placeNewTables(
    deck,
    [...scopeIds],
    plainAdds,
    ctx.viewport,
    ctx.sizeOf ?? defaultSizeOf,
  );
  for (const entry of plan.addTables) {
    const at = positions.get(entry.node.id);
    if (at !== undefined && entry.restoredFrom === undefined) entry.node.position = at;
  }

  // --- problems on the plan -----------------------------------------------------------------
  const outsideColumnsByEnum = new Map<Id, number>();
  for (const node of outsideNodes) {
    for (const column of node.columns ?? []) {
      if (column.enumRef === undefined) continue;
      outsideColumnsByEnum.set(column.enumRef, (outsideColumnsByEnum.get(column.enumRef) ?? 0) + 1);
    }
  }
  const planProblems = validatePlan(deck, plan, {
    tableLine,
    enumUsers: enumOps.removes.map((id) => ({
      id,
      name: enumById.get(id)?.name ?? id,
      users: outsideColumnsByEnum.get(id) ?? 0,
    })),
  });
  const replaced = tableMatching.replaced;
  const replacedProblems: TextProblem[] =
    replaced === null
      ? []
      : [
          lineProblem(
            raw.tables[replaced.added[0] ?? 0]?.line ?? 1,
            'replaced',
            `${replaced.removed.map((i) => scopeNodes[i]?.title ?? '').join(', ')} ${replaced.removed.length === 1 ? 'was' : 'were'} replaced; Undo to restore`,
            'warning',
          ),
        ];
  const problems = [...planProblems, ...replacedProblems, ...warnings];
  if (hasErrors(problems)) return { plan: emptyPlan(), problems };

  plan.isEmpty =
    plan.addTables.length === 0 &&
    plan.updateTables.length === 0 &&
    plan.tableOps.length === 0 &&
    plan.removeTables.length === 0 &&
    enumOps.adds.length === 0 &&
    enumOps.updates.length === 0 &&
    enumOps.removes.length === 0 &&
    plan.relationshipOps.adds.length === 0 &&
    plan.relationshipOps.updates.length === 0 &&
    plan.relationshipOps.removes.length === 0;
  return { plan, problems };
}

// -------------------------------------------------------------------------------------------------

function collectIds(deck: SododeckFile): Set<Id> {
  const ids = new Set<Id>();
  for (const node of deck.nodes) {
    ids.add(node.id);
    for (const c of node.columns ?? []) ids.add(c.id);
    for (const i of node.indexes ?? []) ids.add(i.id);
    for (const c of node.checks ?? []) ids.add(c.id);
  }
  for (const e of deck.enums ?? []) {
    ids.add(e.id);
    for (const v of e.values) ids.add(v.id);
  }
  for (const e of deck.edges) ids.add(e.id);
  return ids;
}

/** A remembered table can come back with its ids only when none of them is in use again. */
function idsFree(taken: ReadonlySet<Id>, node: Node): boolean {
  const own = [
    node.id,
    ...(node.columns ?? []).map((c) => c.id),
    ...(node.indexes ?? []).map((i) => i.id),
    ...(node.checks ?? []).map((c) => c.id),
  ];
  return own.every((id) => !taken.has(id));
}

/**
 * A remembered table comes back only with references that still resolve: a column naming an enum
 * that is gone would not add (the plan sets it again), and a group or parent that is gone is left.
 */
function stripStaleRefs(node: Node, enums: ReadonlyMap<Id, DbEnum>, deck: SododeckFile): Node {
  const { group, parent, ...rest } = node;
  const keepGroup = group !== undefined && deck.groups.some((g) => g.id === group);
  const keepParent = parent !== undefined && deck.nodes.some((n) => n.id === parent);
  return {
    ...rest,
    ...(keepGroup ? { group } : {}),
    ...(keepParent ? { parent } : {}),
    columns: (node.columns ?? []).map((column) => {
      if (column.enumRef === undefined || enums.has(column.enumRef)) return column;
      const { enumRef: _gone, ...rest } = column;
      return rest;
    }),
  };
}

function diffEnum(
  found: DbEnum,
  planned: {
    planId: Id;
    name: string;
    schema?: string;
    note?: string;
    values?: { name: string; note?: string }[];
  },
  ctx: SyncContext,
): EnumOps['updates'][number] | undefined {
  const patch: EnumOps['updates'][number]['patch'] = {};
  if (found.name !== planned.name) patch.name = planned.name;
  if (schemaName(found.schema) !== schemaName(planned.schema)) {
    patch.schema = schemaName(planned.schema) ?? null;
  }
  if (!same(trimmed(found.note), trimmed(planned.note))) patch.note = trimmed(planned.note) ?? null;
  const parsedValues = planned.values ?? [];
  const matching = matchValues(
    found.values.map((v) => v.name),
    parsedValues.map((v) => v.name),
  );
  const valueUpdates: EnumOps['updates'][number]['valueUpdates'] = [];
  const matchedTo = new Map(matching.pairs.map((m) => [m.parsed, m.existing]));
  const valueAdds: EnumOps['updates'][number]['valueAdds'] = [];
  const finalOrder: Id[] = [];
  parsedValues.forEach((value, i) => {
    const at = matchedTo.get(i);
    const kept = at === undefined ? undefined : found.values[at];
    if (kept === undefined) {
      const id = ctx.newId('enumval');
      valueAdds.push({
        value: {
          id,
          name: value.name,
          ...(trimmed(value.note) === undefined ? {} : { note: trimmed(value.note) ?? '' }),
        },
        index: i,
      });
      finalOrder.push(id);
      return;
    }
    finalOrder.push(kept.id);
    const valuePatch: { name?: string; note?: string | null } = {};
    if (kept.name !== value.name) valuePatch.name = value.name;
    if (!same(trimmed(kept.note), trimmed(value.note))) {
      valuePatch.note = trimmed(value.note) ?? null;
    }
    if (Object.keys(valuePatch).length > 0) valueUpdates.push({ id: kept.id, patch: valuePatch });
  });
  const valueRemoves = matching.removed.flatMap((i) => found.values[i]?.id ?? []);
  const addedIds = new Set(valueAdds.map((a) => a.value.id));
  const valueOrder = needsOrder(found.values, matching, finalOrder, (id) => addedIds.has(id))
    ? finalOrder
    : [];
  if (
    Object.keys(patch).length === 0 &&
    valueAdds.length === 0 &&
    valueUpdates.length === 0 &&
    valueRemoves.length === 0 &&
    valueOrder.length === 0
  ) {
    return undefined;
  }
  return { id: found.id, patch, valueAdds, valueUpdates, valueOrder, valueRemoves };
}

function diffTable(existing: NormalDeckTable, raw: RawTable): TablePatch | undefined {
  const patch: TablePatch = {};
  if (existing.title !== raw.name) patch.title = raw.name;
  if (existing.schema !== schemaName(raw.schema)) patch.schema = schemaName(raw.schema) ?? null;
  if (!same(existing.note, trimmed(raw.note))) patch.description = trimmed(raw.note) ?? null;
  return Object.keys(patch).length === 0 ? undefined : patch;
}

/** The patch that makes `deckColumn` the mapped column `wanted`, or undefined when equal. */
function diffColumn(
  deckColumn: DbColumn,
  wanted: DbColumn,
  keepsEnum: boolean,
): ColumnPatch | undefined {
  const patch: ColumnPatch = {};
  if (deckColumn.name !== wanted.name) patch.name = wanted.name;
  if (keepsEnum) {
    // The enum is not in the text (it has no values); the column's own enum link stays.
  } else if (wanted.enumRef !== undefined) {
    if (deckColumn.enumRef !== wanted.enumRef) patch.enumRef = wanted.enumRef;
    if (deckColumn.type !== wanted.type) patch.type = wanted.type;
  } else {
    if (deckColumn.enumRef !== undefined) patch.enumRef = null;
    if (lc(deckColumn.type) !== lc(wanted.type)) patch.type = wanted.type;
  }
  if (wanted.enumRef === undefined && !keepsEnum) {
    if (compactSize(deckColumn.size) !== compactSize(wanted.size)) {
      patch.size = compactSize(wanted.size) ?? null;
    }
  } else if (wanted.enumRef !== undefined && deckColumn.size !== undefined) {
    patch.size = null;
  }
  if (flag(deckColumn.pk) !== flag(wanted.pk)) patch.pk = flag(wanted.pk) ? true : null;
  if (flag(deckColumn.notNull) !== flag(wanted.notNull)) {
    patch.notNull = flag(wanted.notNull) ? true : null;
  }
  if (flag(deckColumn.unique) !== flag(wanted.unique)) {
    patch.unique = flag(wanted.unique) ? true : null;
  }
  if (flag(deckColumn.increment) !== flag(wanted.increment)) {
    patch.increment = flag(wanted.increment) ? true : null;
  }
  if (!Object.is(deckColumn.default, wanted.default)) patch.default = wanted.default ?? null;
  if (trimmed(deckColumn.defaultExpr) !== trimmed(wanted.defaultExpr)) {
    patch.defaultExpr = trimmed(wanted.defaultExpr) ?? null;
  }
  if (!same(trimmed(deckColumn.note), trimmed(wanted.note))) {
    patch.note = trimmed(wanted.note) ?? null;
  }
  return Object.keys(patch).length === 0 ? undefined : patch;
}

function diffParts(
  table: Resolved,
  finalColumns: readonly DbColumn[],
  finalIndexes: readonly DbIndex[],
  enumById: ReadonlyMap<Id, DbEnum>,
  writtenEnums: ReadonlySet<Id>,
  matchedEnumIds: ReadonlySet<Id>,
): TableOps | undefined {
  const { existing, columnMatching } = table;
  if (existing === undefined || columnMatching === undefined) return undefined;
  const ops: TableOps = {
    tableId: existing.node.id,
    columns: emptyOps<DbColumn, ColumnPatch>(),
    indexes: emptyOps<DbIndex, IndexPatch>(),
    checks: emptyOps<DbCheck, CheckPatch>(),
  };

  // columns
  const matchedTo = new Map(columnMatching.pairs.map((m) => [m.parsed, m.existing]));
  const finalOrder: Id[] = [];
  finalColumns.forEach((column, i) => {
    const at = matchedTo.get(i);
    const kept = at === undefined ? undefined : existing.columns[at];
    finalOrder.push(column.id);
    if (kept === undefined) {
      ops.columns.adds.push({ item: column, index: i });
      return;
    }
    // A column naming an enum the text does not write (an empty one) keeps its link.
    const keeps =
      column.enumRef === undefined &&
      kept.enumRef !== undefined &&
      !writtenEnums.has(kept.enumRef) &&
      !matchedEnumIds.has(kept.enumRef) &&
      lc(enumById.get(kept.enumRef)?.name ?? '') === lc(column.type);
    const patch = diffColumn(kept, column, keeps);
    if (patch !== undefined) ops.columns.updates.push({ id: kept.id, patch });
  });
  ops.columns.removes = columnMatching.removed.flatMap((i) => existing.columns[i]?.id ?? []);
  const addedColumns = new Set(ops.columns.adds.map((a) => a.item.id));
  if (needsOrder(existing.columns, columnMatching, finalOrder, (id) => addedColumns.has(id))) {
    ops.columns.order = finalOrder;
  }

  // checks: the text holds table checks only, so a column's check is matched there too
  const parsedChecks = table.planned.checks ?? [];
  const checkMatching = matchChecks(
    existing.checks.map((c) => ({
      ...(c.name === undefined ? {} : { name: c.name }),
      expr: c.expr,
    })),
    parsedChecks.map((c) => ({ ...(c.name === undefined ? {} : { name: c.name }), expr: c.expr })),
  );
  const checkOf = new Map(checkMatching.pairs.map((m) => [m.parsed, m.existing]));
  const checkOrder: Id[] = [];
  parsedChecks.forEach((check, i) => {
    const at = checkOf.get(i);
    const kept = at === undefined ? undefined : existing.checks[at];
    if (kept === undefined || kept.origin?.kind !== 'check') {
      if (kept === undefined) {
        ops.checks.adds.push({ item: check, index: i });
        checkOrder.push(check.id);
      }
      return;
    }
    checkOrder.push(kept.origin.id);
    const patch: { name?: string | null; expr?: string } = {};
    if (!same(kept.name, check.name)) patch.name = check.name ?? null;
    if (kept.expr !== check.expr) patch.expr = check.expr;
    if (Object.keys(patch).length > 0) ops.checks.updates.push({ id: kept.origin.id, patch });
  });
  for (const i of checkMatching.removed) {
    const gone = existing.checks[i];
    if (gone?.origin === undefined) continue;
    if (gone.origin.kind === 'check') ops.checks.removes.push(gone.origin.id);
    else ops.columns.updates.push({ id: gone.origin.id, patch: { check: null } });
  }

  // indexes
  const sigOfDeck = (index: DbIndex) => signatureOf(index.columns);
  const indexMatching = matchIndexes(
    existing.indexes.map((x) => ({
      ...(x.name === undefined || x.name === '' ? {} : { name: x.name }),
      signature: sigOfDeck(x),
    })),
    finalIndexes.map((x) => ({
      ...(x.name === undefined || x.name === '' ? {} : { name: x.name }),
      signature: signatureOf(x.columns),
    })),
  );
  const indexOf = new Map(indexMatching.pairs.map((m) => [m.parsed, m.existing]));
  const indexOrder: Id[] = [];
  finalIndexes.forEach((index, i) => {
    const at = indexOf.get(i);
    const kept = at === undefined ? undefined : existing.indexes[at];
    if (kept === undefined) {
      ops.indexes.adds.push({ item: index, index: i });
      indexOrder.push(index.id);
      return;
    }
    indexOrder.push(kept.id);
    const patch: TableOps['indexes']['updates'][number]['patch'] = {};
    if (!same(trimmed(kept.name), trimmed(index.name))) patch.name = trimmed(index.name) ?? null;
    if (!partsEqual(kept.columns, index.columns)) patch.columns = index.columns;
    if (flag(kept.unique) !== flag(index.unique)) patch.unique = flag(index.unique) ? true : null;
    if (!same(kept.method, trimmed(index.method)?.toLowerCase())) {
      patch.method = trimmed(index.method)?.toLowerCase() ?? null;
    }
    if (!same(trimmed(kept.note), trimmed(index.note))) patch.note = trimmed(index.note) ?? null;
    if (Object.keys(patch).length > 0) ops.indexes.updates.push({ id: kept.id, patch });
  });
  ops.indexes.removes = indexMatching.removed.flatMap((i) => existing.indexes[i]?.id ?? []);
  const addedIndexes = new Set(ops.indexes.adds.map((a) => a.item.id));
  if (needsOrder(existing.indexes, indexMatching, indexOrder, (id) => addedIndexes.has(id))) {
    ops.indexes.order = indexOrder;
  }
  const addedChecks = new Set(ops.checks.adds.map((a) => a.item.id));
  const keptChecks = existing.checks.filter((c) => c.origin?.kind === 'check');
  const checkMatchingKept: Matching = {
    pairs: checkMatching.pairs.flatMap((m) => {
      const at = existing.checks[m.existing];
      const idx = at === undefined ? -1 : keptChecks.indexOf(at);
      return idx < 0 ? [] : [{ ...m, existing: idx }];
    }),
    added: [],
    removed: [],
  };
  const plainChecks = (existing.node.checks ?? []).map((c) => ({ id: c.id }));
  if (needsOrder(plainChecks, checkMatchingKept, checkOrder, (id) => addedChecks.has(id))) {
    ops.checks.order = checkOrder;
  }

  return isEmptyOps(ops.columns) && isEmptyOps(ops.indexes) && isEmptyOps(ops.checks)
    ? undefined
    : ops;
}

// --- relationships -------------------------------------------------------------------------------

interface PoolEntry {
  edge: Edge;
  /** Effective ends; null when the writer leaves it out. */
  ends: { from: Id; fromColumns: Id[]; to: Id; toColumns: Id[] } | null;
  /** Both ends in the text's scope: the text is where it lives, so it can be removed there. */
  removable: boolean;
  remembered: boolean;
}

const sigOf = (e: { from: Id; fromColumns: readonly Id[]; to: Id; toColumns: readonly Id[] }) =>
  `${e.from}|${e.fromColumns.join(',')}>${e.to}|${e.toColumns.join(',')}`;

function planRelationships(
  deck: SododeckFile,
  refs: readonly RawRef[],
  ends: ReadonlyMap<string, EndInfo>,
  resolved: readonly Resolved[],
  scopeIds: ReadonlySet<Id>,
  removedTables: ReadonlySet<Id>,
  ctx: SyncContext,
  plan: SchemaPlan,
): void {
  const nodes = new Map(deck.nodes.map((n) => [n.id, n]));
  const keyOfTable = (id: Id): Id[] =>
    (nodes.get(id)?.columns ?? []).filter((c) => c.pk === true).map((c) => c.id);
  const columnIdsOf = (id: Id) => new Set((nodes.get(id)?.columns ?? []).map((c) => c.id));

  const effective = (edge: Edge): PoolEntry['ends'] => {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (from === undefined || to === undefined || !isDbTable(from) || !isDbTable(to)) return null;
    const n2n = edge.cardinality === 'n-n';
    let fromColumns = edge.fromColumns ?? [];
    let toColumns = edge.toColumns ?? [];
    if (n2n && fromColumns.length === 0) fromColumns = keyOfTable(edge.from);
    if (n2n && toColumns.length === 0) toColumns = keyOfTable(edge.to);
    const known = [columnIdsOf(edge.from), columnIdsOf(edge.to)] as const;
    if (fromColumns.some((c) => !known[0].has(c)) || toColumns.some((c) => !known[1].has(c))) {
      return null;
    }
    if (fromColumns.length === 0 || toColumns.length === 0) return null;
    if (!n2n && fromColumns.length !== toColumns.length) return null;
    if (edge.from === edge.to && fromColumns.join() === toColumns.join()) return null;
    return {
      from: edge.from,
      fromColumns: [...fromColumns],
      to: edge.to,
      toColumns: [...toColumns],
    };
  };

  const pool: PoolEntry[] = [];
  for (const edge of deck.edges) {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (from === undefined || to === undefined || !isDbTable(from) || !isDbTable(to)) continue;
    const inFrom = scopeIds.has(edge.from);
    const inTo = scopeIds.has(edge.to);
    if (!inFrom && !inTo) continue;
    const e = effective(edge);
    pool.push({ edge, ends: e, removable: inFrom && inTo && e !== null, remembered: false });
  }
  const restoredEdges = resolved.flatMap((t) => (t.restored === undefined ? [] : t.restored.edges));
  const seen = new Set(deck.edges.map((e) => e.id));
  for (const edge of restoredEdges) {
    if (seen.has(edge.id)) continue;
    seen.add(edge.id);
    const fromId = edge.from;
    const toId = edge.to;
    const known = (id: Id) => nodes.has(id) || resolved.some((t) => t.id === id);
    if (!known(fromId) || !known(toId)) continue;
    const e = restoredEffective(edge, resolved, keyOfTable);
    pool.push({ edge, ends: e, removable: false, remembered: true });
  }

  interface ParsedRel {
    rel: NewRelationship;
    ends: { from: Id; fromColumns: Id[]; to: Id; toColumns: Id[] };
    plain: boolean;
  }
  const parsed: ParsedRel[] = [];
  for (const ref of refs) {
    const from = ends.get(nameKeyOf(ref.from.name, ref.from.schema));
    const to = ends.get(nameKeyOf(ref.to.name, ref.to.schema));
    if (from === undefined || to === undefined) continue;
    const fromColumns = ref.from.columns.flatMap((c) => from.columnByName.get(lc(c)) ?? []);
    const toColumns =
      ref.to.columns.length > 0
        ? ref.to.columns.flatMap((c) => to.columnByName.get(lc(c)) ?? [])
        : [...to.key];
    if (fromColumns.length === 0 || toColumns.length === 0) continue;
    const cardinality: Cardinality = ref.cardinality ?? 'n-1';
    const plain =
      cardinality === 'n-n' &&
      fromColumns.length === 1 &&
      fromColumns.join() === from.key.join() &&
      toColumns.join() === to.key.join();
    parsed.push({
      ends: { from: from.id, fromColumns, to: to.id, toColumns },
      plain,
      rel: {
        id: ctx.newId('edge'),
        from: from.id,
        to: to.id,
        fromColumns: plain ? [] : fromColumns,
        toColumns: plain ? [] : toColumns,
        ...(ref.name === undefined || ref.name === '' ? {} : { name: ref.name }),
        cardinality,
        ...(ref.fromOptional === true ? { fromOptional: true } : {}),
        ...(ref.toOptional === true ? { toOptional: true } : {}),
        ...(ref.onDelete === undefined ? {} : { onDelete: ref.onDelete }),
        ...(ref.onUpdate === undefined ? {} : { onUpdate: ref.onUpdate }),
      },
    });
  }

  const poolWritten = pool.filter((entry) => entry.ends !== null);
  const matching = matchRelationships(
    poolWritten.map((entry) => ({
      ...(trimmed(entry.edge.label) === undefined ? {} : { name: trimmed(entry.edge.label) ?? '' }),
      signature: entry.ends === null ? '' : sigOf(entry.ends),
    })),
    parsed.map((p) => ({
      ...(p.rel.name === undefined ? {} : { name: p.rel.name }),
      signature: sigOf(p.ends),
    })),
  );
  const poolOf = new Map(matching.pairs.map((m) => [m.parsed, m]));
  parsed.forEach((p, i) => {
    const pair = poolOf.get(i);
    const entry = pair === undefined ? undefined : poolWritten[pair.existing];
    if (entry === undefined || pair === undefined) {
      plan.relationshipOps.adds.push(p.rel);
      return;
    }
    if (entry.remembered) {
      plan.relationshipOps.adds.push({ ...p.rel, id: entry.edge.id, base: entry.edge });
      return;
    }
    const patch = diffRelationship(entry, p.ends, p.plain, p.rel, pair.how === 'rename');
    if (patch !== undefined) plan.relationshipOps.updates.push({ id: entry.edge.id, patch });
  });
  for (const i of matching.removed) {
    const entry = poolWritten[i];
    if (entry === undefined || !entry.removable || entry.remembered) continue;
    // A table that goes takes its relationships with it.
    if (removedTables.has(entry.edge.from) || removedTables.has(entry.edge.to)) continue;
    plan.relationshipOps.removes.push(entry.edge.id);
  }
}

function restoredEffective(
  edge: Edge,
  resolved: readonly Resolved[],
  keyOfTable: (id: Id) => Id[],
): PoolEntry['ends'] {
  const key = (id: Id) => {
    const table = resolved.find((t) => t.id === id);
    return table === undefined
      ? keyOfTable(id)
      : (table.existing?.node.columns ?? []).filter((c) => c.pk === true).map((c) => c.id);
  };
  const n2n = edge.cardinality === 'n-n';
  const fromColumns = edge.fromColumns ?? (n2n ? key(edge.from) : []);
  const toColumns = edge.toColumns ?? (n2n ? key(edge.to) : []);
  if (fromColumns.length === 0 || toColumns.length === 0) return null;
  return { from: edge.from, fromColumns: [...fromColumns], to: edge.to, toColumns: [...toColumns] };
}

function diffRelationship(
  entry: PoolEntry,
  ends: { from: Id; fromColumns: Id[]; to: Id; toColumns: Id[] },
  plain: boolean,
  wanted: NewRelationship,
  renamed: boolean,
): RelationshipPatch | undefined {
  const edge = entry.edge;
  const patch: RelationshipPatch = {};
  if (!same(trimmed(edge.label), wanted.name)) patch.name = wanted.name ?? null;
  if ((edge.cardinality ?? 'n-1') !== wanted.cardinality) patch.cardinality = wanted.cardinality;
  if (flag(edge.fromOptional) !== flag(wanted.fromOptional)) {
    patch.fromOptional = flag(wanted.fromOptional) ? true : null;
  }
  if (flag(edge.toOptional) !== flag(wanted.toOptional)) {
    patch.toOptional = flag(wanted.toOptional) ? true : null;
  }
  if (edge.onDelete !== wanted.onDelete) patch.onDelete = wanted.onDelete ?? null;
  if (edge.onUpdate !== wanted.onUpdate) patch.onUpdate = wanted.onUpdate ?? null;
  if (renamed && entry.ends !== null && sigOf(entry.ends) !== sigOf(ends)) {
    patch.from = ends.from;
    patch.to = ends.to;
    patch.fromColumns = plain ? null : ends.fromColumns;
    patch.toColumns = plain ? null : ends.toColumns;
  }
  return Object.keys(patch).length === 0 ? undefined : patch;
}
