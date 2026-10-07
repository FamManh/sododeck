# 0047. Applying a changed deck file to an open deck

- **Status:** Accepted
- **Date:** 2026-10-07
- **Feature:** 066 (`specs/066-model-apply-file/`)
- **Amends:** nothing; adds to ADR 0021 (layout 2) and ADR 0039 (import problem entries)

## Context

Editor hosts (067+) and the agent bridge (065) need to bring a deck file changed outside the
editor into the open document without reopening it: selection, snapshot identity and the user's
undo history must survive. There is no common base to merge against: the host only has the file
as it is now.

## Decision

1. **The file wins, field by field, with no common base.** `applyFile(doc, input, origin)` makes
   the document read exactly as `loadDeck(input).doc` would (`serializeDeck` byte-equal), writing
   only what differs, matched by id at every level: collections, rules, flow steps and branches,
   rule columns and rows (cells by column id), table columns, indexes and checks, field
   definitions and options, enums and values, nested records and meta. A three-way merge is later.
2. **The target is read, not re-derived.** The prepared file is built into a throwaway document and
   read back with `toJSON`; the open document is compared with that through the same reader. Every
   load normalisation (empty style, empty `values`, pack order, unknown `source`, picture facts)
   stays the reader's own rule. An equal file returns `changed: false` without a transaction, so
   an echo emits no event and no save.
3. **Untracked caller origin, never undone.** The write runs in one transaction with the caller's
   origin. An editor origin throws `TypeError` (it would make the change undoable). Observers see
   `'remote'`. The change is never in an undo stack and never ends or splits the user's current
   undo step, like storage loads and other tabs.
4. **A changed long text gets a fresh `Y.Text`.** Splicing the file's value into the stored text
   (what `writeText` does for user edits) lets a later user undo remove their own characters from
   the merged text, leaving a value that matches neither the file nor the user (checked with Yjs:
   `"hello world!" + " x"` typed, file appends `Y`, undo gives `"hello world!Y"`). With a fresh
   `Y.Text` the undo works on the detached old text and the field keeps the file's value. Cost:
   two tabs typing in that one field while a file lands fall back to last writer wins for it.
5. **Order by longest increasing run.** For every ordered list, ids absent from the file are
   removed, the longest run of kept items already in file order keeps its order keys, and every
   other kept or new item gets one key between its placed neighbours. One moved item is one key
   write; untouched siblings report no change. Tied or malformed keys re-key the list whole.
6. **Picture facts are never removed.** `meta.assets` entries are written for every picture the
   file lists (a damaged one as its placeholder, a `data: ''` one with its own facts) and never
   deleted, so an undone image delete still finds its picture; `toJSON` emits only pictures images
   use. Bytes come back in the result for the caller's blob store.
7. **Locks are ignored.** The file is validated as a whole; per-op checks, cascades and locks of
   the editor do not apply.
8. **`prepareDeck` is split out of `loadDeck`.** Picture repair → crop trim → validation → legacy
   note upgrade is one pure, exported function (`loadDeck = buildDoc(prepareDeck(input))`), so a
   host can validate in a worker and pass the branded result to `applyFile`. Invalid input is
   refused with the same 062 problem entries an import shows; `applyDeckText` adds the text half
   (BOM, `invalid-json`, `unsupported-version`).

## Consequences

- A new stored list or nested map must be added to the apply diff; the pairwise corpus round trip
  and the generated-edit test fail otherwise.
- The backlog draft's "one undo step for the outside change" is replaced by the clarified rule
  (spec 066): outside changes are not undoable in the editor.
- Measured on the 500-node / 1,000-edge deck (Apple M5, Node 26): one changed field 24 ms, every
  node, edge and step changed 28 ms, an equal file 19 ms (budgets 50 ms / 1 s).
