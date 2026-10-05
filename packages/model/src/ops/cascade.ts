/**
 * Delete with cascade (data-model "References and delete cascade", spec FR-011–017).
 * Structural objects that cannot exist without their target are removed (edges of a node, steps
 * of a flow); knowledge objects (steps, stickies) are kept and reported broken; groups re-parent
 * their contents and take their own edges with them (050: a connector end may be a group). Each delete with its whole cascade is one transaction: one change, one undo step.
 *
 * Database parts (040, research R9): removing a column drops it from its table's index parts (an
 * index left empty goes too) and from relationships: an end of one column removes the edge, a
 * composite end loses the pair at that position on both ends (the edge goes when none is left);
 * a self-reference checks both ends. Removing an enum clears `enumRef` on every column naming it
 * (the column keeps its `type`). Removing an index, a check or an enum value changes nothing else.
 *
 * Step touches (049): removing a table drops every touch naming it, removing a column the touches
 * naming that column. The steps are kept, updated and never reported broken.
 */
import type { Id } from '@sododeck/schema';
import * as Y from 'yjs';

import { fromY, toY, type YObject } from '../convert';
import { toJSON } from '../deck';
import { nodeCanvasPosition, STICKY_DEFAULT_OFFSET } from '../geometry';
import {
  childList,
  collectionMap,
  enumsList,
  orderedEntries,
  rulesMap,
  type Collection,
  type DeckDoc,
  type ListMap,
  type ObjectRef,
} from '../layout';
import { requireEntry, type EditContext } from './context';
import { DeckEditError } from '../errors';
import { checkIntegrity, type IntegrityProblem } from '../integrity';
import { LABELS } from './collections';
import { branchListOf } from './branches';
import { requireEnum, requireEnumValue } from './db-enums';
import { requirePart, requireTable } from './db-tables';
import { assertUnlocked } from './node-lock';
import { stepsOf } from './steps';

export interface RemovalResult {
  /** The deleted object first, then everything deleted with it. */
  removed: ObjectRef[];
  /** Objects whose references were cleared or re-pointed. */
  updated: ObjectRef[];
  /** Stickies that lost a deleted node anchor and became free at the same canvas point. */
  freed: readonly Id[];
  /** Kept objects whose reference to a removed object is now broken (steps, stickies). */
  broken: IntegrityProblem[];
}

/** Collects the edits of one cascade, then applies them in one transaction. */
class Cascade {
  readonly removed: ObjectRef[] = [];
  readonly updated: ObjectRef[] = [];
  readonly freed: Id[] = [];
  private readonly writes: (() => void)[] = [];

  constructor(private readonly ctx: EditContext) {}

  remove(ref: ObjectRef, write: () => void): void {
    this.removed.push(ref);
    this.writes.push(write);
  }

  update(ref: ObjectRef, write: () => void): void {
    this.updated.push(ref);
    this.writes.push(write);
  }

  freeSticky(id: Id): void {
    this.freed.push(id);
  }

  commit(): RemovalResult {
    this.ctx.transact(() => {
      for (const write of this.writes) write();
    });
    const removedIds = new Set(this.removed.map((ref) => ref.child?.id ?? ref.id));
    return {
      removed: this.removed,
      updated: this.updated,
      freed: [...new Set(this.freed)],
      broken: checkIntegrity(toJSON(this.ctx.doc)).filter((p) => removedIds.has(p.target)),
    };
  }
}

/** Deletes the item with `id` from its list at write time. */
function deleteById(list: ListMap, id: Id): () => void {
  return () => {
    list.delete(id);
  };
}

/** A collection's items in list order, so results list objects in the order they are shown. */
const entriesOf = (doc: DeckDoc, c: Collection) => orderedEntries(collectionMap(doc, c));

function listHas(map: YObject, field: string, id: Id): boolean {
  const list = map.get(field);
  return list instanceof Y.Array && list.toArray().includes(id);
}

