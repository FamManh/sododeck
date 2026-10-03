# Contract: shape geometry and model API (031)

Names may be adjusted during implementation; the behaviour may not.

## `apps/app/src/editor/shapes/shape-geometry.ts` (pure, no DOM)

```ts
type Geometry =
  | 'rect' | 'rounded-rect' | 'ellipse' | 'diamond' | 'stadium' | 'cylinder'
  | 'document' | 'parallelogram' | 'hexagon' | 'actor' | 'none';

shapePath(geometry: Geometry, box: Box): { outline: string; lip: string | null; extra?: string };
outlinePoint(geometry: Geometry, box: Box, side: Side, at?: number): Point;
titleBox(geometry: Geometry, box: Box): Box;
minSize(geometry: Geometry): Size;
defaultSize(geometry: Geometry): Size;
```

Guarantees (unit-tested):

- `outlinePoint` with `at` 0.5 lies on the outline within 0.5 px for every geometry and side
  (sampled from `shapePath`); `none` uses the box.
- `outlinePoint` with `at` 0 / 1 gives the outline's ends of that side; values between move along
  the outline (022 free anchors).
- `titleBox` is inside the outline for every geometry at default and minimum size.
- Scaling the box scales the path (a diamond's vertices stay at the side midpoints).
- `lip` is `null` for `actor` and `none`.

## `@sododeck/model`

```ts
// card-types.ts (030), extended
interface CardType {
  /* … */ geometry?: Geometry;
  shapeForm?: TypeId;
}
function effectiveFamily(node: Pick<Node, 'type' | 'display'>): 'card' | 'shape';
function shapeGeometryOf(node: Pick<Node, 'type' | 'display'>): Geometry | null;
function hasTwoForms(typeId: TypeId): boolean;

interface DeckEditor {
  /** One undo step; removes `display` when it equals the type's family or is null. */
  setNodeDisplay(nodeIds: readonly Id[], display: 'card' | 'shape' | null): void;
  /** Existing; the Frame tool calls it with empty `nodes` / `groups` lists. */
  groupSelection(selection: GroupSelection): Id;
}
```

Errors: unknown node ids or an invalid `display` throw the existing validation error and write
nothing.

## Tile and header icons

Shape tiles (Add, type picker, view settings, search, export header-less) draw a 20 px mini outline
from `shapePath(geometry, 20 × 20 box)` instead of an icon-font glyph, so every shape has an icon
matching its geometry (lucide has no parallelogram). The `ui` package's `TYPE_STYLE` therefore
holds no shape icons; the app's type-tile component chooses the mini outline for shape-family
types. Sticky and Frame tiles use lucide `StickyNote` and `Frame` (both present).
