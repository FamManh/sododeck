# Data Model: Shapes (031)

Decisions in [research.md](research.md) R1, R4, R5. No version bump (ADR 0022, §g-81).

## File format (`packages/schema/schema/v1.json`)

| Change                             | Type              | Absent means          |
| ---------------------------------- | ----------------- | --------------------- |
| `Node.display` (new, after `type`) | `card` \| `shape` | the type's own family |

Shape types are plain `TypeId` values (030), so a shape is a node like any other:

```json
{ "id": "n_ok", "type": "diamond", "title": "Payment OK?", "size": { "width": 176, "height": 112 } }
{ "id": "n_db", "type": "database", "display": "shape", "title": "Orders DB" }
```

A frame drawn with the Frame tool is a normal group (ADR 0017) with `position` and `size` and no
members. A sticky from the Shapes tab is a normal sticky.

Fixtures: valid `display` values on in-between and other types; invalid `display: "icon"`.

## Registry additions (030's `packages/model/src/card-types.ts`, not stored)

| Field                              | Values                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `CardType.geometry` (shape family) | `rect`, `rounded-rect`, `ellipse`, `diamond`, `stadium`, `cylinder`, `document`, `parallelogram`, `hexagon`, `actor`, `none`  |
| `CardType.shapeForm` (card family) | the shape type id an in-between type draws as: `decision` → `diamond`, `database` → `cylinder`, `document` → `document-shape` |
| Pack `shapes`                      | "Basic shapes", category `shapes`; 11 types + 2 tool tiles (Sticky, Frame) = 13 tiles                                         |
| `NEW_DECK_PACKS`                   | + `shapes`                                                                                                                    |

Helpers: `effectiveFamily(node)` (display if the type has two forms, else the type's family),
`shapeGeometryOf(node)` (the type's geometry, or its `shapeForm`'s geometry in shape form),
`hasTwoForms(typeId)`.

## Yjs document

`nodes/<id>/display`: scalar, written only when it differs from the type's family. Nothing else.

## Model API

| Method                                                            | Effect                                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `setNodeDisplay(nodeIds, display \| null)`                        | one undo step; removes the key when `display` equals the type's own family or is `null` |
| `groupSelection({ nodes: [], groups: [], title, parent, frame })` | existing op, now also called with empty lists by the Frame tool                         |

## Derived (never stored)

| Value                    | From                                   | Where                                  |
| ------------------------ | -------------------------------------- | -------------------------------------- |
| Outline path, lip path   | geometry + box                         | `shapes/shape-geometry.ts` `shapePath` |
| Connection points        | geometry + box + side (+ 022 fraction) | `outlinePoint`                         |
| Title box                | geometry + box                         | `titleBox`                             |
| Default and minimum size | geometry                               | registry table (research R1)           |

## State transitions

- **Form:** card ↔ shape for in-between types only; every other property unchanged.
- **Frame tool:** select → frame (tile) → drawing → group created + rename open → select.