/** Removes every occurrence of `id` from a Y.Array field; drops the field when `dropEmpty`. */
function removeFromList(map: YObject, field: string, id: Id, dropEmpty: boolean): void {
  const list = map.get(field);
  if (!(list instanceof Y.Array)) return;
  for (let i = list.length - 1; i >= 0; i--) if (list.get(i) === id) list.delete(i, 1);
  if (dropEmpty && list.length === 0) map.delete(field);
}

function forEachStep(doc: DeckDoc, visit: (step: YObject, flowId: Id, stepId: Id) => void): void {
  for (const [flowId, flow] of entriesOf(doc, 'flows')) {
    const steps = childList(flow, 'steps');
    if (steps === undefined) continue;
    for (const [stepId, step] of orderedEntries(steps)) visit(step, flowId, stepId);
  }
}

const stepRef = (flowId: Id, stepId: Id): ObjectRef => ({
  scope: 'flows',
  id: flowId,
  child: { kind: 'step', id: stepId },
});

/**
 * Drops the step touches `match` selects (049): a removed table takes its table and column
 * touches, a removed column its own. The steps stay and are not broken: a touch is optional.
 */
function dropTouches(
  cascade: Cascade,
  doc: DeckDoc,
  match: (touch: Record<string, unknown>) => boolean,
): void {
  const matches = (item: unknown) => {
    const touch = fromY(item);
    return touch !== null && typeof touch === 'object' && match(touch as Record<string, unknown>);
  };
  forEachStep(doc, (step, flowId, stepId) => {
    const list = step.get('touches');
    if (!(list instanceof Y.Array) || !list.toArray().some(matches)) return;
    cascade.update(stepRef(flowId, stepId), () => {
      for (let i = list.length - 1; i >= 0; i--) if (matches(list.get(i))) list.delete(i, 1);
      if (list.length === 0) step.delete('touches');
    });
  });
}

/** Removes every edge with an end at `id` (a node, a group since 050, a sticky since 053). */
function removeEdgesAt(cascade: Cascade, doc: DeckDoc, id: Id): void {
  const edges = collectionMap(doc, 'edges');
  for (const [edgeId, edge] of entriesOf(doc, 'edges')) {
    if (edge.get('from') === id || edge.get('to') === id) {
      cascade.remove({ scope: 'edges', id: edgeId }, deleteById(edges, edgeId));
    }
  }
}

function removeNode(cascade: Cascade, doc: DeckDoc, id: Id): void {
  const file = toJSON(doc);
  const base = nodeCanvasPosition(file, id);
  removeEdgesAt(cascade, doc, id);
  dropTouches(cascade, doc, (touch) => touch.table === id);
  for (const [nodeId, node] of entriesOf(doc, 'nodes')) {
    if (node.get('parent') === id && nodeId !== id) {
      cascade.update({ scope: 'nodes', id: nodeId }, () => {
        node.delete('parent');
      });
    }
  }
  for (const [viewId, view] of entriesOf(doc, 'views')) {
    const positions = view.get('positions');
    const inPositions = positions instanceof Y.Map && positions.has(id);
    if (listHas(view, 'includes', id) || listHas(view, 'pinned', id) || inPositions) {
      cascade.update({ scope: 'views', id: viewId }, () => {
        removeFromList(view, 'includes', id, false);
        removeFromList(view, 'pinned', id, true);
        if (inPositions) positions.delete(id);
      });
    }
  }
  if (base === null) return;
  for (const [stickyId, sticky] of entriesOf(doc, 'stickies')) {
    if (sticky.get('anchor') !== id) continue;
    const position = sticky.get('position');
    const x =
      position instanceof Y.Map && typeof position.get('x') === 'number'
        ? (position.get('x') as number)
        : STICKY_DEFAULT_OFFSET.x;
    const y =
      position instanceof Y.Map && typeof position.get('y') === 'number'
        ? (position.get('y') as number)
        : STICKY_DEFAULT_OFFSET.y;
    cascade.update({ scope: 'stickies', id: stickyId }, () => {
      sticky.set('position', toY({ x: base.x + x, y: base.y + y }));
      sticky.delete('anchor');
    });
    cascade.freeSticky(stickyId);
  }
}

