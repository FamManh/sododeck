# Data Model: Resize Cards and Route Connectors (017)

## Document (file format, additive in schema v1)

### `$defs/Side` (new)

`enum: ["top", "right", "bottom", "left"]`. This is a side of a card.

### `$defs/EdgeRoute` (new)

The object has `additionalProperties: false`. Every field is optional. An empty object is valid, but the app never writes one.

| Field      | Type   | Rules                                                                                                                                                                                                     |
| ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fromSide` | `Side` | The side of the source card the connector leaves from. When absent, it is picked automatically.                                                                                                           |
| `toSide`   | `Side` | The side of the target card the connector enters. When absent, it is picked automatically.                                                                                                                |
| `offset`   | number | The shift of the middle segment, in canvas px, relative to where automatic routing puts it. Positive values go right or down. When absent, it is 0. It only applies when the resolved sides are opposite. |

### `Node` (changed)

| Field  | Type   | Rules                                                                                                                                                                                                                                                                         |
| ------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `size` | `Size` | **New, optional.** Card width and height in canvas px. It is placed after `position`. When absent, the card uses the app's default for the zoom level. Sizes from 120 × 44 to 800 × 600 are supported. Values outside that range are drawn clamped and reported as a problem. |

### `Edge` (changed)

| Field   | Type        | Rules                                                                                              |
| ------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `route` | `EdgeRoute` | **New, optional.** It is placed after `links`. When absent, the connector is routed automatically. |

There is no new semantic rule and no version bump (research R1).

### Yjs layout

`node.size` and `edge.route` are nested `Y.Map`s, written per key by `writePatch`, the same way as `position`. This way two tabs that change different keys merge. `toY` and `fromY` need no special case.

## Model API (`packages/model`)

| Op                         | Signature                                                                                                          | Behaviour                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setCardSize`              | `(nodeId: Id, size: Size \| null) => void`                                                                         | `null` removes `size`. The op validates `width`, `height` > 0. It does not clamp; the app clamps. Undo key: `nodes:<id>:size`. It joins an open gesture.                                 |
| `setEdgeRoute`             | `(edgeId: Id, patch: { fromSide?: Side \| null; toSide?: Side \| null; offset?: number \| null } \| null) => void` | The patch is merged into the current route. `null` removes a key. `offset: 0` is removed. When no key is left, or the patch is `null`, `route` is removed. Undo key: `edges:<id>:route`. |
| `fitGroupFrames` (changed) | `+ options.sizeOf?: (node) => Size`                                                                                | Each member's box uses `sizeOf`. The default is the existing single size.                                                                                                                |
| `problems` (changed)       | New kind `card-size-out-of-range`                                                                                  | The problem names the component, its stored size and the allowed range. The target is the component.                                                                                     |

Both new ops are exposed on `DeckEditor`. `writePatch` treats `size` and `route` like `position`.

## App geometry (`apps/app/src/editor`)

| Helper                          | Where                      | Returns                                                                                                                                                         |
| ------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CARD_SIZE_LIMITS`              | `canvas-geometry.ts`       | `{ min: 120 × 44, max: 800 × 600, step: 4 }`                                                                                                                    |
| `cardSize(node, level)`         | `canvas-geometry.ts`       | The stored size, clamped to the limits. Without one, `nodeSize(level)`.                                                                                         |
| `cardBox(node, index, level)`   | `canvas-geometry.ts`       | `Rect`, from `displayPosition` + `cardSize`.                                                                                                                    |
| `resizeBox(input)`              | `editing/resize-limits.ts` | The clamped, stepped and optionally ratio- or centre-locked `Rect` for a handle drag. Shared by group frames and cards.                                         |
| `snapEdges(box, handle, cands)` | `editing/snap.ts`          | The moving edges snapped to candidate lines, plus guides.                                                                                                       |
| `textLines(size, level)`        | `card-text.ts`             | `{ title, subtitle }` line clamps.                                                                                                                              |
| `resolveSides(from, to, route)` | `routing/route-path.ts`    | `[Side, Side]`. A pinned side wins; otherwise the sides are picked by comparing centres.                                                                        |
| `middleSegment(sides)`          | `routing/route-path.ts`    | `'vertical' \| 'horizontal' \| null`                                                                                                                            |
| `routedStepPath(input)`         | `routing/route-path.ts`    | `{ path, labelX, labelY, segment: { axis, at, from, to } \| null }`. With offset 0 and no pinned sides, the result is identical to today's `getSmoothStepPath`. |
| `nearestSide(box, point)`       | `routing/route-path.ts`    | `Side`                                                                                                                                                          |

## UI state (`apps/app/src/state/ui-store.ts`, never saved)

| Field           | Type                                         | Notes                                                             |
| --------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| `canvasGesture` | + `'card-resize' \| 'segment' \| 'endpoint'` | Drives the hint bar, the handle visibility and the ghost styling. |
| `resizeReadout` | `{ width; height; x; y } \| null`            | The `W × H` pill next to the dragged corner.                      |
| `dragReadout`   | (existing)                                   | Reused for the signed segment offset.                             |
| `endpointHover` | `{ nodeId; side } \| null`                   | The hot side target while an end is dragged.                      |

## State transitions

**Card size**:

| From   | Action                          | To           | Undo steps                  |
| ------ | ------------------------------- | ------------ | --------------------------- |
| absent | handle drag, key, drawer        | `size`       | 1 per drag, burst or commit |
| `size` | handle drag, key, drawer        | a new `size` | 1                           |
| `size` | double-click handle, Reset size | absent       | 1                           |
| any    | Esc during a drag               | unchanged    | 0                           |

**Route**:

| From         | Action                                               | To                                                     | Undo steps |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------ | ---------- |
| absent / any | segment drag, ⌥-arrow burst, Offset field            | `offset` set (0 removes it)                            | 1          |
| any          | end dropped on the same card                         | `fromSide` / `toSide` set                              | 1          |
| any          | end dropped on another card                          | `from` / `to` changed, that side set, `offset` removed | 1          |
| any          | Reset route (menu, toolbar, drawer, R during a drag) | absent                                                 | 1          |
| any          | Esc during a drag                                    | unchanged                                              | 0          |

## Rendering rules

- A card's box is `cardSize` at every zoom level. The content layout (compact or full) still follows the level.
- Merged edges and port edges of collapsed or drilled groups (010) ignore `route`.
- Sticky leaders have no route.
- An offset is drawn only when the resolved sides are opposite. Otherwise it is kept in the file but not drawn.
