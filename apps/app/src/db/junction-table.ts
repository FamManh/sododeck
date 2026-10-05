/**
 * "Create junction table" (047 R6): turns an n–n relationship into the table that makes it real,
 * two n–1 relationships from the new table to each side. Pure planning, then one undo step.
 */
import type { DeckEditor } from '@sododeck/model';
import type { DbColumn, Id, Node, SododeckFile } from '@sododeck/schema';

import { freeSpot, type Point } from '../editor/canvas-geometry';

export interface JunctionColumn {
  name: string;
  type: string;
  size?: string;
}

/** One relationship from the junction to a side; columns are indexes into `JunctionPlan.columns`. */
export interface JunctionLink {
  tableId: Id;
  /** The side's key columns, in order. */
  targets: readonly Id[];
  columns: readonly number[];
}

export interface JunctionPlan {
  name: string;
  schema?: string;
  columns: readonly JunctionColumn[];
  position: Point;
  /** The database card of the tables, so the new table is drawn inside it (049). */
  parent?: Id;
  links: readonly JunctionLink[];
}

const lower = (text: string) => text.trim().toLowerCase();

/** The side's key: the columns the relationship names, else the table's primary key. */
function keyOf(table: Node, named: readonly Id[] | undefined): DbColumn[] {
  const columns = table.columns ?? [];
  const ids = named ?? [];
  if (ids.length > 0) {
    return ids.flatMap((id) => columns.filter((column) => column.id === id));
  }
  return columns.filter((column) => column.pk === true);
}

/** The first free `base`, `base_2`, `base_3`… among the tables of `schema`, ignoring case. */
function freeName(deck: SododeckFile, base: string, schema: string | undefined): string {
  const taken = new Set(
    deck.nodes
      .filter((n) => n.type === 'db-table' && lower(n.schema ?? '') === lower(schema ?? ''))
      .map((n) => lower(n.title)),
  );
  let name = base;
  for (let n = 2; taken.has(lower(name)); n += 1) name = `${base}_${String(n)}`;
  return name;
}

/** The plan for relationship `edgeId`, or null when a side is gone or has no key to reference. */
export function planJunction(deck: SododeckFile, edgeId: Id): JunctionPlan | null {
  const edge = deck.edges.find((e) => e.id === edgeId);
  const from = deck.nodes.find((n) => n.id === edge?.from);
  const to = deck.nodes.find((n) => n.id === edge?.to);
  if (edge === undefined || from === undefined || to === undefined) return null;
  const sides = [
    { table: from, key: keyOf(from, edge.fromColumns) },
    { table: to, key: keyOf(to, edge.toColumns) },
  ];
  if (sides.some((side) => side.key.length === 0)) return null;
  const columns: JunctionColumn[] = [];
  const links: JunctionLink[] = [];
  for (const { table, key } of sides) {
    links.push({
      tableId: table.id,
      targets: key.map((column) => column.id),
      columns: key.map((column) => {
        columns.push({
          name: `${table.title}_${column.name}`,
          type: column.type,
          ...(column.size === undefined ? {} : { size: column.size }),
        });
        return columns.length - 1;
      }),
    });
  }
  const schema = from.schema?.trim() === '' ? undefined : from.schema;
  const a = from.position ?? { x: 0, y: 0 };
  const b = to.position ?? { x: 0, y: 0 };
  return {
    name: freeName(deck, `${from.title}_${to.title}`, schema),
    ...(schema === undefined ? {} : { schema }),
    columns,
    position: freeSpot(deck, { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) }),
    ...(from.parent === undefined ? {} : { parent: from.parent }),
    links,
  };
}

/** Writes the plan in one undo step; returns the new table's id. Does not touch UI state. */
export function applyJunction(editor: DeckEditor, plan: JunctionPlan, edgeId: Id): Id {
  let tableId = '';
  editor.batch(() => {
    tableId = editor.add('nodes', {
      type: 'db-table',
      title: plan.name,
      position: plan.position,
      ...(plan.parent === undefined ? {} : { parent: plan.parent }),
      ...(plan.schema === undefined ? {} : { schema: plan.schema }),
    });
    const ids = plan.columns.map((column) =>
      editor.addColumn(tableId, {
        name: column.name,
        type: column.type,
        ...(column.size === undefined ? {} : { size: column.size }),
        pk: true,
        notNull: true,
      }),
    );
    for (const link of plan.links) {
      editor.add('edges', {
        from: tableId,
        to: link.tableId,
        fromColumns: link.columns.flatMap((index) => ids[index] ?? []),
        toColumns: [...link.targets],
        cardinality: 'n-1',
      });
    }
    editor.remove('edges', edgeId);
  });
  return tableId;
}