function removeGroup(cascade: Cascade, doc: DeckDoc, id: Id, group: YObject): void {
  // Connectors to the group go with it, as a card's do (050, FR-022); its members stay.
  removeEdgesAt(cascade, doc, id);
  const parent = group.get('parent');
  const repoint = (map: YObject, field: string) => () => {
    if (typeof parent === 'string') map.set(field, parent);
    else map.delete(field);
  };
  for (const [nodeId, node] of entriesOf(doc, 'nodes')) {
    if (node.get('group') === id)
      cascade.update({ scope: 'nodes', id: nodeId }, repoint(node, 'group'));
  }
  for (const [childId, child] of entriesOf(doc, 'groups')) {
    if (child.get('parent') === id) {
      cascade.update({ scope: 'groups', id: childId }, repoint(child, 'parent'));
    }
  }
  // Per-view lists (011) and frames (016): undo of the delete restores them with the group.
  for (const [viewId, view] of entriesOf(doc, 'views')) {
    const frames = view.get('groupFrames');
    const framed = frames instanceof Y.Map && frames.has(id);
    if (listHas(view, 'excludeGroups', id) || listHas(view, 'collapsed', id) || framed) {
      cascade.update({ scope: 'views', id: viewId }, () => {
        removeFromList(view, 'excludeGroups', id, true);
        removeFromList(view, 'collapsed', id, true);
        if (!framed) return;
        frames.delete(id);
        if (frames.size === 0) view.delete('groupFrames');
      });
    }
  }
}

function removeFeature(cascade: Cascade, doc: DeckDoc, id: Id): void {
  for (const c of ['views', 'flows'] as const) {
    for (const [objectId, map] of entriesOf(doc, c)) {
      if (map.get('feature') === id) {
        cascade.update({ scope: c, id: objectId }, () => {
          map.delete('feature');
        });
      }
    }
  }
}

/** Removes an object of a collection with its cascade. */
export function removeObject(ctx: EditContext, c: Collection, id: Id): RemovalResult {
  const { doc } = ctx;
  const list = collectionMap(doc, c);
  const map = requireEntry(list, id, LABELS[c]);
  // Only a direct delete is refused: a connector whose end is deleted goes with it (053).
  if (c === 'stickies' || c === 'edges') {
    assertUnlocked(map, LABELS[c] === 'Edge' ? 'Connector' : LABELS[c], id, 'delete it');
  }
  const cascade = new Cascade(ctx);
  cascade.remove({ scope: c, id }, deleteById(list, id));
  switch (c) {
    case 'nodes':
      removeNode(cascade, doc, id);
      break;
    case 'groups':
      removeGroup(cascade, doc, id, map);
      break;
    case 'features':
      removeFeature(cascade, doc, id);
      break;
    case 'flows': {
      // Owned steps and branches: deleted with the flow's map, listed so surfaces know.
      for (const [field, kind] of [
        ['steps', 'step'],
        ['branches', 'branch'],
      ] as const) {
        const children = childList(map, field);
        if (children === undefined) continue;
        for (const [childId] of orderedEntries(children)) {
          cascade.remove({ scope: 'flows', id, child: { kind, id: childId } }, () => undefined);
        }
      }
      break;
    }
    case 'stickies':
      // Connectors that end on the note go with it (053), like a card's; stickies anchored to the
      // note are kept and reported (FR-017).
      removeEdgesAt(cascade, doc, id);
      break;
    case 'edges':
    case 'views':
      // Steps on an edge and stickies on anything are kept and reported (FR-012, FR-017).
      break;
  }
  return cascade.commit();
}

export function removeStep(ctx: EditContext, flowId: Id, stepId: Id): RemovalResult {
  const steps = stepsOf(ctx, flowId);
  requireEntry(steps, stepId, 'Step');
  const cascade = new Cascade(ctx);
  cascade.remove(stepRef(flowId, stepId), deleteById(steps, stepId));
  return cascade.commit();
}

/**
 * Removes a branch and its steps (FR-028, ADR 0008). The other branches stay; the `branches` list
 * stays too (it reads as absent once empty). One transaction, one undo step.
 */
