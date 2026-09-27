# @sododeck/model

**Responsibility:** the deck document. Owns the Yjs structure and is the **only** place that converts Yjs ↔ `.sododeck.json`.

- `createDeck()` → empty `Y.Doc`.
- `fromJSON(input)` → validates with `@sododeck/schema`, returns a new `Y.Doc`. Throws `DeckValidationError`.
- `toJSON(doc)` → plain `SododeckFile` with canonical top-level key order. Optional deck `name`, `description`, `tags` live in the `meta` map and are emitted only when present.
- `serializeDeck(file)` → string for save/export.

## Rules

- Round-trip must be lossless: `toJSON(fromJSON(x))` deep-equals `x` for every valid file. Every new field or object type gets a round-trip test case.
- Ids are stable. Never derive ids from titles; never rewrite ids on rename.
- The Yjs layout is documented at the top of `src/deck.ts`. Changing it is a breaking change for persisted IndexedDB data; write an ADR and a migration.

## Boundaries

- No React, no DOM, no storage providers (y-indexeddb lives in `apps/app`). Must run in Node and in Web Workers.
- Does not define the file format (that is `@sododeck/schema`).

## Status

Skeleton. TODO(M1): typed accessors/mutations (addNode, renameNode, …), referential validation (edge → node, step → edge, anchor → object), undo manager scopes, per-object key order in `serializeDeck`.
