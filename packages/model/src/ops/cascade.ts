/**
 * Delete with cascade (data-model "References and delete cascade", spec FR-011–017).
 * Structural objects that cannot exist without their target are removed (edges of a node, steps
 * of a flow); knowledge objects (steps, stickies) are kept and reported broken; groups re-parent
 * their contents. Each delete with its whole cascade is one transaction: one change, one undo step.
 */
import type { Id } from '@sododeck/schema';
import * as Y from 'yjs';

import type { YObject } from '../convert';
import { toJSON } from '../deck';
import {
  collectionArray,
  rulesMap,
  type Collection,
  type DeckDoc,
  type ObjectRef,
} from '../layout';
import { findIndexById, type EditContext } from './context';
import { DeckEditError } from '../errors';
import { checkIntegrity, type IntegrityProblem } from '../integrity';
import { LABELS } from './collections';
import { stepsOf } from './steps';

export interface RemovalResult {
  /** The deleted object first, then everything deleted with it. */
  removed: ObjectRef[];
  /** Objects whose references were cleared or re-pointed. */
  updated: ObjectRef[];
  /** Kept objects whose reference to a removed object is now broken (steps, stickies). */
  broken: IntegrityProblem[];
}

/** Collects the edits of one cascade, then applies them in one transaction. */
class Cascade {
  readonly removed: ObjectRef[] = [];
  readonly updated: ObjectRef[] = [];
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

  commit(): RemovalResult {
    this.ctx.transact(() => {
      for (const write of this.writes) write();
    });
    const removedIds = new Set(this.removed.map((ref) => ref.child?.id ?? ref.id));
    return {
      removed: this.removed,
      updated: this.updated,
      broken: checkIntegrity(toJSON(this.ctx.doc)).filter((p) => removedIds.has(p.target)),
    };
  }
}

function idOf(map: YObject): Id {
  const id = map.get('id');
  return typeof id === 'string' ? id : '';
}

/** Deletes the map with `id` from its array at write time (indices shift during a cascade). */
function deleteById(array: Y.Array<YObject>, id: Id): () => void {
  return () => {
    const index = findIndexById(array, id, 'Object');
    array.delete(index, 1);
  };
}

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

function forEachStep(doc: DeckDoc, visit: (step: YObject, flowId: Id) => void): void {
  for (const flow of collectionArray(doc, 'flows')) {
    const steps = flow.get('steps');
    if (steps instanceof Y.Array) {
      for (const step of steps as Y.Array<YObject>) visit(step, idOf(flow));
    }
  }
}

const stepRef = (flowId: Id, stepId: Id): ObjectRef => ({
  scope: 'flows',
  id: flowId,
  child: { kind: 'step', id: stepId },
});

function removeNode(cascade: Cascade, doc: DeckDoc, id: Id): void {
  const edges = collectionArray(doc, 'edges');
  for (const edge of edges) {
    if (edge.get('from') === id || edge.get('to') === id) {
      cascade.remove({ scope: 'edges', id: idOf(edge) }, deleteById(edges, idOf(edge)));
    }
  }
  for (const node of collectionArray(doc, 'nodes')) {
    if (node.get('parent') === id && idOf(node) !== id) {
      cascade.update({ scope: 'nodes', id: idOf(node) }, () => {
        node.delete('parent');
      });
    }
  }
  for (const view of collectionArray(doc, 'views')) {
    const positions = view.get('positions');
    const inPositions = positions instanceof Y.Map && positions.has(id);
    if (listHas(view, 'includes', id) || inPositions) {
      cascade.update({ scope: 'views', id: idOf(view) }, () => {
        removeFromList(view, 'includes', id, false);
        if (inPositions) positions.delete(id);
      });
    }
  }
}

function removeGroup(cascade: Cascade, doc: DeckDoc, group: YObject): void {
  const id = idOf(group);
  const parent = group.get('parent');
  const repoint = (map: YObject, field: string) => () => {
    if (typeof parent === 'string') map.set(field, parent);
    else map.delete(field);
  };
  for (const node of collectionArray(doc, 'nodes')) {
    if (node.get('group') === id)
      cascade.update({ scope: 'nodes', id: idOf(node) }, repoint(node, 'group'));
  }
  for (const child of collectionArray(doc, 'groups')) {
    if (child.get('parent') === id) {
      cascade.update({ scope: 'groups', id: idOf(child) }, repoint(child, 'parent'));
    }
  }
}

function removeFeature(cascade: Cascade, doc: DeckDoc, id: Id): void {
  for (const c of ['views', 'flows'] as const) {
    for (const map of collectionArray(doc, c)) {
      if (map.get('feature') === id) {
        cascade.update({ scope: c, id: idOf(map) }, () => {
          map.delete('feature');
        });
      }
    }
  }
}

/** Removes an object of a collection with its cascade. */
export function removeObject(ctx: EditContext, c: Collection, id: Id): RemovalResult {
  const { doc } = ctx;
  const array = collectionArray(doc, c);
  const map = array.get(findIndexById(array, id, LABELS[c]));
  const cascade = new Cascade(ctx);
  cascade.remove({ scope: c, id }, deleteById(array, id));
  switch (c) {
    case 'nodes':
      removeNode(cascade, doc, id);
      break;
    case 'groups':
      removeGroup(cascade, doc, map);
      break;
    case 'features':
      removeFeature(cascade, doc, id);
      break;
    case 'flows': {
      const steps = map.get('steps');
      if (steps instanceof Y.Array) {
        for (const step of steps as Y.Array<YObject>) {
          // Owned: deleted with the flow's map, listed so surfaces know.
          cascade.remove(stepRef(id, idOf(step)), () => undefined);
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
  findIndexById(steps, stepId, 'Step');
  const cascade = new Cascade(ctx);
  cascade.remove(stepRef(flowId, stepId), deleteById(steps, stepId));
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
  for (const node of collectionArray(doc, 'nodes')) {
    if (listHas(node, 'rules', id)) {
      cascade.update({ scope: 'nodes', id: idOf(node) }, () => {
        removeFromList(node, 'rules', id, true);
      });
    }
  }
  forEachStep(doc, (step, flowId) => {
    const inputs = step.get('ruleInputs');
    const hasInputs = inputs instanceof Y.Map && inputs.has(id);
    if (!listHas(step, 'rules', id) && !hasInputs) return;
    cascade.update(stepRef(flowId, idOf(step)), () => {
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
  const columns = rule.get(side) as Y.Array<YObject>;
  const index = findIndexById(columns, columnId, 'Column');
  const cellField = side === 'inputs' ? 'when' : 'then';
  const cascade = new Cascade(ctx);
  cascade.remove({ scope: 'rules', id: ruleId, child: { kind: 'column', id: columnId } }, () => {
    columns.delete(index, 1);
    for (const row of rule.get('rows') as Y.Array<YObject>) {
      (row.get(cellField) as Y.Array<string>).delete(index, 1);
    }
  });
  if (side === 'inputs') {
    forEachStep(ctx.doc, (step, flowId) => {
      const inputs = step.get('ruleInputs');
      const values = inputs instanceof Y.Map ? inputs.get(ruleId) : undefined;
      if (values instanceof Y.Map && values.has(columnId)) {
        cascade.update(stepRef(flowId, idOf(step)), () => {
          values.delete(columnId);
        });
      }
    });
  }
  return cascade.commit();
}
