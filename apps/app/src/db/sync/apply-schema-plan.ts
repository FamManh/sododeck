/**
 * Writes a `SchemaPlan` through `DeckEditor` ops in one merged batch (046 contracts/schema-sync.md):
 * enums added, tables added or restored, table patches, parts, relationships, then removals last so
 * a cascade never hits something the plan still patches. Matched objects keep their ids because
 * the plan names them; a plan from `planSchemaSync` on the same snapshot throws nothing.
 */
import type { DeckEditor, NewObject, Patch } from '@sododeck/model';
import type { Edge, Id } from '@sododeck/schema';

import type { NewRelationship, RelationshipPatch, SchemaPlan } from './types';

export interface ApplyResult {
  addedTableIds: Id[];
  removedTables: { id: Id; name: string }[];
}

/** Keys of an edge that DBML expresses: a restored edge starts without them. */

function withoutExpressed(edge: Edge | undefined): Omit<Edge, 'id' | 'from' | 'to'> {
  if (edge === undefined) return {};
  const {
    id: _id,
    from: _from,
    to: _to,
    label: _label,
    fromColumns: _fromColumns,
    toColumns: _toColumns,
    cardinality: _cardinality,
    fromOptional: _fromOptional,
    toOptional: _toOptional,
    onDelete: _onDelete,
    onUpdate: _onUpdate,
    ...rest
  } = edge;
  return rest;
}

function edgeOf(rel: NewRelationship): NewObject<'edges'> {
  return {
    ...withoutExpressed(rel.base),
    id: rel.id,
    from: rel.from,
    to: rel.to,
    ...(rel.fromColumns.length === 0 ? {} : { fromColumns: rel.fromColumns }),
    ...(rel.toColumns.length === 0 ? {} : { toColumns: rel.toColumns }),
    ...(rel.name === undefined ? {} : { label: rel.name }),
    cardinality: rel.cardinality,
    ...(rel.fromOptional === true ? { fromOptional: true } : {}),
    ...(rel.toOptional === true ? { toOptional: true } : {}),
    ...(rel.onDelete === undefined ? {} : { onDelete: rel.onDelete }),
    ...(rel.onUpdate === undefined ? {} : { onUpdate: rel.onUpdate }),
  };
}

function edgePatchOf(patch: RelationshipPatch): Patch<Edge> {
  const { name, ...rest } = patch;
  return { ...rest, ...(name === undefined ? {} : { label: name }) };
}

export function applySchemaPlan(
  editor: DeckEditor,
  plan: SchemaPlan,
  options: { merge: string },
): ApplyResult {
  const addedTableIds: Id[] = [];
  editor.batch(
    () => {
      // 1. enums added (columns of new tables may name them)
      for (const add of plan.enumOps.adds) {
        editor.addEnum({
          id: add.id,
          name: add.name,
          ...(add.schema === undefined ? {} : { schema: add.schema }),
          ...(add.note === undefined ? {} : { note: add.note }),
          values: add.values.map((v) => ({
            id: v.id,
            name: v.name,
            ...(v.note === undefined ? {} : { note: v.note }),
          })),
        });
      }
      // enum values and names
      for (const update of plan.enumOps.updates) {
        if (Object.keys(update.patch).length > 0) editor.updateEnum(update.id, update.patch);
        for (const add of update.valueAdds) editor.addEnumValue(update.id, add.value, add.index);
        for (const value of update.valueUpdates) {
          editor.updateEnumValue(update.id, value.id, value.patch);
        }
      }

      // 2. tables added or restored
      for (const add of plan.addTables) {
        addedTableIds.push(editor.add('nodes', add.node));
      }

      // 3. table patches
      for (const update of plan.updateTables) {
        editor.update('nodes', update.id, update.patch);
      }

      // 4. parts: updates and adds, so references from indexes and relationships resolve
      for (const ops of plan.tableOps) {
        for (const update of ops.columns.updates) {
          editor.updateColumn(ops.tableId, update.id, update.patch);
        }
        for (const add of ops.columns.adds) editor.addColumn(ops.tableId, add.item);
        for (const update of ops.indexes.updates) {
          editor.updateIndex(ops.tableId, update.id, update.patch);
        }
        for (const add of ops.indexes.adds) editor.addIndex(ops.tableId, add.item);
        for (const update of ops.checks.updates) {
          editor.updateCheck(ops.tableId, update.id, update.patch);
        }
        for (const add of ops.checks.adds) editor.addCheck(ops.tableId, add.item);
      }

      // 5. relationships (before column and table removals cascade through them)
      for (const id of plan.relationshipOps.removes) editor.remove('edges', id);
      for (const update of plan.relationshipOps.updates) {
        editor.update('edges', update.id, edgePatchOf(update.patch));
      }
      for (const add of plan.relationshipOps.adds) editor.add('edges', edgeOf(add));

      // 6. part removals, then the final order
      for (const ops of plan.tableOps) {
        for (const id of ops.indexes.removes) editor.removeIndex(ops.tableId, id);
        for (const id of ops.checks.removes) editor.removeCheck(ops.tableId, id);
        for (const id of ops.columns.removes) editor.removeColumn(ops.tableId, id);
        ops.columns.order.forEach((id, i) => {
          editor.moveColumn(ops.tableId, id, i);
        });
        ops.indexes.order.forEach((id, i) => {
          editor.moveIndex(ops.tableId, id, i);
        });
        ops.checks.order.forEach((id, i) => {
          editor.moveCheck(ops.tableId, id, i);
        });
      }
      for (const update of plan.enumOps.updates) {
        for (const id of update.valueRemoves) editor.removeEnumValue(update.id, id);
        update.valueOrder.forEach((id, i) => {
          editor.moveEnumValue(update.id, id, i);
        });
      }

      // 7. enum removals, 8. table removals
      for (const id of plan.enumOps.removes) editor.removeEnum(id);
      for (const table of plan.removeTables) editor.remove('nodes', table.id);
    },
    { merge: options.merge },
  );
  return { addedTableIds, removedTables: plan.removeTables };
}
