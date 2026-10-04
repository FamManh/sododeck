/**
 * What the dialog knows about where an import goes (044 FR-004, FR-019): the targets on offer,
 * the `ImportTarget` sent to the worker, and the boxes the imported cluster must stay clear of.
 * Pure.
 */
import { deckDialect, isDbTable } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import { availableSchemaScopes } from '../../db/export/scope';
import type { ImportTarget } from '../../db/import/types';
import { cardBox, groupBounds, type Rect } from '../canvas-geometry';

export type TargetKind = ImportTarget['kind'];

export interface TargetOption {
  kind: TargetKind;
  label: string;
}

export interface TargetContext {
  /** The database card in context: drilled into, else the one selected (045's rule). */
  card: { cardId: Id; title: string } | null;
  options: TargetOption[];
}

export function targetContext(
  deck: SododeckFile,
  ui: { selection: readonly Id[]; drill: readonly { kind: string; id: Id }[] },
): TargetContext {
  const card = availableSchemaScopes(deck, ui).database;
  const first: TargetOption =
    card === null
      ? { kind: 'deck', label: 'Import into this deck' }
      : { kind: 'card', label: `Import into ${card.title}` };
  return { card, options: [first, { kind: 'new-deck', label: 'New deck' }] };
}

/** The worker's view of the target deck: dialect, tables, enum and table names. */
export function importTarget(deck: SododeckFile, kind: TargetKind, cardId?: Id): ImportTarget {
  if (kind === 'new-deck') {
    return {
      kind,
      deckDialect: 'generic',
      deckHasTables: false,
      deckHasDescription: false,
      tableNames: [],
      enumNames: [],
    };
  }
  const tables = deck.nodes.filter(isDbTable);
  const named = (item: { schema?: string }) =>
    item.schema === undefined ? {} : { schema: item.schema };
  return {
    kind,
    ...(kind === 'card' && cardId !== undefined ? { cardId } : {}),
    deckDialect: deckDialect(deck),
    deckHasTables: tables.length > 0,
    deckHasDescription: (deck.description ?? '').trim() !== '',
    tableNames: tables.map((t) => ({ ...named(t), name: t.title })),
    enumNames: (deck.enums ?? []).map((e) => ({ ...named(e), name: e.name })),
  };
}

/**
 * The boxes already in the target container (FR-019): the deck's top-level cards and group
 * frames, or the cards inside the database card. `deck` is the view deck (view positions).
 */
export function existingRects(deck: SododeckFile, cardId?: Id): Rect[] {
  const rects: Rect[] = [];
  deck.nodes.forEach((node, index) => {
    const inside = cardId === undefined ? node.parent === undefined : node.parent === cardId;
    if (inside) rects.push(cardBox(node, index, 'system'));
  });
  if (cardId === undefined) for (const rect of groupBounds(deck).values()) rects.push(rect);
  return rects;
}

/** "orders" for `orders.sql`, "Imported schema" for pasted text. */
export function newDeckName(fileName: string | undefined): string {
  const base = fileName?.replace(/\.(sql|dbml|txt)$/i, '').trim();
  return base === undefined || base === '' ? 'Imported schema' : base;
}