export function removeBranch(ctx: EditContext, flowId: Id, branchId: Id): RemovalResult {
  const branches = branchListOf(ctx, flowId, branchId);
  const steps = stepsOf(ctx, flowId);
  const cascade = new Cascade(ctx);
  cascade.remove(
    { scope: 'flows', id: flowId, child: { kind: 'branch', id: branchId } },
    deleteById(branches, branchId),
  );
  for (const [stepId, step] of orderedEntries(steps)) {
    if (step.get('branch') === branchId) {
      cascade.remove(stepRef(flowId, stepId), deleteById(steps, stepId));
    }
  }
  return cascade.commit();
}

/** Removes a rule: detached from every node and step, its sample inputs dropped (FR-013). */
export function removeRule(ctx: EditContext, id: Id): RemovalResult {
  const { doc } = ctx;
  const rules = rulesMap(doc);
  if (!rules.has(id)) {
    throw new DeckEditError('not-found', [{ path: '', message: `Rule "${id}" does not exist.` }]);
  }
  const cascade = new Cascade(ctx);
  cascade.remove({ scope: 'rules', id }, () => {
    rules.delete(id);
  });
  for (const [nodeId, node] of entriesOf(doc, 'nodes')) {
    if (listHas(node, 'rules', id)) {
      cascade.update({ scope: 'nodes', id: nodeId }, () => {
        removeFromList(node, 'rules', id, true);
      });
    }
  }
  forEachStep(doc, (step, flowId, stepId) => {
    const inputs = step.get('ruleInputs');
    const hasInputs = inputs instanceof Y.Map && inputs.has(id);
    if (!listHas(step, 'rules', id) && !hasInputs) return;
    cascade.update(stepRef(flowId, stepId), () => {
      removeFromList(step, 'rules', id, true);
      if (hasInputs) {
        inputs.delete(id);
        if (inputs.size === 0) step.delete('ruleInputs');
      }
    });
  });
  return cascade.commit();
}

/** Removes a rule column and its cells; an input column also loses its sample inputs (FR-018). */
export function removeRuleColumn(
  ctx: EditContext,
  rule: YObject,
  ruleId: Id,
  side: 'inputs' | 'outputs',
  columnId: Id,
): RemovalResult {
  const columns = childList(rule, side);
  if (columns === undefined) throw new TypeError(`Rule "${ruleId}" has no "${side}" list.`);
  requireEntry(columns, columnId, 'Column');
  const rows = childList(rule, 'rows');
  const cascade = new Cascade(ctx);
  cascade.remove({ scope: 'rules', id: ruleId, child: { kind: 'column', id: columnId } }, () => {
    columns.delete(columnId);
    for (const row of rows?.values() ?? []) {
      const cells = row.get('cells');
      if (cells instanceof Y.Map && cells.has(columnId)) cells.delete(columnId);
    }
  });
  if (side === 'inputs') {
    forEachStep(ctx.doc, (step, flowId, stepId) => {
      const inputs = step.get('ruleInputs');
      const values = inputs instanceof Y.Map ? inputs.get(ruleId) : undefined;
      if (values instanceof Y.Map && values.has(columnId)) {
        cascade.update(stepRef(flowId, stepId), () => {
          values.delete(columnId);
        });
      }
    });
  }
  return cascade.commit();
}

const tablePart = (tableId: Id, kind: 'column' | 'index' | 'check', id: Id): ObjectRef => ({
  scope: 'nodes',
  id: tableId,
  child: { kind, id },
});

/** A stored list value (index parts, column ends) as plain items. */
const idsOf = (value: unknown): unknown[] => {
  const plain = fromY(value);
  return Array.isArray(plain) ? plain : [];
};

