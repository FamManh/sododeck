# Data Model: Card Look "Deck" (029)

Only connectors change in the file format. Everything else in this feature is derived for display and never stored.

## Stored (`.sododeck.json` v1, additive)

### `EdgeShape` (new `$defs`)

`"curved" | "elbow" | "straight"`

### `EdgeStyle` (new `$defs`)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `shape` | `EdgeShape` | no | Line type. 022 adds `dash`, `width`, `color`, `animated` here later (ADR 0022). |

- `additionalProperties: false`, `minProperties: 1`. The Zod generator drops `minProperties`, so semantic rule **S7** reports an empty edge style.

### `Edge` (changed)

| Field | Change |
| --- | --- |
| `style` | **New**, optional `EdgeStyle`, declared after `route` (so it is written last). Absent = default look. |
| `route` | Unchanged (`fromSide`, `toSide`, `offset`, ADR 0019). |

**Effective shape** (pure, `packages/model` `edgeShape(edge)`):

```text
edge.style?.shape  ??  (edge.route?.offset !== undefined ? 'elbow' : 'curved')
```

**Write rules** (`setEdgeShape(edgeIds, shape)`, one transaction, one undo step):

| Target edge | `shape` picked | Stored result |
| --- | --- | --- |
| any | `elbow` or `straight` | `style.shape = shape` |
| has `route.offset` | `curved` | `style.shape = 'curved'` (needed: absent would read as elbow) |
| no `route.offset` | `curved` | `style.shape` deleted; `style` deleted when empty |

- `route` is never changed by `setEdgeShape` (offset and pinned sides kept, clarification Q2).
- **Reset route / reattach** on an edge whose effective shape is elbow and whose `shape` is absent: write `style.shape = 'elbow'` in the same transaction before clearing `route`, so the line stays elbow.
- **New connector**: `editor.add('edges', { from, to, style: { shape } })` when the tab's last-picked type is not curved; otherwise no `style`.

**Example**

```json
{ "id": "e-orders-db", "from": "orders", "to": "db", "route": { "fromSide": "right", "offset": 24 }, "style": { "shape": "curved" } }
```

### Yjs storage (ADR 0021, unchanged layout)

- `edges` `Y.Map<id, Y.Map>` → the edge's `Y.Map` gains a nested `style` `Y.Map` with key `shape`, written key by key (like card `style`, 020).
- `readFields` already treats an empty `style` map as no style.
- Two tabs creating `style` at the same moment: last write wins on the first creation (ADR 0021 R11); later keys merge.

## Derived (never stored)

### `CardLayout` (app, `card-layout.ts`, also used by export)

| Field | Meaning |
| --- | --- |
| `width` | Stored width (017) or 184 |
| `height` | Content height (padding + header + title + description + tags + children pill + gaps), or the stored height, never below the minimum layout |
| `titleLines` | 1–3 |
| `descriptionLines` | 0–3 |
| `tagRows` | Rows of 18px tag pills (0 when no tags) |
| `hasChildrenRow` | "n inside" pill shown |

Depends on: title, view subtitle text, tags, child count, width. Never on zoom level.

### `CardLook` (existing, extended)

`fill`, `stroke`, `text` (020) plus `chip`, `ink`, `dot`: the named colour's tokens, or for a custom hex `chip = hex`, `ink = readableText(hex)`, `dot = hex`; neutral tokens when uncoloured.

### Edge geometry (`routing/route-path.ts` `routedPath`)

| Field | Meaning |
| --- | --- |
| `path` | SVG path for the shape |
| `labelX`, `labelY` | Label anchor |
| `ends.start`, `ends.end` | Points at the side midpoints (pinned or resolved), identical for every shape |
| `ends.startDir`, `ends.endDir` | Unit vectors used to draw the knob / arrow |

### UI state (`useUiStore`, in memory per tab)

| Field | Type | Default | Set by |
| --- | --- | --- | --- |
| `lastLineShape` | `EdgeShape` | `'curved'` | `connection.lineType` action only |

## Design tokens (not stored in decks)

- Per named colour, light and dark: `--sd-card-{name}-chip`, `-ink`, `-dot` (new), next to `-fill`, `-stroke` (unchanged).
- `--sd-deck-*`: edge colour, orange, orange soft, dim (0.22), neutral dot, text-selection colour, lip sizes, radii (DESIGN.md "Card system (Deck)").

## Validation

| Rule | Where |
| --- | --- |
| `edge.style.shape` ∈ enum | JSON Schema (Ajv) + generated Zod |
| `edge.style` has ≥ 1 key | Semantic rule S7 |
| Ink on chip ≥ 4.5:1, both themes, 13 colours | `packages/ui/test/contrast.test.ts` |
| Dot on fill ≥ 3:1 | same |
