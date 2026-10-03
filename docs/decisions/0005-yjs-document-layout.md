# 0005. Yjs document layout and editing policy

- **Status:** Accepted
- **Date:** 2026-09-27
- **Feature:** `specs/002-yjs-model` (spec incl. clarifications, research R1–R10, data model)
- **Amended by:** ADR 0021 (layout 2: lists stored by id with order keys, long text as `Y.Text`, rule cells keyed by column, repair on receive; replaces §1, §2 and the Consequences below); ADR 0012 (views gain `Y.Array` fields `excludeGroups`, `excludeKinds`, `excludeTags`, `dimKinds`, `pinned` and `collapsed`; `collapsed` is written with an untracked origin)

## Context

`@sododeck/model` holds the live deck as a Yjs document. Every surface (canvas, JSON panel,
inspector, rule editor) reads and edits it. From feature 005 on, this document is persisted in
IndexedDB, so its layout becomes stored data: changing it later needs a migration of saved decks.
The model also has to decide what a delete does to objects that point at the deleted one, how ids
are made, what undo covers, and in which key order files are written. These choices shape every
later feature and the files users commit to git.

## Decision

1. **Layout.** _Replaced by ADR 0021 §1–§4 (layout 2). The original text follows._ One root type per part of the file:

   | Root       | Yjs type                   | Contents                                                                    |
   | ---------- | -------------------------- | --------------------------------------------------------------------------- |
   | `meta`     | `Y.Map`                    | `$schema`, `version`, `name?`, `description?`, `tags?` (Y.Array)            |
   | `nodes`    | `Y.Array<Y.Map>`           | one map per node, file order                                                |
   | `groups`   | `Y.Array<Y.Map>`           | one map per group                                                           |
   | `edges`    | `Y.Array<Y.Map>`           | one map per edge                                                            |
   | `views`    | `Y.Array<Y.Map>`           | `includes` → Y.Array, `positions` → Y.Map(node id → Y.Map x,y)              |
   | `features` | `Y.Array<Y.Map>`           | one map per feature                                                         |
   | `flows`    | `Y.Array<Y.Map>`           | `steps` → Y.Array<Y.Map>; step `ruleInputs` → nested Y.Map                  |
   | `rules`    | `Y.Map<Y.Map>` (id → rule) | `inputs`/`outputs`/`rows` → Y.Array<Y.Map>; `when`/`then` → Y.Array<string> |
   | `stickies` | `Y.Array<Y.Map>`           | one map per sticky                                                          |

   Nested objects become `Y.Map` and arrays become `Y.Array`, so every field merges on its own.
   Optional fields are absent when unset, never stored as `null`. The layout is documented at the
   top of `packages/model/src/deck.ts`.

2. _Replaced by ADR 0021 §5: long markdown text is `Y.Text`; short text stays last write wins._ **Text is a plain string; the last write wins per field.** Titles, descriptions and cells are
   not `Y.Text`. Two tabs editing the same field converge on the later write; edits to other
   fields of the object are kept. `Y.Text` would merge letter by letter, but collaboration is
   post-MVP and it complicates every read and write. Upgrade path: switch the long markdown
   fields (at least) to `Y.Text` with a new ADR and a migration of saved decks before real-time
   collaboration ships. The public API returns plain strings, so surfaces do not change.

3. **Ids.** Generated ids are `<type>-<10 random base-36 chars>` from `crypto.getRandomValues`
   (`node-k3j9x0q2ab`, `edge-…`, `step-…`, `rule-…`, `col-…`, `row-…`, `sticky-…`), unique across
   the whole deck so a sticky anchor is unambiguous. They are never derived from a title and never
   rewritten. An explicit id (paste, import) must not exist anywhere in the deck.

4. **Delete cascade.** Structural objects that cannot exist without their target are removed:
   edges of a deleted node, steps of a deleted flow. Knowledge objects are **kept and reported
   broken**: steps whose edge is gone, stickies whose anchor is gone. Deleting a group **re-parents**
   its nodes and child groups to its own parent. Deleting a rule detaches it from nodes and steps
   and drops its sample inputs. Lists and optional references are cleaned (view `includes` and
   `positions`, node `parent`, `feature` on flows and views). The full table is in
   `specs/002-yjs-model/data-model.md`. Every delete with its cascade is one transaction: one
   change event, one undo step.

5. **Load checks.** A file with duplicate ids (within a collection, a flow's steps, a rule's
   columns or rows) is **refused**, naming the id and every location. It is never auto-renamed:
   a duplicate makes every reference to that id ambiguous. Dangling references do load; they
   appear in `checkIntegrity()` so users can repair rather than lose a file.

6. **Canonical key order.** `toJSON` and `serializeDeck` rebuild every object in the declaration
   order of `properties` in `v1.json` (ADR 0004 §10), derived by walking the schema at runtime.
   Map-like objects (`rules`, `positions`, `ruleInputs`) keep their own order. Output is byte-stable
   whatever order the Y.Maps hold their keys in.

7. **Undo scope.** Each editor has one `Y.UndoManager` over all root types that tracks only the
   editor's own transaction origin. Loads, other tabs and future collaborators are never undone.
   Edits to one object within 500 ms are one step; an edit to another object, a structural edit,
   a `batch` or a `beginGesture`/`endGesture` span always starts a new step.

8. **Validate before write.** Yjs transactions cannot be rolled back, so every operation builds
   its candidate object, checks it with the generated Zod from `@sododeck/schema` and checks new
   references, and only then writes. A refused edit leaves the deck untouched.

## Consequences

_ADR 0021 removes the first, second and fourth limits below (reorder, duplicate on move, linear
lookup) and replaces the migration rule: layout changes are recorded in an ADR; decks stored
before 036 are refused, not migrated (§g-81, §g-82)._

- The layout is now a storage contract. Any change (e.g. `Y.Text`, collections keyed by id) needs
  an ADR and a migration of persisted decks.
- Reorder is delete + re-insert (Yjs has no move). A concurrent edit of the moved object in
  another tab is lost, and two tabs moving the same item can duplicate it. Acceptable until
  collaboration is designed.
- Steps and stickies can point at missing objects after a delete; every surface must render them
  as broken and 015 must list them.
- Id lookup is linear in the collection size. At 500 nodes / 1,000 edges a single edit takes well
  under a millisecond; revisit if decks grow by orders of magnitude.
