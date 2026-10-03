# Data Model: Connector Style (022)

All additions are optional and additive to schema v1 (no version bump; ADR 0022, §g-81). Absent
means today's look. Decisions in [research.md](research.md) R1, R3–R6.

## File format (`packages/schema/schema/v1.json`)

### `EdgeStyle` (exists since 029, `minProperties: 1`)

| Key        | Type                               | Default (absent)        | Notes                       |
| ---------- | ---------------------------------- | ----------------------- | --------------------------- |
| `shape`    | `curved` \| `elbow` \| `straight`  | `edgeShape(edge)` (029) | unchanged                   |
| `dash`     | `solid` \| `dashed` \| `dotted`    | `solid`                 | `solid` is never stored     |
| `width`    | `1` \| `1.5` \| `2` \| `3` \| `4`  | `2` (today's line)      | `2` is never stored         |
| `color`    | `ColorRef` (13 names or `#rrggbb`) | default grey            | "No colour" removes the key |
| `animated` | `boolean`                          | `false`                 | only `true` is stored       |

### `EdgeRoute` (exists since 017; all keys optional)

| Key         | Type                   | Meaning                                                                                         |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| `fromSide`  | `Side`                 | unchanged (017)                                                                                 |
| `toSide`    | `Side`                 | unchanged (017)                                                                                 |
| `offset`    | `number`               | unchanged (017); read as two implicit bends; removed on the first bend edit (R3)                |
| `fromAt`    | `number` 0–1           | **new.** Position along `fromSide` (left → right, top → bottom); absent = 0.5. Needs `fromSide` |
| `toAt`      | `number` 0–1           | **new.** Same for the target end. Needs `toSide`                                                |
| `waypoints` | `RouteWaypoint[]`, ≥ 1 | **new.** Bend points, source → target. Never together with `offset`                             |

### `RouteWaypoint` (new `$def`)

Exactly one key per axis. Reference: S = source card centre, T = target card centre (in the view
being drawn).

| Key  | Type     | Meaning                                                                |
| ---- | -------- | ---------------------------------------------------------------------- |
| `x`  | `number` | fraction of the S→T span on x: `P.x = S.x + x · (T.x − S.x)`           |
| `dx` | `number` | px from the midpoint on x, used when the x span was < 22 px at placing |
| `y`  | `number` | as `x`, on y                                                           |
| `dy` | `number` | as `dx`, on y                                                          |

### `Edge`

| Key       | Type         | Default | Meaning                                                          |
| --------- | ------------ | ------- | ---------------------------------------------------------------- |
| `labelAt` | `number` 0–1 | 0.5     | **new.** Label position as a fraction of the drawn line's length |

### Semantic rules (`packages/schema/src/semantic-rules.ts`)

- **S9:** `route.fromAt` requires `route.fromSide`; `route.toAt` requires `route.toSide`.
- **S10:** `route` never holds both `offset` and `waypoints`.
- **S11:** every waypoint has exactly one of `x` / `dx` and exactly one of `y` / `dy`.

Invalid fixtures for each, with Ajv / Zod parity (`schema.test.ts`), coverage example in
`examples/full.sododeck.json`.

### Example

```json
{
  "id": "e_checkout_payments",
  "from": "n_checkout",
  "to": "n_payments",
  "label": "charge",
  "labelAt": 0.2,
  "style": { "shape": "elbow", "dash": "dashed", "width": 3, "color": "blue", "animated": true },
  "route": {
    "fromSide": "right",
    "fromAt": 0.25,
    "waypoints": [
      { "x": 0.5, "dy": -88 },
      { "x": 0.5, "y": 1 }
    ]
  }
}
```

## Yjs document (ADR 0021, `packages/model`)

| Stored at            | Yjs type               | Write rule                                                         |
| -------------------- | ---------------------- | ------------------------------------------------------------------ |
| `edges/<id>/style`   | nested `Y.Map`         | key by key; removed when empty (029)                               |
| `edges/<id>/route`   | nested `Y.Map` (017)   | scalar keys key by key; `waypoints` one JSON value, replaced whole |
| `edges/<id>/labelAt` | scalar on the edge map | removed when 0.5                                                   |

No layout version change; `fromJSON` / `toJSON` / `readObject` carry the keys through the existing
generic conversion; round-trip cases cover every key, the defaults-not-stored rule and a 017 file.

## Model API (`DeckEditor`, one call = one undo step)

| Method                                | Effect                                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `setEdgeStyle(edgeIds, patch)`        | `patch`: any of `shape`, `dash`, `width`, `color`, `animated`; `null` = default (key removed)                                                                                                          |
| `setEdgeShape(edgeIds, shape)`        | unchanged signature; delegates to `setEdgeStyle`                                                                                                                                                       |
| `setEdgeRoute(edgeId, patch \| null)` | `EdgeRoutePatch` gains `fromAt`, `toAt`, `waypoints` (`null` removes); setting `waypoints` on a route with `offset` removes `offset` and pins `shape: 'elbow'` if unset (R3); `null` resets everything |
| `setEdgeLabelAt(edgeId, at \| null)`  | stores `labelAt`; `null` or 0.5 removes it                                                                                                                                                             |

Details and pure helpers in [contracts/connector-api.md](contracts/connector-api.md).

## Derived (never stored)

| Value          | Derived from                                      | Where                                |
| -------------- | ------------------------------------------------- | ------------------------------------ |
| Anchor point   | side midpoint, `fromAt` / `toAt`, card size       | `connector-geometry.anchorPoint`     |
| Bend positions | waypoints + both card centres in the current view | `connector-geometry.decodeWaypoints` |
| Implicit bends | 017 `offset` segment corners                      | `connector-geometry.offsetBends`     |
| Drawn path     | ordered points + shape                            | `connector-geometry.pointsToPath`    |
| Label point    | path + `labelAt`, clamped                         | `connector-geometry.labelPoint`      |
| Line colour    | `style.color` + theme, contrast-adjusted          | `style/line-colour.ts`               |
| Mixed values   | selected edges' styles                            | `inspector/derive.lineStyleView`     |

## State transitions

- **Bends:** none → (drag midpoint) n=1 → … ; any → (remove last) none; any → (Reset route) none;
  017 offset → (first bend edit) explicit bends, offset removed.
- **Anchor:** automatic → (drag end along a side) pinned side + position → (drop on body) automatic.
- **Style keys:** absent ↔ value; setting a default value removes the key.
