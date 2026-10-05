/**
 * Database card ownership (049, ADR 0035): a table belongs to the database card it is parented
 * to. Pure lookups over a deck snapshot; nothing here is stored.
 */
import { isDbTable } from '@sododeck/model';
import type { Dialect, Id, SododeckFile } from '@sododeck/schema';

import { dialectName, isSqlDialect } from './export/schema-slice';

type Node = SododeckFile['nodes'][number];

/** The card type that owns tables. */
export const DATABASE_TYPE = 'database';

export const isDatabaseCard = (node: Pick<Node, 'type'>): boolean => node.type === DATABASE_TYPE;

const countCache = new WeakMap<readonly Node[], ReadonlyMap<Id, number>>();

/** How many tables each card owns, by card id; one pass per `nodes` array. */
export function tableCounts(deck: Pick<SododeckFile, 'nodes'>): ReadonlyMap<Id, number> {
  const cached = countCache.get(deck.nodes);
  if (cached !== undefined) return cached;
  const counts = new Map<Id, number>();
  for (const node of deck.nodes) {
    if (node.parent !== undefined && isDbTable(node)) {
      counts.set(node.parent, (counts.get(node.parent) ?? 0) + 1);
    }
  }
  countCache.set(deck.nodes, counts);
  return counts;
}

/** The tables a card owns, in deck order. */
export function tablesOf(deck: Pick<SododeckFile, 'nodes'>, cardId: Id): Node[] {
  return deck.nodes.filter((node) => node.parent === cardId && isDbTable(node));
}

/** The database card a table belongs to, or `undefined` when it has none. */
export function ownerOf(deck: Pick<SododeckFile, 'nodes'>, tableId: Id): Node | undefined {
  const table = deck.nodes.find((node) => node.id === tableId);
  if (table?.parent === undefined) return undefined;
  const owner = deck.nodes.find((node) => node.id === table.parent);
  return owner !== undefined && isDatabaseCard(owner) ? owner : undefined;
}

/** Every database card of the deck, in deck order: the owners "Move to database…" offers. */
export function databaseCards(deck: Pick<SododeckFile, 'nodes'>): Node[] {
  return deck.nodes.filter(isDatabaseCard);
}

/** The card face line: "12 tables inside", "1 table inside", "No tables yet". */
export function tableCountText(count: number): string {
  if (count === 0) return 'No tables yet';
  return count === 1 ? '1 table inside' : `${String(count)} tables inside`;
}

/** The dialect chip on every database card: "Generic", "Postgres", "MySQL" or "SQLite". */
export function dialectLabel(dialect: Dialect): string {
  return isSqlDialect(dialect) ? dialectName(dialect) : 'Generic';
}
