/**
 * Delete with cascade (data-model "References and delete cascade", spec FR-011–017).
 * Structural objects that cannot exist without their target are removed (edges of a node, steps
 * of a flow); knowledge objects (steps, stickies) are kept and reported broken; groups re-parent
 * their contents. Each delete with its whole cascade is one transaction: one change, one undo step.
 */
import type { Id } from '@sododeck/schema';
import * as Y from 'yjs';

import { toY, type YObject } from '../convert';
import { toJSON } from '../deck';
import { nodeCanvasPosition, STICKY_DEFAULT_OFFSET } from '../geometry';
import {
  childList,
  collectionMap,
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

function removeNode(cascade: Cascade, doc: DeckDoc, id: Id): void {
  const file = toJSON(doc);
  const base = nodeCanvasPosition(file, id);
  const edges = collectionMap(doc, 'edges');
  for (const [edgeId, edge] of entriesOf(doc, 'edges')) {
    if (edge.get('from') === id || edge.get('to') === id) {
      cascade.remove({ scope: 'edges', id: edgeId }, deleteById(edges, edgeId));
    }
  }
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
    case 'edges':
    case 'views':
    case 'stickies':
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
