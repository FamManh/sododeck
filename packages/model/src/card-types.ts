/**
 * The card type registry (030, ADR 0025): which types exist, their names, and which pack and
 * category each belongs to. Pure data, no React and no icons: icons and tile tones live in
 * `@sododeck/ui` (`TYPE_STYLE`), keyed by the same ids, and an app test ties the two together.
 *
 * The file stores only `node.type` (any `TypeId`) and the deck's `packs`; everything here is app
 * data, so a type or pack this version does not know still loads and is kept on save.
 */
import type { PackId, SododeckFile, TypeId } from '@sododeck/schema';

export type { PackId, TypeId };

/** Groups types in the Add flyout and the type pickers. 031 adds `'shapes'`. */
export type Category = 'architecture' | 'process' | 'logistics' | 'data';
/** A card (header, fields) or a shape (031). */
export type Family = 'card' | 'shape';

export interface CardType {
  id: TypeId;
  /** Shown in the UI. Never used as an id. */
  name: string;
  pack: PackId;
  category: Category;
  family: Family;
  /** Position in the registry (also the order of tiles and options). */
  order: number;
}

export interface Pack {
  id: PackId;
  name: string;
  order: number;
}

export interface CategoryInfo {
  id: Category;
  name: string;
}

const PACK_LIST: readonly Omit<Pack, 'order'>[] = [
  { id: 'architecture', name: 'Architecture' },
  { id: 'process', name: 'Process' },
  { id: 'logistics', name: 'Logistics' },
  { id: 'data', name: 'Data cards' },
];

/** In 030 each pack has one category of the same id. */
export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'architecture', name: 'Architecture' },
  { id: 'process', name: 'Process' },
  { id: 'logistics', name: 'Logistics' },
  { id: 'data', name: 'Data' },
];

const TYPE_LIST: readonly (readonly [TypeId, string, PackId, Category])[] = [
  ['service', 'Service', 'architecture', 'architecture'],
  ['database', 'Database', 'architecture', 'architecture'],
  ['gateway', 'Gateway', 'architecture', 'architecture'],
  ['client', 'Client', 'architecture', 'architecture'],
  ['queue', 'Queue', 'architecture', 'architecture'],
  ['external', 'External', 'architecture', 'architecture'],
  ['component', 'Component', 'architecture', 'architecture'],
  ['task', 'Task', 'process', 'process'],
  ['decision', 'Decision', 'process', 'process'],
  ['document', 'Document', 'process', 'process'],
  ['warehouse', 'Warehouse', 'logistics', 'logistics'],
  ['truck-route', 'Truck route', 'logistics', 'logistics'],
  ['issue', 'Issue', 'data', 'data'],
];

export const PACKS: readonly Pack[] = PACK_LIST.map((pack, order) => ({ ...pack, order }));

export const CARD_TYPES: readonly CardType[] = TYPE_LIST.map(
  ([id, name, pack, category], order) => ({
    id,
    name,
    pack,
    category,
    family: 'card',
    order,
  }),
);

/** Decks saved before packs existed: Architecture only (the six original types plus Component). */
export const LEGACY_PACKS: readonly PackId[] = ['architecture'];

/** A new deck starts with every pack of this version on. */
export const NEW_DECK_PACKS: readonly PackId[] = PACKS.map((pack) => pack.id);

const TYPE_BY_ID = new Map(CARD_TYPES.map((type) => [type.id, type]));
const PACK_BY_ID = new Map(PACKS.map((pack) => [pack.id, pack]));

export function cardType(id: TypeId): CardType | undefined {
  return TYPE_BY_ID.get(id);
}

export function isKnownType(id: TypeId): boolean {
  return TYPE_BY_ID.has(id);
}

export function isKnownPack(id: PackId): boolean {
  return PACK_BY_ID.has(id);
}

/** The registry name; an id this version does not know is shown as itself. */
export function typeName(id: TypeId): string {
  return TYPE_BY_ID.get(id)?.name ?? id;
}

/** Known packs in registry order, then unknown ids sorted: one order for every reader and writer. */
export function sortPacks(ids: Iterable<PackId>): PackId[] {
  const set = new Set(ids);
  const known = PACKS.filter((pack) => set.has(pack.id)).map((pack) => pack.id);
  const unknown = [...set].filter((id) => !PACK_BY_ID.has(id)).sort();
  return [...known, ...unknown];
}

/** The packs that are on: `LEGACY_PACKS` when the file stores none. */
export function deckPacks(deck: Pick<SododeckFile, 'packs'>): readonly PackId[] {
  return deck.packs === undefined ? LEGACY_PACKS : sortPacks(deck.packs);
}

/** Types of the given packs, in registry order. Unknown packs contribute nothing. */
export function typesOfPacks(packs: readonly PackId[]): readonly CardType[] {
  const on = new Set(packs);
  return CARD_TYPES.filter((type) => on.has(type.pack));
}

export function packTypeCount(pack: PackId): number {
  return CARD_TYPES.filter((type) => type.pack === pack).length;
}
