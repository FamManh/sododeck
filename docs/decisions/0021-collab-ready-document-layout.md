# 0021. A collaboration-ready deck document (layout 2)

- **Status:** Accepted
- **Date:** 2026-10-03
- **Feature:** `specs/036-collab-ready-document` (spec, research R1–R12, data model, contracts)
- **Amends:** 0005 §1 (layout), §2 (text) and its Consequences
- **Builds on:** 0007 (local storage and live multi-tab sync), 0013 (derived problems)
- **Related:** 0022 (schema roadmap)

## Context

The stored deck document (ADR 0005) was built for one tab at a time. Its own Consequences list
three limits that block real-time collaboration and a later sync server:

1. **Lists are arrays.** A reorder is delete + re-insert, so a concurrent edit of the moved item
   in another tab is lost and two tabs moving the same item can duplicate it. Lookups by id are
   linear.
2. **Text is a plain string.** Two people typing in one description keep only the later text.
3. **Nothing checks a change that arrives from elsewhere.** Two valid edits can combine into a
   deck that is invalid or noisy (a pin on a deleted node, a group frame naming no group).

The founder deferred file-format compatibility (ADR 0020, backlog 025): with no users yet, the
stored deck and the file format may change freely during development, and decks stored by
earlier builds are not migrated (design-analysis §g-81, §g-82). The `.sododeck.json` format does
not change in this feature.

## Decision

1. **Lists are stored by id with an order (R2).** Each collection root and every child list is a
   `Y.Map<id, Y.Map>`. The id is the map key (no `id` field inside). Same root names as before:

   | Root       | Type               | Contents                                                                            |
   | ---------- | ------------------ | ----------------------------------------------------------------------------------- |
   | `meta`     | `Y.Map`            | `$schema`, `version`, `name?`, `description` (`Y.Text`), `tags?`, `swatches`        |
   | `nodes`    | `Y.Map<id, Y.Map>` | one map per component                                                               |
   | `groups`   | `Y.Map<id, Y.Map>` | one map per group                                                                   |
   | `edges`    | `Y.Map<id, Y.Map>` | one map per connection                                                              |
   | `views`    | `Y.Map<id, Y.Map>` | view fields as before (lists → `Y.Array`; `positions`, `groupFrames` → `Y.Map`)     |
   | `features` | `Y.Map<id, Y.Map>` | one map per feature                                                                 |
   | `flows`    | `Y.Map<id, Y.Map>` | `steps`, `branches` → `Y.Map<id, Y.Map>`, always present                            |
   | `rules`    | `Y.Map<id, Y.Map>` | `inputs`, `outputs`, `rows` → `Y.Map<id, Y.Map>`, always present; row `cells` keyed |
   | `stickies` | `Y.Map<id, Y.Map>` | one map per note                                                                    |

   A delete removes the key, and with it anything a concurrent client wrote inside the item.
   Two clients writing the same fixed id (the view presets) converge on one entry.

2. **Order keys (R3).** Every list item carries `$order`, a base-62 fractional-index string
   (`order-key.ts`, our own implementation of the public-domain variable-length-integer scheme,
   no dependency). Lists read sorted by (`$order`, id) with plain code-unit comparison. A move or
   an insert writes one key between its neighbours. Two clients that generate the same key are
   ordered by id, the same on every client, with no write. A later insert between two tied items
   re-keys the tied run after it in the same transaction. A missing or malformed key sorts first;
   an op that cannot compute a key re-keys the whole list. Rules carry an order too, so every
   client writes the `rules` object in the same key order. The index-based API is unchanged: ops
   translate an index into neighbours on the sorted list.

3. **A flow's steps keep one flat order (R4).** Steps of every path share one order space, as
   the file's single array does, so the exported order is the stored order. Single-client ops
   keep the normal order as before. Concurrent edits can interleave paths (one client appends a
   main step while another splits the tail into branch "a"); `analyzeFlow` partitions by path, so
   numbering, playback and problems are not affected.

4. **Rule cells are keyed by column (R5).** A row stores `cells: Y.Map<columnId, string>`. On
   read, `when = inputs.map(c => cells.get(c.id) ?? '')` and `then` likewise, so every row has
   exactly one cell per column by construction. Adding a column writes no row; moving a column is
   one key change; two clients editing different cells of one row both keep their edit.

