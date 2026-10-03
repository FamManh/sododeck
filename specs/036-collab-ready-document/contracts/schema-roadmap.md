# Contract: schema roadmap (draft of ADR 0022)

What the next five format changes add to `.sododeck.json` (spec FR-024, FR-025). **Nothing here is
added by 036**; each row is added by its own feature, with its own tests, and may still be refined
in that feature's spec. The point is that the five changes fit one design: no field is renamed or
moved later, and files valid today stay valid.

Rules for every row:

- Additive and optional: an absent field means today's behaviour. `version` stays `1`.
- Objects with identity (field definitions) get stable ids; lists that users order are stored by
  id and order key in the document (this feature's layout) and written as arrays in the file.
- Colours are always a `ColorRef` (a named card colour or a deck hex colour, ADR 0018).
- No format revision number for now (ADR 0020 deferred, §g-81).

## Connections (029, 022)

| Field                  | Type                              | Added by | Absent means                                                                          |
| ---------------------- | --------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `edge.style`           | object, at least one key          | 029      | default look                                                                          |
| `edge.style.shape`     | `curved` \| `elbow` \| `straight` | 029      | `curved`; `elbow` when the connection has a stored `route.offset` (keeps a 017 tweak) |
| `edge.style.dash`      | `solid` \| `dashed` \| `dotted`   | 022      | `solid`                                                                               |
| `edge.style.width`     | number, 1–6                       | 022      | the theme's connector width                                                           |
| `edge.style.color`     | `ColorRef`                        | 022      | the theme's connector colour                                                          |
| `edge.style.animated`  | boolean                           | 022      | `false`                                                                               |
| `edge.route.waypoints` | `Position[]`                      | 022      | no bend points; `offset` (017) still applies to an elbow line without waypoints       |
| `edge.route.fromAt`    | number, 0–1                       | 022      | the middle of `fromSide` (0.5). Only meaningful with `fromSide`.                      |
| `edge.route.toAt`      | number, 0–1                       | 022      | the middle of `toSide`                                                                |
| `edge.labelAt`         | number, 0–1                       | 022      | 0.5 (the middle of the path)                                                          |

029 and 022 share `edge.style`: 029 creates the object with `shape`; 022 adds keys to it. `route`
keeps `fromSide`, `toSide` and `offset` with their 017 meaning. Reserved for later, not scheduled:
`edge.relation` (calls / reads / writes / depends on, with 034's legend).

## Tags (033)

| Field       | Type                          | Added by | Absent means              |
| ----------- | ----------------------------- | -------- | ------------------------- |
| `tagColors` | object: tag text → `ColorRef` | 033      | every tag renders neutral |

- Root-level, next to the deck's own `tags` (which stays "tags of the deck").
- A tag is still its text on each object (`node.tags` and the others are unchanged). The key is
  the tag as first typed; case is kept; matching ignores case, so no two keys may be equal when
  case is ignored (a semantic rule).
- A tag with no entry is valid. Renaming or deleting a tag rewrites the objects that carry it, in
  one undo step.

## Card types and packs (030, 031)

| Field                                | Type                           | Added by | Absent means                                                                                       |
| ------------------------------------ | ------------------------------ | -------- | -------------------------------------------------------------------------------------------------- |
| `node.type`                          | a type id (was a 6-value enum) | 030      | n/a (still required). Today's six kinds are type ids of the built-in Architecture pack, unchanged. |
| `packs`                              | string[] (pack ids), unique    | 030      | `["architecture"]`                                                                                 |
| `view.excludeKinds`, `view.dimKinds` | type ids (were the enum)       | 030      | unchanged                                                                                          |
| `node.display`                       | `card` \| `shape`              | 031      | the type's own family                                                                              |

- Types and packs are defined in code (a registry), not in the file. A type id unknown to the app
  renders as a generic card and is reported in Problems; the file still loads.
- User-defined types are out of scope; if they come, they are a root `types` list of objects
  with ids, and `node.type` keeps pointing at an id.

## Typed fields (032)

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

- Values by kind: string (text, person, date as `YYYY-MM-DD`, select / status as an option id),
  number (number, progress 0–100), `{ from, to }` (date range), `{ url, label? }` (link).
- Today's `tech`, `host`, `owner`, `tags` and `links` keep their fields and storage; the type
  registry lists them as a type's built-in fields.
- A value whose field or option no longer exists is kept and reported, like any dangling
  reference.

## Standing decisions recorded with the roadmap

- **Deck identity.** A deck's library id (a UUID from `crypto.randomUUID()`) is its global
  identity: the name a sync server will know the deck by. It is never reused and is not stored
  inside the deck file.
- **Collapsed groups are shared.** A view's `collapsed` list is document data: collapsing a group
  in a view collapses it for everyone looking at that view (founder, 2026-10-03). It stays
  outside undo. Per-person collapse would be presence-like state, decided with the server feature.
- **Order and long text.** New lists and new markdown fields added by these features use the
  layout of this feature (id-keyed, order key; `Y.Text`): `fields`, `fields[].options`, and any
  future description field.
