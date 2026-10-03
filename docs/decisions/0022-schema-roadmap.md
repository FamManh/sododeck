# 0022. Schema roadmap for connections, tags, card types and typed fields

- **Status:** Accepted (as a roadmap; each row is confirmed by its own feature)
- **Date:** 2026-10-03
- **Feature:** `specs/036-collab-ready-document` (spec FR-024, FR-025, `contracts/schema-roadmap.md`)
- **Builds on:** 0002 (JSON file format), 0004 (schema v1 shape), 0018 (`ColorRef`), 0019 (card
  size and connector route), 0020 (format compatibility, deferred), 0021 (stored layout 2)

## Context

Five planned features change `.sododeck.json`: 029 (line type), 022 (connector style), 033 (tag
colours), 030 (card types and packs, with 031's shapes) and 032 (typed fields). Each would
otherwise pick its own field names and shapes in isolation. If two of them clash, a field gets
renamed or moved later, and files valid today could stop being valid.

036 changes how the document is stored (ADR 0021: lists stored by id with a fractional order key
`$order`, long markdown text as `Y.Text`, `$blank:<field>` markers, rule cells keyed by column
id). That is the moment to fix how the next five changes fit the file and the stored layout, so
none of them has to undo another.

036 adds none of these fields. This ADR is a roadmap: each row is added by its own feature, with
its own tests, and may still be refined in that feature's spec.

## Decision

### Rules for every row

- **Additive and optional.** An absent field means today's behaviour. `version` stays `1`.
- **Identity and order.** Objects with identity (field definitions) get stable ids. Lists that
  users order are stored by id and order key in the document (layout 2, ADR 0021) and written as
  arrays in the file.
- **Colours** are always a `ColorRef`: a named card colour or a deck hex colour (ADR 0018).
- **No format revision number** for now (ADR 0020 is deferred, §g-81).

### Connections (029, 022)

| Field                  | Type                              | Added by | Absent means                                                                          |
| ---------------------- | --------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `edge.style`           | object, at least one key          | 029      | default look                                                                          |
| `edge.style.shape`     | `curved` \| `elbow` \| `straight` | 029      | `curved`; `elbow` when the connection has a stored `route.offset` (keeps a 017 tweak) |
| `edge.style.dash`      | `solid` \| `dashed` \| `dotted`   | 022      | `solid`                                                                               |
| `edge.style.width`     | `1` \| `1.5` \| `2` \| `3` \| `4` | 022      | 2 (the canvas line since 029)                                                         |
| `edge.style.color`     | `ColorRef`                        | 022      | the theme's connector colour                                                          |
| `edge.style.animated`  | boolean                           | 022      | `false`                                                                               |
| `edge.route.waypoints` | `RouteWaypoint[]`, relative       | 022      | no bend points; `offset` (017) still applies to an elbow line without waypoints       |
| `edge.route.fromAt`    | number, 0–1                       | 022      | the middle of `fromSide` (0.5). Only meaningful with `fromSide`.                      |
| `edge.route.toAt`      | number, 0–1                       | 022      | the middle of `toSide`                                                                |
| `edge.labelAt`         | number, 0–1                       | 022      | 0.5 (the middle of the path)                                                          |

- 029 and 022 share `edge.style`. 029 creates the object with `shape`; 022 adds keys to it.
- **Confirmed by 029** (shipped 2026-10-03, `edge.style.shape` as in the row above, no version
  bump). Refinements: the model stores `shape` explicitly for every choice except `curved` on a
  connection with no `route.offset`, where it removes the key (and an emptied `style`); the
  effective shape is `edgeShape(edge)` in `@sododeck/model`, used by the canvas, the merged edge
  and the export. Switching away from `elbow` never touches `route`, so switching back restores the
  offset. Resetting or dropping a route offset on a connection that is elbow only by that default
  first writes `shape: 'elbow'` in the same transaction ("reset-route pinning"), so the line does
  not turn curved. An empty `style` object is invalid; the Zod generator drops `minProperties`, so
  semantic rule **S7** reports it (S6 is the same rule for card styles).
- `route` keeps `fromSide`, `toSide` and `offset` with their 017 meaning (ADR 0019).
- **Built by 022** (2026-10-03, ADR 0024). Refinements: `waypoints` items are relative to the two
  card centres (`x` / `dx`, `y` / `dy`), not `Position`; `width` is one of 1, 1.5, 2, 3, 4 with 2
  the default; defaults are never stored; rules S9 (anchor needs its side), S10 (`offset` xor
  `waypoints`) and S11 (non-empty list, one key per axis) live in `semantic-rules.ts`; the first
  bend edit converts an `offset` into two bends and pins `elbow`.
- Reserved, not scheduled: `edge.relation` (calls / reads / writes / depends on, with 034's
  legend).

### Tags (033)

| Field       | Type                          | Added by    | Absent means            |
| ----------- | ----------------------------- | ----------- | ----------------------- |
| `tagColors` | object: tag text → `ColorRef` | 033 (built) | every tag renders slate |

- `tagColors` sits at the root, right after `swatches`, next to the deck's own `tags`, which stay "tags of the deck".
- Built by 033 with no version bump. A file with `tagColors` is rejected by earlier app versions (root `additionalProperties: false`); compatibility is 025's.
- **S8** (semantic rule, `semantic-rules.ts`): no empty key, and no two keys equal after trim, space-collapse and lower-casing.
- The app writes entries sorted by tag key (not in colouring order), so every replica reads and exports the same bytes after concurrent edits (ADR 0021 guarantee); a hand-ordered file keeps its content and loses only the key order.
- **Rename and delete rewrite every carrier** in one transaction and one undo step: cards, connections, flows, steps, the deck's `tags`, every view's `excludeTags`, and the colour entry. Renaming onto an existing key merges onto that tag's spelling and colour. Repeats inside a list are dropped, so a merge never adds tags to a card.
- **Display spelling** of a tag: the `tagColors` key if it has one, else the first spelling in deck order (cards, connections, flows, steps, deck tags). Text typed for a tag that already exists is written in that spelling. Tag pills on a card follow the tag's colour (slate when none), not the card's.
- A tag is still its text on each object; `node.tags` and the other `tags` fields do not change.
- The key is the tag as first typed, with its case kept. Matching ignores case, so no two keys
  may be equal when case is ignored (a semantic rule).
- A tag with no entry is valid. Renaming or deleting a tag rewrites the objects that carry it, in
  one undo step.

### Card types and packs (030, 031)

| Field                                | Type                           | Added by    | Absent means                                                                                       |
| ------------------------------------ | ------------------------------ | ----------- | -------------------------------------------------------------------------------------------------- |
| `node.type`                          | a type id (was a 6-value enum) | 030 (built) | n/a (still required). Today's six kinds are type ids of the built-in Architecture pack, unchanged. |
| `packs`                              | string[] (pack ids), unique    | 030 (built) | `["architecture"]`                                                                                 |
| `view.excludeKinds`, `view.dimKinds` | type ids (were the enum)       | 030 (built) | unchanged                                                                                          |
| `node.display`                       | `card` \| `shape`              | 031         | the type's own family                                                                              |

- Built by 030 with no version bump (ADR 0025). Refined: type and pack ids share the pattern `^[a-z][a-z0-9-]{0,47}$` (`$defs/TypeId`, `$defs/PackId`), `packs` has at least one id, and the model reports `unknown-card-type` and `unknown-pack` problems.
- Types and packs are defined in code (a registry), not in the file.
- A type id the app does not know renders as a generic card and is reported in Problems. The file
  still loads.
- User-defined types are out of scope. If they come, they are a root `types` list of objects with
  ids, and `node.type` keeps pointing at an id.

### Typed fields (032)

| Field              | Type                                                                                                    | Added by | Absent means             |
| ------------------ | ------------------------------------------------------------------------------------------------------- | -------- | ------------------------ |
| `fields`           | list of field definitions                                                                               | 032      | only the built-in fields |
| `fields[].id`      | id                                                                                                      | 032      | n/a (required)           |
| `fields[].name`    | text                                                                                                    | 032      | n/a (required)           |
| `fields[].kind`    | `text` \| `number` \| `select` \| `status` \| `person` \| `date` \| `dateRange` \| `link` \| `progress` | 032      | n/a (required)           |
| `fields[].options` | list of `{ id, label, color? }` (select and status)                                                     | 032      | no options               |
| `fields[].types`   | type ids the field applies to                                                                           | 032      | every type               |
| `fields[].onCard`  | boolean                                                                                                 | 032      | `false` (drawer only)    |
| `node.values`      | object: field id → value                                                                                | 032      | no values                |

- Values by kind: a string for text, person, date (`YYYY-MM-DD`) and select / status (an option
  id); a number for number and progress (0–100); `{ from, to }` for a date range;
  `{ url, label? }` for a link.
- Today's `tech`, `host`, `owner`, `tags` and `links` keep their fields and storage. The type
  registry lists them as a type's built-in fields.
- A value whose field or option no longer exists is kept and reported, like any dangling
  reference.

### Standing decisions

- **Deck identity.** A deck's library id (a UUID from `crypto.randomUUID()`) is its global
  identity: the name a sync server will know the deck by. It is never reused and is not stored
  inside the deck file.
- **Collapsed groups are shared.** A view's `collapsed` list is document data: collapsing a group
  in a view collapses it for everyone looking at that view (founder, 2026-10-03). It stays outside
  undo. Per-person collapse would be presence-like state, decided with the server feature.
- **New lists and long text use layout 2.** New lists and new markdown fields added by these
  features use the layout of ADR 0021 (stored by id with an order key; `Y.Text`): `fields`,
  `fields[].options`, and any future description field.

## Alternatives considered

- **Let each feature decide its own fields:** simpler now, but 029 and 022 both touch `edge.style`
  and 030 and 032 both depend on type ids. Deciding them apart risks a rename later.
- **Tag definitions inside `deck.tags`:** would change the meaning of an existing field and break
  files that store plain strings there. A separate root `tagColors` map is additive.
- **Card types and packs in the file:** makes every deck carry definitions the app already has.
  The registry stays in code until user-defined types are needed.
- **A `version` bump for these changes:** unnecessary while every change is additive and optional
  (ADR 0002); compatibility handling stays deferred (ADR 0020).

## Consequences

- Each of 029, 022, 033, 030, 031 and 032 still writes its own schema change, `pnpm
schema:generate`, Ajv/Zod parity and round-trip cases, and confirms or refines its rows here.
- A feature that needs to change a row (a name, a type, a default) updates this ADR in the same
  change.
- Files valid today stay valid after all five changes; no field is renamed or moved.
- `fields` and `fields[].options` are added as layout-2 lists from the start, so 032 needs no
  later storage change.
- The deck's library id is the key a future sync server uses; the deck file stays free of it.
