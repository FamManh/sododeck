# Data Model: Connection Focus and Drill-in (034)

No document, schema or `packages/model` change. Everything below is either **derived** from the deck snapshot (pure, cached, never stored) or **UI-only** state in `state/ui-store.ts` (never saved in the deck, never exported).

## Derived

### FocusSet (extended, `editor/focus-set.ts`)

| Field     | Type                  | Notes                                                                                             |
| --------- | --------------------- | ------------------------------------------------------------------------------------------------- |
| `focusId` | `string`              | Visible id: deck node id, `collapsed:<group>`, `group:<group>`, or (inside a drill) any of these. |
| `members` | `ReadonlySet<string>` | The focus card plus every neighbour; neighbours include `port:` proxies (Story 3.6).              |
| `edges`   | `ReadonlySet<string>` | Plain edge ids, `merged:` ids and **`bundle:` ids** touching the focus card.                      |

Rules: `focusSet(deck, graph, id, bundles)` resolves ends through `graph.representative`; an edge that is inside a folded bundle contributes the bundle id, not its own; fanned bundle edges contribute their own ids. A card with no connections → `members = {id}`, `edges = ∅`. Unknown or hidden id → `null`.

### Bundle (`editor/bundles.ts`)

| Field       | Type                             | Notes                                                         |
| ----------- | -------------------------------- | ------------------------------------------------------------- |
| `id`        | `` `bundle:${a}\|${b}` ``        | `a < b` (string order) — stable while both ends stay visible. |
| `a`, `b`    | `string`                         | Visible ids (deck node or `port:`).                           |
| `edgeIds`   | `readonly string[]`              | ≥ 2, deck order.                                              |
| `direction` | `'a-to-b' \| 'b-to-a' \| 'both'` | Same rule as `MergedEdge.direction`.                          |
| `fanned`    | `boolean`                        | Its id is in `fannedBundles`.                                 |

Eligibility of an edge (all must hold): both ends visible and different; `edge.route === undefined`; not in `exclude` (the shown flow's edges); bundling not `off` (recording).

### BundleResult

| Field     | Type                                                                  | Notes                                                         |
| --------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| `plain`   | `readonly { edgeId: string; fanIndex?: number; fanCount?: number }[]` | Drawn by `DeckEdge`; fan fields only for fanned bundles.      |
| `bundles` | `readonly Bundle[]`                                                   | Folded **and** fanned (a fanned bundle still draws its pill). |

State transitions of a pair (derived each render):

```text
1 eligible edge ──add──▶ 2+ eligible ──▶ folded bundle ──pill / ⏎──▶ fanned ──pill / Esc / pane──▶ folded
      ▲                     │                                │
      └──delete / adjust / flow shown──┘                     └── bundle disappears ⇒ id pruned from fannedBundles
```

### OutsideProxy (`editor/proxy-layout.ts`; replaces `exportPortRects`' placement)

| Field           | Type                   | Notes                                             |
| --------------- | ---------------------- | ------------------------------------------------- |
| `id`            | `` `port:${nodeId}` `` | Unchanged prefix.                                 |
| `outsideNodeId` | `string`               | Real card id.                                     |
| `title`         | `string`               | Outside card's title.                             |
| `kind`          | `string`               | Outside card's `type`, for the icon.              |
| `side`          | `'left' \| 'right'`    | Left when every connection comes in from outside. |
| `rect`          | `Rect`                 | 150 × 52, stacked per column, 16 gap, no overlap. |
| `edgeIds`       | `readonly string[]`    | From `PortPill`.                                  |

### ScopeLabel

| Field   | Type                           | Notes                                                         |
| ------- | ------------------------------ | ------------------------------------------------------------- |
| `id`    | `` `scope-label:${frameId}` `` | One per drill-in.                                             |
| `title` | `string`                       | Name of the drilled group or card.                            |
| `count` | `number`                       | Cards inside (visible + members of collapsed cards in scope). |
| `x, y`  | `number`                       | Top-left of `scopeBounds`, label sitting on the top edge.     |

## UI-only state (`state/ui-store.ts`)

| Field           | Type                                                      | Set by                                 | Cleared by                                                                  |
| --------------- | --------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `hoverFocus`    | `{ id: string; source: 'pointer' \| 'keyboard' } \| null` | `useHoverFocus` (after rest / at once) | grace timer, focus leaving, any suspension (R3), view / drill / deck switch |
| `fannedBundles` | `ReadonlySet<string>`                                     | pill click, ⏎ on a focused bundle      | pill click, Esc, pane click, view / drill / deck switch; pruned when gone   |

`focusedEdgeId` (existing) may now hold a `bundle:` id; `focusedId` may hold a `port:` id. `pruneSelection` / focus pruning learn both prefixes. Undo history is never touched by any of these (FR-004).
