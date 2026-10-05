/**
 * What the Touches picker lists (049): tables by name and their columns, each with its owner
 * card for context. Pure.
 */
import { isDbTable, type TouchKey } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

type Node = SododeckFile['nodes'][number];

/** Options listed at most in the picker; typing narrows the rest. */
const MAX_OPTIONS = 50;

export interface TouchOption {
  key: TouchKey;
  /** "orders" or "orders.email": what the filter matches. */
  text: string;
  /** "orders" or "orders · email": what the row shows. */
  label: string;
  /** The owner card's title, or "No database". */
  context: string;
}

/** Ids hold only [A-Za-z0-9_.:-], so `/` cannot occur in either part (and needs no escaping). */
export const keyId = (key: TouchKey) => `${key.table}/${key.column ?? ''}`;

export function contextOf(byId: ReadonlyMap<Id, Node>, table: Node): string {
  const owner = table.parent === undefined ? undefined : byId.get(table.parent);
  return owner?.type === 'database' ? owner.title : 'No database';
}

/**
 * Tables whose name matches `query`, each followed (when typing) by its matching columns: by
 * "table.column" when the query has a dot, else by column name.
 */
export function touchOptions(deck: SododeckFile, query: string): TouchOption[] {
  const q = query.trim().toLowerCase();
  const byId = new Map(deck.nodes.map((node) => [node.id, node]));
  const out: TouchOption[] = [];
  for (const table of deck.nodes) {
    if (!isDbTable(table)) continue;
    const context = contextOf(byId, table);
    if (table.title.toLowerCase().includes(q)) {
      out.push({ key: { table: table.id }, text: table.title, label: table.title, context });
    }
    if (q === '') continue;
    for (const column of table.columns ?? []) {
      const text = `${table.title}.${column.name}`;
      // "orders.em" matches across the dot; plain "email" matches the column name alone.
      const target = q.includes('.') ? text : column.name;
      if (!target.toLowerCase().includes(q)) continue;
      out.push({
        key: { table: table.id, column: column.id },
        text,
        label: `${table.title} · ${column.name}`,
        context,
      });
    }
  }
  return out.slice(0, MAX_OPTIONS);
}
