/**
 * Which tables a schema export writes (045, data-model §5): the selection, one database card or
 * the whole deck. Only `db-table` nodes count; other cards are ignored (FR-003). Pure.
 */
import { isDbTable } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import type { SchemaScopeRequest } from './types';

export type SchemaScopeKind = SchemaScopeRequest['kind'];

/** The UI values scope availability depends on (ids only; no editor import). */
export interface SchemaScopeUi {
  selection: readonly Id[];
  /** Drill frames, outermost first. */
  drill: readonly { kind: string; id: Id }[];
}

export interface SchemaScopes {
  /** Selected table ids, deck order. */
  selection: readonly Id[];
  /** The drilled-into database card, else the one selected database card. */
  database: { cardId: Id; title: string } | null;
  deckHasTables: boolean;
}

const DATABASE = 'database';

export function availableSchemaScopes(deck: SododeckFile, ui: SchemaScopeUi): SchemaScopes {
  const selected = new Set(ui.selection);
  const selection = deck.nodes.filter((n) => isDbTable(n) && selected.has(n.id)).map((n) => n.id);
  const byId = new Map(deck.nodes.map((n) => [n.id, n]));
  const top = ui.drill.at(-1);
  const drilled = top?.kind === 'node' ? byId.get(top.id) : undefined;
  const selectedCards = deck.nodes.filter((n) => n.type === DATABASE && selected.has(n.id));
  const card =
    drilled?.type === DATABASE
      ? drilled
      : selectedCards.length === 1
        ? selectedCards[0]
        : undefined;
  return {
    selection,
    database: card === undefined ? null : { cardId: card.id, title: card.title },
    deckHasTables: deck.nodes.some(isDbTable),
  };
}

/** The first available of selection → database card → whole deck (FR-002). */
export function defaultSchemaScope(scopes: SchemaScopes): SchemaScopeKind {
  if (scopes.selection.length > 0) return 'selection';
  if (scopes.database !== null) return 'database';
  return 'deck';
}

/** Ids of the tables in scope, deck order. */
export function tablesInScope(deck: SododeckFile, scope: SchemaScopeRequest): Id[] {
  const tables = deck.nodes.filter(isDbTable);
  switch (scope.kind) {
    case 'deck':
      return tables.map((n) => n.id);
    case 'database':
      return tables.filter((n) => n.parent === scope.cardId).map((n) => n.id);
    case 'selection': {
      const ids = new Set(scope.tableIds);
      return tables.filter((n) => ids.has(n.id)).map((n) => n.id);
    }
  }
}

/** The scope's label for headers: "Selection", the card's title, or "Whole deck". */
export function scopeLabel(deck: SododeckFile, scope: SchemaScopeRequest): string {
  if (scope.kind === 'selection') return 'Selection';
  if (scope.kind === 'deck') return 'Whole deck';
  return deck.nodes.find((n) => n.id === scope.cardId)?.title ?? 'Database';
}
