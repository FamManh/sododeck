/**
 * The card type registry (030, ADR 0025): which types exist, their names, and which pack and
 * category each belongs to. Pure data, no React and no icons: icons and tile tones live in
 * `@sododeck/ui` (`TYPE_STYLE`), keyed by the same ids, and an app test ties the two together.
 *
 * The file stores only `node.type` (any `TypeId`) and the deck's `packs`; everything here is app
 * data, so a type or pack this version does not know still loads and is kept on save.
 */
import type { Node, PackId, Size, SododeckFile, TypeId } from '@sododeck/schema';

export type { PackId, TypeId };

/** Groups types in the Add flyout and the type pickers. */
export type Category = 'architecture' | 'process' | 'logistics' | 'data' | 'shapes';
/** A card (header, fields) or a shape (031). */
export type Family = 'card' | 'shape';
/**
 * The outline a shape draws (031 R1). Paths, connection points and title boxes come from the
 * app's `shape-geometry.ts`; the registry only names them.
 */
export type Geometry =
  | 'rect'
  | 'rounded-rect'
  | 'ellipse'
  | 'diamond'
  | 'stadium'
  | 'cylinder'
  | 'document'
  | 'parallelogram'
  | 'hexagon'
  | 'actor'
  | 'none';
/** Tiles of a pack that add something other than a node: today's sticky, and a group frame. */
export type PackTool = 'sticky' | 'frame';

export interface CardType {
  id: TypeId;
  /** Shown in the UI. Never used as an id. */
  name: string;
  pack: PackId;
  category: Category;
  family: Family;
  /** Position in the registry (also the order of tiles and options). */
  order: number;
  /** Shape family only: what it draws, its size when none is stored, and how small it may go. */
  geometry?: Geometry;
  defaultSize?: Size;
  minSize?: Size;
  /** A card type that can also draw as a shape (`node.display`): the shape type it draws as. */
  shapeForm?: TypeId;
}

export interface Pack {
  id: PackId;
  name: string;
  order: number;
  /** Tool tiles shown after the pack's types in Add (031). */
  tools?: readonly PackTool[];
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
  { id: 'shapes', name: 'Basic shapes', tools: ['sticky', 'frame'] },
];

/** In 030 each pack has one category of the same id. */
export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'architecture', name: 'Architecture' },
  { id: 'process', name: 'Process' },
  { id: 'logistics', name: 'Logistics' },
  { id: 'data', name: 'Data' },
  { id: 'shapes', name: 'Shapes' },
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

/** In-between types (031): a card that can also draw as this shape type. */
const SHAPE_FORMS: Readonly<Record<string, TypeId>> = {
  decision: 'diamond',
  database: 'cylinder',
  document: 'document-shape',
};

const size = (width: number, height: number): Size => ({ width, height });

/**
 * The Basic shapes pack (031 research R1): id, name, geometry, default size, minimum size. Sizes
 * are read off frame 120; the minimum still fits one title line. `document-shape` keeps clear of
 * the `document` card type's id; the UI name is still "Document".
 */
const SHAPE_LIST: readonly (readonly [TypeId, string, Geometry, Size, Size])[] = [
  ['rectangle', 'Rectangle', 'rect', size(160, 72), size(64, 40)],
  ['rounded-rectangle', 'Rounded rectangle', 'rounded-rect', size(160, 72), size(64, 40)],
  ['ellipse', 'Ellipse', 'ellipse', size(152, 80), size(64, 40)],
  ['diamond', 'Diamond', 'diamond', size(176, 112), size(80, 56)],
  ['pill', 'Pill', 'stadium', size(176, 52), size(80, 36)],
  ['cylinder', 'Cylinder', 'cylinder', size(152, 104), size(64, 56)],
  ['document-shape', 'Document', 'document', size(152, 96), size(64, 48)],
  ['parallelogram', 'Parallelogram', 'parallelogram', size(168, 72), size(72, 40)],
  ['hexagon', 'Hexagon', 'hexagon', size(160, 76), size(72, 40)],
  ['actor', 'Actor', 'actor', size(80, 112), size(48, 72)],
  ['text', 'Text', 'none', size(160, 40), size(40, 24)],
];

export const PACKS: readonly Pack[] = PACK_LIST.map((pack, order) => ({ ...pack, order }));

export const CARD_TYPES: readonly CardType[] = [
  ...TYPE_LIST.map(([id, name, pack, category]) => {
    const shapeForm = SHAPE_FORMS[id];
    return {
      id,
      name,
      pack,
      category,
      family: 'card' as const,
      ...(shapeForm === undefined ? {} : { shapeForm }),
    };
  }),
  ...SHAPE_LIST.map(([id, name, geometry, defaultSize, minSize]) => ({
    id,
    name,
    pack: 'shapes',
    category: 'shapes' as const,
    family: 'shape' as const,
    geometry,
    defaultSize,
    minSize,
  })),
].map((type, order) => ({ ...type, order }));

/** The shape type ids, in registry order. */
export const SHAPE_TYPE_IDS: readonly TypeId[] = SHAPE_LIST.map(([id]) => id);

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

/** What the family helpers read of a node. */
export type FormNode = Pick<Node, 'type'> & Partial<Pick<Node, 'display'>>;

/** Decision, database and document (031): types that draw as a card or as a shape. */
export function hasTwoForms(typeId: TypeId): boolean {
  return TYPE_BY_ID.get(typeId)?.shapeForm !== undefined;
}

/**
 * Card or shape, as drawn: `display` for a type with two forms, else the type's own family.
 * `display` on any other type is kept in the file and ignored here. Unknown types are cards (030).
 */
export function effectiveFamily(node: FormNode): Family {
  const type = TYPE_BY_ID.get(node.type);
  if (type === undefined) return 'card';
  if (type.shapeForm !== undefined) return node.display ?? type.family;
  return type.family;
}

/** The shape type a node draws as, or `undefined` when it draws as a card. */
export function drawnShapeType(node: FormNode): CardType | undefined {
  if (effectiveFamily(node) !== 'shape') return undefined;
  const type = TYPE_BY_ID.get(node.type);
  if (type?.family === 'shape') return type;
  return type?.shapeForm === undefined ? undefined : TYPE_BY_ID.get(type.shapeForm);
}

/** The geometry a node draws, or `null` when it draws as a card. */
export function shapeGeometryOf(node: FormNode): Geometry | null {
  return drawnShapeType(node)?.geometry ?? null;
}
