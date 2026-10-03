# Data Model: Deck Tag Colours (033)

## Stored (file format, schema v1, additive)

### `tagColors` (root, optional)

| Part  | Type                            | Rules                                                                                                    |
| ----- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| key   | string                          | The tag as first typed, case kept. Non-empty after trimming (S8).                                        |
| value | `ColorRef` (named or `#rrggbb`) | One of the 13 `CardColor` names or a lowercase 6-digit hex (existing `$defs/ColorRef`).                  |
| map   | object                          | No two keys equal when case is ignored (S8). Absent means every tag is slate. Declared after `swatches`. |

- A key with no card carrying the tag is valid and stays listed with count 0 until deleted.
- A hex value need not be in `swatches`; it stays valid if the swatch is removed.
- Tags on objects (`node.tags`, `edge.tags`, `flow.tags`, `step.tags`, root `tags`, `view.excludeTags`) are unchanged plain text arrays.

Example:

```json
{
  "swatches": ["#7a3cff"],
  "tagColors": { "PCI": "violet", "Lan": "#7a3cff" },
  "nodes": [{ "id": "n1", "type": "service", "title": "Payments", "tags": ["PCI", "pic"] }]
}
```

Here "pic" and "PCI" are different tags; "PIC" and "pic" would be one.

### Yjs layout (ADR 0021, one added line)

`meta` map gains `tagColors`: `Y.Map<string>` (tag → colour string), always present after `fromJSON`, created lazily and attached on first write for stored documents that predate it. `readMeta` emits it only when it has entries.

## Derived (never stored)

| Name          | Fields                                                        | Source and rule                                                                                                   |
| ------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `tagKey`      | string                                                        | `trim`, collapse spaces, `toLowerCase`. Identity of a tag.                                                        |
| `DeckTag`     | `tag` (display spelling), `key`, `count` (cards), `color?`    | One per key over card tags and `tagColors`. Display spelling: the `tagColors` key, else first seen in deck order. |
| `TagUsage`    | `cards`, `connections`, `flows`, `steps`, `deckTag` (boolean) | Counts of carriers with the tag's key, for confirmation lines.                                                    |
| `TagColours`  | `chip`, `ink`, `dot` (CSS values)                             | From a `ColorRef`; none gives the slate tokens; hex gets a readable ink.                                          |
| Card tag view | `{ text, chip, ink, dot }[]`, first 10                        | In node data from `toFlowNodes`.                                                                                  |

## Validation rules

1. A card holds at most 10 tags (app write path, as today; older files may hold more and are left alone).
2. Tag text is trimmed and single-spaced; empty is refused. The existing maximum length of `Text` applies.
3. Adding text whose key exists writes the display spelling, never a second spelling.
4. `setTagColor` accepts only a valid `ColorRef`; `null` removes the entry.
5. `renameTag` to an empty name is refused; to an existing key merges (R3); to the same key with a different case only respelled.
6. S8 on load: a file with an empty key or two keys equal ignoring case is invalid with a path to the key.

## State transitions (one undo step each)

| Action                      | Colour map                                                    | Carriers                                                                                 |
| --------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Set colour                  | entry added / replaced under the existing spelling            | none                                                                                     |
| Clear colour                | entry removed                                                 | none                                                                                     |
| Rename (new key)            | entry moved to the new key                                    | every spelling of the old key becomes the new text; duplicates inside a list are dropped |
| Rename (case only)          | key respelled                                                 | every spelling becomes the new text                                                      |
| Rename onto an existing key | the existing key and colour are kept; the other entry removed | carriers get the existing spelling; duplicates dropped; `excludeTags` entries merged     |
| Delete                      | entry removed                                                 | tag removed from every carrier and `excludeTags`; an emptied array is dropped            |

Merging never raises a card above the tags it had (a card carrying both ends with one).
