# Data Model: Card Types and Packs (030)

Decisions in [research.md](research.md) R1–R4, R7. No version bump (ADR 0022, §g-81). Every file
valid before 030 stays valid and is written byte-identical until the user changes packs.

## File format (`packages/schema/schema/v1.json`)

| Change                               | Before       | After                                                                                    |
| ------------------------------------ | ------------ | ---------------------------------------------------------------------------------------- |
| `$defs/NodeKind`                     | enum of 6    | **removed**                                                                              |
| `$defs/TypeId`                       | —            | string, `^[a-z][a-z0-9-]{0,47}$`; description lists the built-in ids                     |
| `$defs/PackId`                       | —            | string, same pattern                                                                     |
| `Node.type`                          | `NodeKind`   | `TypeId` (still required)                                                                |
| `View.excludeKinds`, `View.dimKinds` | `NodeKind[]` | `TypeId[]` (key names unchanged)                                                         |
| root `packs`                         | —            | `PackId[]`, `uniqueItems`, `minItems: 1`, after `tagColors`; absent = `["architecture"]` |

Fixtures: valid decks with each new type, `packs` with one and four packs, an unknown type id
(`"robot"`) and an unknown pack id; invalid `packs: []`, duplicate pack ids, `type: "Service"`
(uppercase), `type: ""`, `type: "a b"`.

### Example

```json
{
  "version": 1,
  "name": "Fulfilment",
  "packs": ["architecture", "process", "logistics", "data"],
  "nodes": [
    { "id": "n_wh", "type": "warehouse", "title": "Warehouse HCM" },
    { "id": "n_route", "type": "truck-route", "title": "HCM → DN" },
    { "id": "n_api", "type": "service", "title": "Orders API" }
  ]
}
```

## App registry (`packages/model/src/card-types.ts`, not stored)

| Entity     | Fields                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `CardType` | `id: TypeId`, `name`, `pack: PackId`, `category: 'architecture' \| 'process' \| 'logistics' \| 'data'`, `family: 'card' \| 'shape'`, `order` |
| `Pack`     | `id: PackId`, `name`, `order`; type count derived                                                                                            |

Built-in ids (research R3): packs `architecture`, `process`, `logistics`, `data`; types `service`,
`database`, `gateway`, `client`, `queue`, `external`, `component`, `task`, `decision`, `document`,
`warehouse`, `truck-route`, `issue`. Shapes (`family: 'shape'`) and the `shapes` pack are added by 031. Default fields per type are added by 032.

Icons and tile tones live in `packages/ui/src/lib/icons.ts` `TYPE_STYLE` keyed by type id.

## Yjs document (ADR 0021)

| Stored at                             | Yjs type                              | Rule                                                                                                                                    |
| ------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `nodes/<id>/type`                     | scalar (unchanged)                    | any `TypeId`                                                                                                                            |
| `meta/packs`                          | nested `Y.Map<true>` keyed by pack id | created on the first pack change, or at creation of a new deck with every 030 pack; emitted in registry order, unknown ids sorted after |
| `views/<id>/excludeKinds`, `dimKinds` | unchanged                             | any `TypeId`                                                                                                                            |

## Model API (`DeckEditor`, one call = one undo step)

| Method                                                                 | Effect                                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `setPackOn(packId, on)`                                                | writes the pack map (materialising `LEGACY_PACKS` first if absent); refuses to turn off the last pack on  |
| existing node update (the `type` field, as the kind picker does today) | unchanged op; the schema now accepts any `TypeId`; one undo step for a multi-selection via `editor.batch` |

Pure helpers: `deckPacks(deck)` (absent → legacy), `typesOfPacks(packs)`, `cardType(id)`,
`isKnownType(id)`, `typeName(id)` (unknown → the id itself), `NEW_DECK_PACKS`.

## Problems (`packages/model/src/problems.ts`)

| Kind                | When                                   | Message                                 |
| ------------------- | -------------------------------------- | --------------------------------------- |
| `unknown-card-type` | a node's `type` is not in `CARD_TYPES` | "Unknown card type <id>" (cards listed) |
| `unknown-pack`      | `packs` holds an id not in `PACKS`     | "Unknown pack <id>"                     |

## State transitions

- **Deck packs:** absent (legacy: architecture) → (first toggle) explicit map → toggles; new deck
  starts explicit with all four. The last pack on cannot be turned off.
- **Card type:** any id → (picker) any id of a pack that is on; ids never change with names.
