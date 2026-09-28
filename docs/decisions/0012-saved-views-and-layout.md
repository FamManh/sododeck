# 0012. Saved views, per-view positions and pinned auto-layout

- **Status:** Accepted
- **Date:** 2026-09-28
- **Feature:** `specs/011-views-autolayout` (spec, research R1–R9, R16, contracts)
- **Amends:** ADR 0005 (Yjs layout table: new `Y.Array` view fields) and ADR 0011 (collapse is no
  longer UI state; drill, focus and zoom still are).

## Context

Feature 011 makes one model readable through several saved lenses (System, Feature, Infra and
custom views), each with its own subtitle, filters, dimming, positions, pins and collapsed groups,
and adds a "Tidy layout" button that arranges a view without moving pinned components. The file
format already had `View` with `type`, `title`, `subtitleField`, `feature`, `includes` and
`positions`, but the app did not read views yet. Three constraints shape the design:

- Opening a deck or switching views must never change the document (FR-001, FR-005).
- Collapse state must be saved and synced, yet never be an undo step (FR-050).
- Layout runs off the main thread, and pinned components must not move (constitution V, SC-001).

## Decision

1. **Optional view fields only.** `View` gains `excludeGroups`, `excludeKinds`, `excludeTags`,
   `dimKinds`, `pinned` and `collapsed` (all unique lists, absent when empty), and `SubtitleField`
   gains `flows` ("<n> flows · <owner>"). No version bump: older files stay valid. Filters are
   stored as exclusions, not expanded into `includes`, so components added later are hidden too.
   In Yjs every new list is a `Y.Array` inside the view's `Y.Map`, like `includes`.

2. **Presets are data with fixed ids.** `VIEW_PRESETS` in `@sododeck/model` are three plain views
   with ids `system`, `feature` and `infra`. `resolveViews(file)` returns the stored views, or the
   presets when there are none. A view's `type` only picks its defaults and the tab tooltip; no
   behaviour depends on it (FR-002a).

3. **Presets are materialized on the first view change, outside undo history.** Every view op
   (`moveInView` in a non-base view, `setPinned`, `updateView`, `addView`, `removeView`,
   `setCollapsed`) first writes the three presets in their own transaction with a second,
   untracked editor origin, then applies the change. ⌘Z therefore undoes only the change and never
   removes saved views or their collapse state. Fixed ids keep the app's current view stable
   across materialization.

4. **The base view edits base positions; an override wins everywhere.** The first view is the base
   view. Moving components there writes `node.position` and drops that view's own entry; moving
   them in any other view writes `view.positions`. Every view, the base view included, draws a
   component at its own position when it has one, else at the base position. The base-view case
   matters only after the first view is deleted: the next view becomes the base and keeps its
   layout, and each later move there turns that component back into a base position.

5. **Collapse uses an untracked origin.** `setCollapsed` writes `view.collapsed` with the untracked
   origin: it is registered in `editorOrigins` (so `observeDeck` reports `local` here and `remote`
   in other tabs) but not in the `UndoManager`'s `trackedOrigins`. Undoing another edit never
   touches it, and undoing a view or group delete restores its collapse entries with it.

6. **The canvas reads a view-projected deck.** The app derives, per snapshot and current view, a
   canvas deck in which components carry their view position, and components hidden by the view's
   filters are left out (components without a position keep their grid slot from the full list).
   `visibleGraph`, group bounds, sticky placement and every other geometry helper then need no view
   argument, edges to hidden components drop out as edges to missing ends do, and a view with no
   overrides and no hidden components returns the snapshot itself, so System looks and costs
   exactly as before. Subtitles, dimming and pins reach `deck-to-flow` as a small `ViewRender`.

7. **Pins are enforced after ELK layout.** Tidy layout sends the visible components (a collapsed
   group as one card, only the drilled scope when drilled in) to the existing ELK worker as a
   `layered`, left-to-right compound graph with `INCLUDE_CHILDREN`, pinned components included so
   edges still shape the layers. A pure `applyPins` step then shifts the result by the median
   offset of the pins, puts pinned components back exactly, and runs a deterministic sweep that
   pushes free components right, then down, until nothing overlaps. The result is written with one
   `batch` of `moveInView`: one undo step. The worker is created on first use and terminated on
   Cancel, so `elkjs` never enters the main bundle.

## Alternatives considered

- **One `filters` object on the view:** nesting that adds nothing.
- **`pinned` as a node flag:** rejected by clarification; pins are per view like positions.
- **`collapsed` on the group:** rejected by 010 §g-22; collapse is a view setting.
- **Encoding "flows · owner" as `owner` plus a flag:** unclear to readers of the file.
- **Generating preset ids at materialization:** the current view's id would change mid-action.
- **Presets living only in the app:** a future CLI or MCP reader would disagree about defaults.
- **Keeping collapse in the UI store and persisting it separately:** a second source of truth.
- **Tracking collapse and filtering it out at undo time:** Yjs has no per-item skip.
- **Passing hidden nodes into `visibleGraph` (research R7):** group bounds, sticky placement and
  fit-to-scope would each need the same exclusion; projecting the deck once covers them all.
- **ELK `fixed` or `interactive` algorithms:** they do not lay out the free nodes.
- **Excluding pinned nodes from ELK:** the layout would ignore their edges.
- **Dagre:** a new dependency without compound-node support.