/** Removes a column of a table with its index parts and relationship ends (R9). */
export function removeColumn(ctx: EditContext, tableId: Id, columnId: Id): RemovalResult {
  const { doc } = ctx;
  const node = requireTable(ctx, tableId);
  requirePart(node, tableId, 'columns', columnId);
  const cascade = new Cascade(ctx);
  const columns = childList(node, 'columns');
  if (columns !== undefined) {
    cascade.remove(tablePart(tableId, 'column', columnId), deleteById(columns, columnId));
  }
  const indexes = childList(node, 'indexes');
  for (const [indexId, index] of indexes === undefined ? [] : orderedEntries(indexes)) {
    const parts = idsOf(index.get('columns'));
    if (!parts.includes(columnId)) continue;
    const kept = parts.filter((part) => part !== columnId);
    if (kept.length === 0 && indexes !== undefined) {
      cascade.remove(tablePart(tableId, 'index', indexId), deleteById(indexes, indexId));
    } else {
      cascade.update(tablePart(tableId, 'index', indexId), () => {
        index.set('columns', toY(kept));
      });
    }
  }
  const edges = collectionMap(doc, 'edges');
  for (const [edgeId, edge] of entriesOf(doc, 'edges')) {
    const from = edge.has('fromColumns') ? idsOf(edge.get('fromColumns')) : undefined;
    const to = edge.has('toColumns') ? idsOf(edge.get('toColumns')) : undefined;
    // Positions to drop: the column on either end of this table, paired by position (R9).
    const drop = new Set<number>();
    if (edge.get('from') === tableId) from?.forEach((id, i) => id === columnId && drop.add(i));
    if (edge.get('to') === tableId) to?.forEach((id, i) => id === columnId && drop.add(i));
    if (drop.size === 0) continue;
    const nextFrom = from?.filter((_, i) => !drop.has(i));
    const nextTo = to?.filter((_, i) => !drop.has(i));
    if (nextFrom?.length === 0 || nextTo?.length === 0) {
      cascade.remove({ scope: 'edges', id: edgeId }, deleteById(edges, edgeId));
      continue;
    }
    cascade.update({ scope: 'edges', id: edgeId }, () => {
      if (nextFrom !== undefined) edge.set('fromColumns', toY(nextFrom));
      if (nextTo !== undefined) edge.set('toColumns', toY(nextTo));
    });
  }
  dropTouches(cascade, doc, (touch) => touch.column === columnId);
  return cascade.commit();
}

/** Removes an index or a check of a table; nothing else refers to them. */
export function removeTablePart(
  ctx: EditContext,
  tableId: Id,
  list: 'indexes' | 'checks',
  partId: Id,
): RemovalResult {
  const node = requireTable(ctx, tableId);
  requirePart(node, tableId, list, partId);
  const parts = childList(node, list);
  const cascade = new Cascade(ctx);
  if (parts !== undefined) {
    const kind = list === 'indexes' ? 'index' : 'check';
    cascade.remove(tablePart(tableId, kind, partId), deleteById(parts, partId));
  }
  return cascade.commit();
}

/** Removes an enum and clears `enumRef` on every column naming it, in one step (R9). */
export function removeEnum(ctx: EditContext, enumId: Id): RemovalResult {
  const { doc } = ctx;
  requireEnum(doc, enumId);
  const cascade = new Cascade(ctx);
  cascade.remove({ scope: 'meta', id: '', child: { kind: 'enum', id: enumId } }, () => {
    enumsList(doc)?.delete(enumId);
  });
  for (const [nodeId, node] of entriesOf(doc, 'nodes')) {
    const columns = childList(node, 'columns');
    const naming = [...(columns?.values() ?? [])].filter((c) => c.get('enumRef') === enumId);
    if (naming.length === 0) continue;
    cascade.update({ scope: 'nodes', id: nodeId }, () => {
      for (const column of naming) column.delete('enumRef');
    });
  }
  return cascade.commit();
}

/** Removes one value of an enum; columns name the enum, not its values, so nothing else changes. */
export function removeEnumValue(ctx: EditContext, enumId: Id, valueId: Id): RemovalResult {
  const item = requireEnum(ctx.doc, enumId);
  requireEnumValue(item, enumId, valueId);
  const cascade = new Cascade(ctx);
  cascade.remove({ scope: 'meta', id: enumId, child: { kind: 'enum-value', id: valueId } }, () => {
    childList(item, 'values')?.delete(valueId);
  });
  return cascade.commit();
}