5. **Long text is `Y.Text` (R7).** Twelve fields — `description` on the deck, components,
   groups, connections, features, flows, steps, branches and rules; a step's `notes` and
   `payload`; a note's `text` — are `Y.Text` (`text-fields.ts`; a test keeps the table in step
   with every field the schema calls markdown). The `Y.Text` always exists, so two clients typing
   the first text of a field type into the same one. Writes are a minimal splice (common prefix
   and suffix kept, never splitting a surrogate pair); clearing deletes the characters and keeps
   the `Y.Text`. An empty text reads as absent, except when `$blank:<field>` is set: that marker
   keeps a value given explicitly as `""` (and `$blank:branches` a file's `branches: []`), so
   files round-trip byte for byte. Titles, labels and cells stay plain values: letter-merging two
   renames gives nonsense, so the last write wins.

6. **One reader, one writer (R8).** `read.ts` and `write.ts` hold all layout knowledge: order
   keys, markers, text and child lists. Every op, `toJSON`, the snapshot and `getObject` /
   `getRule` go through them; no op calls `fromY` / `toY` on a deck object. Keys starting with
   `$` are internal: never output, never reported in `DeckChange.keys`. `Y.Text`, order keys and
   markers never leave `packages/model`.

7. **The public API does not change (R1, R6).** Every editor method, error, undo grouping,
   `DeckChange` and the snapshot contract are as before. A reorder is still `updated` with no
   keys. The only additions are `isLegacyLayout` and `EditorOptions.repair`. The snapshot
   re-sorts a list only when an item was added, removed or moved.

8. **Check and repair on receive (R9).** Problems already follow every change, whatever its
   origin. The one write repair: after a change that is not the editor's own and that removed a
   component or group, or added or changed a view, `repairViewRefs` removes view entries naming a
   component or group that does not exist (`includes`, `pinned`, `positions`, `collapsed`,
   `excludeGroups`, `groupFrames`), dropping lists exactly where the local delete cascade drops
   them. It runs with the editor's untracked origin: saved and synced, never an undo step. Every
   client computes the same deletes and the repair's own transaction is local, so it settles in
   one round. Opening a deck never repairs. An empty `style` (each client cleared one channel) is
   read as no style. Everything else a person wrote is **kept and reported**: a connection, step
   or note pointing at a deleted object, a parent cycle, a step naming a removed branch. Undo of
   the delete makes it whole.

9. **Decks stored before this feature are refused, not migrated (R10).** `isLegacyLayout(doc)`
   recognises layout 1 by structure (a collection root holding list items, a rule whose `inputs`
   is a `Y.Array`, or a string `meta.description`). The deck loader returns `unsupported` and
   the editor shows "This deck was saved by an earlier development build and can't be opened.
   Import its exported .sododeck.json file again."; the library worker refuses export, rename
   and duplicate with `unsupported-deck`. Nothing stored is changed. There is no stored version
   marker: when 025 returns, "absent = layout 2" holds for every deck stored from now on. The
   missing migration is a recorded deviation from constitution II, waived by the founder
   (§g-81, §g-82). The export / import path is the upgrade path.

## Alternatives rejected

- **Keep `Y.Array` and add an order field** (R2): lookups stay linear and a move is still delete
  plus insert.
- **A separate `Y.Map<id, order>` per list** (R2): a move racing a delete leaves an orphan order
  entry to clean up; with the key inside the item, the delete simply wins.
- **Floating-point order** (R3): midpoints run out of precision after about 50 inserts at one
  spot and then need a renumbering pass that conflicts with concurrent edits.
- **A `fractional-indexing` dependency** (R3): the algorithm is about 120 lines and stable;
  constitution VIII prefers no new runtime dependency.
- **Create `Y.Text` on first use** (R7): two people starting a description at the same moment
  would each create one and one text would be lost.
- **Delete the key to clear a text** (R7): a concurrent typer's text would go with it.
- **An editor binding (y-codemirror, y-prosemirror)** (R7): the fields are plain textareas; a
  binding is a dependency and a rewrite of every field. The app's live field instead rebases its
  draft and caret onto an outside change.
- **Delete dangling connections like the local cascade** (R9): the person who drew the
  connection did not agree to lose it, and the deleter's undo could not bring it back.
- **Hide dangling view entries on read** (R9): a file arriving with one would lose it on export,
  and every view would be rebuilt whenever a component is added or removed.
- **A stored layout number or a one-off converter** (R10): ruled out by the founder for now.

## Consequences

- A move keeps concurrent edits of the moved item; a moved item is never duplicated; inserts at
  one place all survive in the same order on every client; a delete wins whole (contract
  guarantees 1–6, tested with two documents in both delivery orders).
- Long text merges letter by letter; undo reverts only the local characters.
- Lookups by id do not depend on deck size. At 10,000 components a field edit costs the same as
  at 500 and a move about 5 ms (budget 10 ms).
- The stored deck is bigger and slower to open: update bytes grow 17–23%, and opening a stored
  deck (decode, snapshot, `toJSON`) takes about 31–35% longer (500 components: ~8.5 → ~11.5 ms;
  2,000: ~33.5 → ~44 ms). This misses spec SC-006 (≤ 10%) and needs the founder's acceptance
  (`specs/036-collab-ready-document/bench-after.md`). The cost is structural (keyed entries, order
  keys, `Y.Text`), not the always-present empty texts.
- Every new list and every new markdown field uses this layout (ADR 0022).
- **Known last-write-wins spots (R11)**, recorded rather than solved:
  - The first creation of an optional nested container on one object by two clients at once
    (`view.positions`, `pinned`, `collapsed`, `tags`, `rules`, `ruleInputs`, `style`, `route`,
    `links`, a node's first `position`): one container wins. Edits to an existing container
    merge key by key.
  - View presets written by two clients at once: one entry per preset, but the losing client's
    first edit inside that preset is lost.
  - Short text (titles, labels, cells): by decision.
  - Plain lists edited as a whole (`tags`, `links`, view filters): replaced as one value.
  - Key order of map-like objects (`view.positions`, `groupFrames`, `ruleInputs`): after two
    clients add keys at once, their exports can list the same keys in a different order.
- Decks stored by builds before 036 cannot be opened; they must be exported on an older build
  and imported again.
