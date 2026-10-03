# Contract: card type registry and pack API (030)

Pure data and helpers other code (031, 032, the app) relies on. Names may be adjusted during
implementation; the behaviour may not.

## `@sododeck/model` (`src/card-types.ts`)

```ts
type TypeId = string; // schema $defs/TypeId
type PackId = string; // schema $defs/PackId
type Category = 'architecture' | 'process' | 'logistics' | 'data'; // 031 adds 'shapes'
type Family = 'card' | 'shape';

interface CardType {
  id: TypeId;
  name: string;
  pack: PackId;
  category: Category;
  family: Family;
  order: number;
}
interface Pack {
  id: PackId;
  name: string;
  order: number;
}

const CARD_TYPES: readonly CardType[]; // 13 built-in types, registry order
const PACKS: readonly Pack[]; // architecture, process, logistics, data
const LEGACY_PACKS: readonly PackId[]; // ['architecture']: decks without `packs`
const NEW_DECK_PACKS: readonly PackId[]; // every 030 pack

function cardType(id: TypeId): CardType | undefined;
function isKnownType(id: TypeId): boolean;
function typeName(id: TypeId): string; // unknown → the id itself
function deckPacks(deck: Pick<SododeckFile, 'packs'>): readonly PackId[]; // absent → LEGACY_PACKS
function typesOfPacks(packs: readonly PackId[]): readonly CardType[]; // registry order
function packTypeCount(pack: PackId): number;
```

## `DeckEditor`

```ts
/** Turns a pack on or off; materialises LEGACY_PACKS first when the deck has none stored.
 *  Throws (and writes nothing) when it would turn off the last pack on or the id is invalid. */
setPackOn(packId: PackId, on: boolean): void;
```

`createDeck()` stores `NEW_DECK_PACKS`. `fromJSON` never adds `packs` to a file that has none.

## `@sododeck/ui` (`src/lib/icons.ts`)

```ts
const TYPE_STYLE: Readonly<Record<TypeId, { icon: LucideIcon; tone: string }>>;
const TYPE_FALLBACK: { icon: LucideIcon; tone: string }; // Shapes, neutral
function typeStyle(id: TypeId): { icon; tone }; // case-insensitive, aliases edge→gateway, data→database kept
```

`KindTile` keeps its role and becomes `TypeTile` (or keeps its name with a `type` prop); its
accessible label comes from the caller (`typeName`), not from `ui`.

## Guarantees (unit-tested)

- Every `CARD_TYPES` id matches the `TypeId` pattern and has `TYPE_STYLE` and export icon entries.
- The six legacy ids are in pack `architecture` with today's icons and tones.
- `deckPacks` of a file without `packs` is `['architecture']`; with `packs` it is that list in
  registry order, unknown ids after, sorted.
- `typesOfPacks(LEGACY_PACKS)` is the Architecture pack (7 types).
- Ids never depend on names (a test renames a name and checks ids and stored data are unchanged).
