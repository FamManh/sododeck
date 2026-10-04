/**
 * Foreign keys by name (044 research R11, FR-024): `customer_id` / `customerId` with no foreign key
 * → the table named `customer`, `customers`, `customeres` or `customery`→`customeries` (or whose
 * singular is the stem) with a single-column primary key of the same type family. Suggestions
 * only; nothing is written until the user accepts one. Pure.
 */
import type { DbColumn, Id, Node } from '@sododeck/schema';

import { typeFamily } from './build-plan';
import type { FkSuggestion, ImportPlan } from './types';

const ID_SUFFIX = [/^(.+?)_id$/i, /^(.*[a-z0-9])Id$/];

function stemOf(column: string): string | undefined {
  for (const pattern of ID_SUFFIX) {
    const match = pattern.exec(column);
    if (match?.[1] !== undefined && match[1] !== '') return match[1].toLowerCase();
  }
  return undefined;
}

/** Simple English plural forms of `stem` (no irregular plurals, spec Assumptions). */
function formsOf(stem: string): Set<string> {
  const forms = new Set([stem, `${stem}s`, `${stem}es`]);
  if (stem.endsWith('y')) forms.add(`${stem.slice(0, -1)}ies`);
  return forms;
}

function singularOf(name: string): string {
  if (name.endsWith('ies')) return `${name.slice(0, -3)}y`;
  if (name.endsWith('es') && /(s|x|z|ch|sh)es$/.test(name)) return name.slice(0, -2);
  if (name.endsWith('s')) return name.slice(0, -1);
  return name;
}

const sameFamily = (a: DbColumn, b: DbColumn) => {
  const fa = typeFamily(a.type);
  const fb = typeFamily(b.type);
  return fa === 'other' || fb === 'other'
    ? a.type.toLowerCase() === b.type.toLowerCase()
    : fa === fb;
};

/** The suggestions for the plan's tables, in table and column order. */
export function suggestForeignKeys(plan: Pick<ImportPlan, 'fragment'>): FkSuggestion[] {
  const { nodes, edges } = plan.fragment.deck;
  const tables = nodes.filter((n) => n.type === 'db-table');
  const linked = new Set<string>();
  for (const edge of edges) {
    for (const column of edge.fromColumns ?? []) linked.add(`${edge.from}\u0000${column}`);
    for (const column of edge.toColumns ?? []) linked.add(`${edge.to}\u0000${column}`);
  }
  const keyOf = (table: Node): DbColumn | undefined => {
    const pk = (table.columns ?? []).filter((c) => c.pk === true);
    return pk.length === 1 ? pk[0] : undefined;
  };
  const uniqueOf = (table: Node, column: DbColumn): boolean =>
    column.unique === true ||
    (column.pk === true && keyOf(table)?.id === column.id) ||
    (table.indexes ?? []).some(
      (i) => i.unique === true && i.columns.length === 1 && i.columns[0] === column.id,
    );

  const out: FkSuggestion[] = [];
  for (const table of tables) {
    for (const column of table.columns ?? []) {
      if (linked.has(`${table.id}\u0000${column.id}`)) continue;
      const stem = stemOf(column.name);
      if (stem === undefined) continue;
      const forms = formsOf(stem);
      const matches = tables.filter((t) => {
        const name = t.title.toLowerCase();
        return forms.has(name) || singularOf(name) === stem;
      });
      // Prefer a table in the same schema.
      const ordered = [
        ...matches.filter((t) => t.schema === table.schema),
        ...matches.filter((t) => t.schema !== table.schema),
      ];
      for (const candidate of ordered) {
        const key = keyOf(candidate);
        if (key === undefined) continue;
        if (candidate.id === table.id && key.id === column.id) continue;
        if (!sameFamily(column, key)) continue;
        out.push({
          fromTable: table.id,
          fromColumn: column.id,
          toTable: candidate.id,
          toColumn: key.id,
          label: `${table.title}.${column.name} → ${candidate.title}.${key.name}`,
          cardinality: uniqueOf(table, column) ? '1-1' : 'n-1',
          fromOptional: column.notNull !== true && column.pk !== true,
        });
        break;
      }
    }
  }
  return out;
}

/** Plan-id suggestions → deck ids through the paste id map; ones that do not map are dropped. */
export function remapSuggestions(
  suggestions: readonly FkSuggestion[],
  ids: ReadonlyMap<Id, Id>,
): FkSuggestion[] {
  return suggestions.flatMap((s) => {
    const fromTable = ids.get(s.fromTable);
    const fromColumn = ids.get(s.fromColumn);
    const toTable = ids.get(s.toTable);
    const toColumn = ids.get(s.toColumn);
    if (
      fromTable === undefined ||
      fromColumn === undefined ||
      toTable === undefined ||
      toColumn === undefined
    )
      return [];
    return [{ ...s, fromTable, fromColumn, toTable, toColumn }];
  });
}
