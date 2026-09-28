# 0013. Derived problems, checked in a worker, never stored

- **Status:** Accepted
- **Date:** 2026-09-28
- **Feature:** `specs/015-model-validation` (spec, research R1–R11, contracts)

## Context

Feature 015 shows users what is wrong in their model: orphan components, duplicate connections,
broken or incomplete flows, missing or incomplete rules and broken references, in a list, as
glyphs on the objects, and one keystroke away (⌘.). Several checks already existed in one place
each: referential integrity (002), flow chain breaks and empty branch fields (006, step list only)
and the rule catch-all check (008, rule editor only). Three constraints shape the design:

- Problems are derived and must never appear in the deck, the JSON panel or exports (§g-23).
- Bulk validation runs off the main thread (constitution V); a 2,000-component deck must not slow
  typing or dragging.
- The list is a panel of its own, because the canvas-first shell (018) moves it into a rail flyout.

## Decision

1. **One pure check in `@sododeck/model`.** `checkDeck(file)` returns `DeckProblems` (sorted list,
   total, `byObject` index). It reuses `analyzeFlow`, `ruleChecks` and `checkIntegrity` and adds
   orphans, duplicate connections and overlapping branch conditions. Integrity problems on
   `steps[].edge` and `steps[].branch` are dropped because `analyzeFlow` reports them (one cause,
   one problem). Keys are `kind` + ids, so ⌘. keeps its place while the deck changes.
2. **Computed in a module worker.** The app posts the latest deck snapshot to a problems worker,
   trailing-throttled at 150 ms, latest wins (a result for a superseded snapshot is dropped). One
   provider per open deck shares the result with the inspector list, the canvas button, glyphs,
   flow and rule rows and the ⌘. shortcut, on both the canvas and rules screens.
3. **Never stored.** Problems live in a derived store next to the snapshot, not in the document,
   not in Zustand (which only keeps the last visited problem key) and not in the JSON panel.
4. **One synchronous check per confirmed delete.** The Undo toast says how many new problems a
   delete created, so it counts before and after on the main thread (8 ms measured cold on a
   2,000-node deck, budget 30 ms). This is the only main-thread call.

## Alternatives considered

- **Checks in the app:** duplicates model logic and cannot be linted as worker-safe.
- **Extending `checkIntegrity`:** its callers (the delete preview) must not start reporting orphans
  or flow-shape problems.
- **Main thread with memoisation:** competes with drag frames on large decks (constitution V).
- **Worker only above a size threshold:** two code paths for little gain.
- **Updating the toast when the worker answers:** toasts are announced once; the count would be
  missed by screen readers.

## Consequences

- The flow row's own `analyzeFlow` call and clay marker are replaced by the shared amber glyph.
- Sample content that the existing rules consider broken (a request that returns to the gateway
  breaks the chain under 006's rule) now shows up deck-wide; whether that rule should allow
  "returns" is a product question for later.
- 018 can move `ProblemsPanel` without touching the checks.
