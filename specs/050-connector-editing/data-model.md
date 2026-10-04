# Data model: Connector editing (050)

Only US4 (groups as endpoints) touches the file format. Everything else is UI state or derived geometry over the 022 route model (ADR 0024).

## Document (`.sododeck.json`, schema v1, no version bump)

### Edge (changed meaning, same shape)

| Field  | Before           | After                       |
| ------ | ---------------- | --------------------------- |
| `from` | Id of a **node** | Id of a **node or a group** |
| `to`   | Id of a **node** | Id of a **node or a group** |

Everything else on `Edge` (`route`, `style`, `label`, `labelAt`, `direction`, …) applies unchanged to group-ended edges. Read `route` against the group's frame box wherever 022 says "card": `fromSide` / `fromAt` place the end on the frame outline, and waypoints are relative to the frame centre.

**Validation rules**

- **V1** `from` and `to` each resolve to exactly one node or group (integrity check, `broken-reference` problem otherwise).
- **V2** No node and group share an id (new load / integrity check, `duplicate-id` problem). Generated ids are already unique across the deck.
- **V3** (editor rule, not a file rule) A connector between a group and anything it contains, at any depth, is refused on create and reconnect (`'contains'`). A file that already has one is drawn and allowed; it is not a problem.
- **V4** Self (`from === to`) and duplicate (same pair, either direction) refusals apply to groups as to cards.

**Cascade**

- Deleting a group deletes every edge whose `from` or `to` is that group, in the same transaction. `previewRemoval` lists them, so the delete confirmation shows the count.
- Deleting a node is unchanged.
- Ungrouping (removing a group but keeping its members) also deletes the group's edges, and the confirmation says so.

**Flows**

- A step may reference a group-ended edge. Continuity is unchanged: `previous.to === next.from` by id. Into G, then out of a card inside G, is a break (known limit, research R6).

**Clipboard**

- A copied fragment keeps an edge when both ends (nodes or groups) are in the fragment. Paste remaps group ends through the existing group id map.

### Route data used by this feature (unchanged, from 022)

| Field                                  | Used by                                                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `fromSide`, `fromAt`, `toSide`, `toAt` | end drag (US2), spread ends (US7), Shift + arrow nudge; a new connection pins the side it was dragged from and the drop side and position |
| `waypoints`                            | bend / midpoint drag (US1), segment drag (US5), inner or end run                                                                          |
| `offset` (017)                         | read only; converted to bends on the first bend or segment edit (022 rule)                                                                |

Weight values stay `1 | 1.5 | 2 | 3 | 4` (`style.width`, default 2 not stored).

## UI store (Zustand, not exported)

| State                    | Shape                                                                                                                                                   | Lifetime                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `endpointPreview` (new)  | `{ edgeId, end: 'source' \| 'target', targetId, targetKind: 'node' \| 'group', side, at, point, snapped, automatic, valid: ConnectionCheck }` or `null` | During an end drag; cleared on finish           |
| `lineStylePreview` (new) | `{ edgeIds, width }` or `null`                                                                                                                          | During a weight-slider drag                     |
| `bendPreview`            | unchanged `{ edgeId, bends }`; also used by segment drag                                                                                                | During a bend / segment drag                    |
| `connectorReadout`       | unchanged string                                                                                                                                        | During any connector drag                       |
| `guides`                 | unchanged; drawn only while a gesture is registered                                                                                                     | During card drag / resize / bend / segment drag |
| `canvasGesture`          | gains `'segment'`; `'endpoint'` now means our own end drag                                                                                              | During the gesture                              |
| removed                  | `endpointHover`, `endpointAnchor`, `reconnectingEdgeId`                                                                                                 | — (replaced by `endpointPreview`)               |

## Derived (pure, not stored)

- **Target** `{ id, kind: 'node' | 'group', box, geometry? }`, from `hitTarget` (research R4).
- **Attachment** `{ side, at, point, snapped, automatic }`, from `attachToOutline` (research R5).
- **Run** `{ index, axis: 'x' | 'y', from: Point, to: Point, kind: 'inner' | 'start' | 'end' }`, the straight runs of a drawn elbow path, for segment handles (research R7).
- **Spread plan**: `{ edgeId, patch: EdgeRoutePatch }[]` from `spreadEnds` (research R10).

## State transitions: end drag

```text
idle --press end--> pressed --move >= 4 px--> dragging --release--> write once (or nothing if unchanged / invalid) --> idle
                    pressed --release--> idle (click: nothing written)
                    dragging --Esc / blur / pointercancel / unmount--> idle (nothing written)
```

The same machine (from the pointer-drag helper) drives bend, midpoint, segment, label and weight drags.
