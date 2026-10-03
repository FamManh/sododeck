# Data Model: Typed Fields (032)

Decisions in [research.md](research.md) R1–R3, R6. No version bump (ADR 0022, §g-81). Absent data =
today's decks; nothing is written until the user sets a value or changes a field.

## File format (`packages/schema/schema/v1.json`)

| Where  | Key             | Type                                           | Absent means                          |
| ------ | --------------- | ---------------------------------------------- | ------------------------------------- |
| root   | `fields`        | `FieldDef[]` (after `packs`)                   | only built-in and code default fields |
| root   | `fieldDefaults` | `TypeId[]`, unique                             | every type uses its code defaults     |
| `Node` | `values`        | object: field id → `FieldValue` (after `host`) | no values                             |

### `FieldDef`

| Key       | Type                                                                                                    | Notes                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `id`      | `Id`                                                                                                    | stable; `tech` / `host` / `owner` reserved for built-ins; code defaults use `<type>.<name>` |
| `name`    | string, 1–64 chars                                                                                      | unique within a type ignoring case (app rule)                                               |
| `kind`    | `text` \| `number` \| `select` \| `status` \| `person` \| `date` \| `dateRange` \| `link` \| `progress` | built-ins fixed (S12)                                                                       |
| `types`   | `TypeId[]`                                                                                              | absent = every type                                                                         |
| `onCard`  | boolean                                                                                                 | absent = false                                                                              |
| `unit`    | string, ≤ 12 chars                                                                                      | number only (S12)                                                                           |
| `options` | `FieldOption[]`                                                                                         | select / status only (S12)                                                                  |

`FieldOption`: `{ id: Id, label: string (1–48), color?: ColorRef, icon?: StatusIcon }`;
`StatusIcon`: `circle` \| `circle-dashed` \| `circle-dot` \| `circle-check` \| `eye` \| `door-open`
(status only).

### `FieldValue` by kind

| Kind           | JSON                                                                            |
| -------------- | ------------------------------------------------------------------------------- |
| text, person   | string                                                                          |
| number         | number                                                                          |
| progress       | number 0–100                                                                    |
| select, status | option id (string)                                                              |
| date           | `"YYYY-MM-DD"`                                                                  |
| dateRange      | `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }` (`to ≥ from` checked by the app) |
| link           | `{ "url": string, "label"?: string }`                                           |

Values that do not match their field (missing field or option, wrong shape, progress outside
0–100) are valid JSON and reported as `field-value-dangling`.

### Semantic rules

- **S12** field ids unique; built-in ids keep their kind; `unit` only on number; `options` only on
  select / status; option ids unique within a field; `icon` only on status options.
- **S13** `values` keys are never `tech`, `host` or `owner`.

### Example

```json
{
  "fieldDefaults": ["warehouse"],
  "fields": [
    {
      "id": "warehouse.capacity",
      "name": "Capacity",
      "kind": "progress",
      "types": ["warehouse"],
      "onCard": true
    },
    {
      "id": "warehouse.sla",
      "name": "SLA",
      "kind": "number",
      "unit": "h",
      "types": ["warehouse"],
      "onCard": true
    },
    {
      "id": "warehouse.region",
      "name": "Region",
      "kind": "select",
      "types": ["warehouse"],
      "onCard": true,
      "options": [{ "id": "o_south", "label": "South", "color": "amber" }]
    },
    {
      "id": "f_temp",
      "name": "Temperature zone",
      "kind": "select",
      "types": ["warehouse"],
      "options": [
        { "id": "o_amb", "label": "Ambient" },
        { "id": "o_frz", "label": "Frozen", "color": "cyan" }
      ]
    },
    { "id": "owner", "name": "Owner", "kind": "person", "onCard": true }
  ],
  "nodes": [
    {
      "id": "n_wh",
      "type": "warehouse",
      "title": "Warehouse HCM",
      "owner": "Minh Tran",
      "values": { "warehouse.capacity": 82, "warehouse.sla": 24, "warehouse.region": "o_south" }
    }
  ]
}
```

The `owner` entry stores only its order and on-card choice; built-in names and kinds are fixed (S12).

## Code fields (`packages/model/src/card-types.ts`, `fields.ts`; not stored)

- `BUILT_IN_FIELDS`: `tech` (text, Architecture types), `host` (text, Architecture types), `owner`
  (person, every type); all `onCard: false`.
- `CardType.defaultFields`: the founder's table (spec Clarifications): ids, names, kinds, units,
  on-card choices; Region starts with no options; Status starts with To do (slate, `circle`),
  In progress (blue, `circle-dot`), Done (green, `circle-check`).

## Yjs document (ADR 0021)

| Stored at                 | Yjs type                                                 | Rule                                            |
| ------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| `meta/fields` (root list) | layout-2 list, items with `$order`; `options` child list | created on first field change                   |
| `meta/fieldDefaults`      | `Y.Map<true>`                                            | created when a type's defaults are materialised |
| `nodes/<id>/values`       | nested `Y.Map`                                           | key by key; removed when empty                  |

## Model API (`DeckEditor`, one call = one undo step)

See [contracts/fields-api.md](contracts/fields-api.md): `addField`, `updateField`, `moveField`,
`deleteField`, `addOption`, `updateOption`, `moveOption`, `deleteOption`, `changeFieldKind`,
`setValues`; pure `fieldsOfType`, `cardFieldView`, `convertValue`, `personSuggestions`,
`canonicalPerson`, `validateValue`.

## State transitions

- **Type fields:** code defaults → (first change of any default field of the type) materialised in
  `fields` + `fieldDefaults` → edited / deleted like user fields.
- **Field kind:** any → any via `changeFieldKind` (convert or clear, one step).
- **Value:** absent ↔ set; cleared when its field or option is deleted (one step with the delete).
