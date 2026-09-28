# Research: Saved Views and Auto-Layout (011)

These are the decisions taken while planning. The spec is [spec.md](spec.md), clarified on 2026-09-28 with 8 answers.

Code was read on `main` at `8ab6052`:

- **Model and schema:** `packages/model/src/{editor,deck,geometry}.ts`, `ops/{context,cascade,refs,collections}.ts`, `integrity.ts`, and `packages/schema/schema/v1.json` (`View`, `SubtitleField`, `Id`).
- **App:** `apps/app/src/state/ui-store.ts`; `editor/{visible-graph,deck-to-flow,deck-node,canvas,canvas-toolbar,top-bar,drill-crumbs,outline,use-canvas-handlers,use-canvas-shortcuts,undo-toast}.ts(x)`; `editor/command-palette/{open-result,palette-results}.ts`; `layout/{elk-layout,layout-client,layout.worker}.ts`; `apps/app/bench/perf.bench.ts`.

**Facts that shape the plan:**

- Views already exist in the file format and in Yjs: `includes` is a `Y.Array` and `positions` is a `Y.Map` of `{x,y}` maps.
- Deleting a node already cleans `includes` and `positions`, and deleting a feature clears `view.feature`.
- The app does not read views yet. A drag writes `node.position`, subtitles are hard-coded to `tech`, and "System view" is a string literal in four files.
- Collapse is a global `Set` in the UI store.
- The ELK worker exists (`computeLayout`, `createLayoutClient`) but nothing imports it. `elkjs` ^0.12.0 is already a dependency.
- `SubtitleField` is `tech | host | owner | none`, which has no value for "flows · owner".
- Ids are unique per collection (`load-checks.ts`).

## R1 — File format: optional view fields only

- **Decision:** add these optional fields to `View` in `packages/schema/schema/v1.json`, then run `pnpm schema:generate`:

  | Field           | Type                  | Meaning                                                |
  | --------------- | --------------------- | ------------------------------------------------------ |
  | `pinned`        | `IdList` of node ids  | Components that Tidy layout must not move in this view |
  | `collapsed`     | `IdList` of group ids | Groups collapsed in this view (§g-22, 010)             |
  | `excludeGroups` | `IdList` of group ids | Hide these groups' members, nested groups included     |
  | `excludeKinds`  | array of `NodeKind`   | Hide components of these kinds                         |
  | `excludeTags`   | `Tags`                | Hide components carrying any of these tags             |
  | `dimKinds`      | array of `NodeKind`   | Dim components of these kinds (0.4)                    |

  `SubtitleField` gains the value `flows` ("<n> flows · <owner>").

  - All arrays use `uniqueItems: true`. Absent means empty; an empty array is written as absent.
  - Canonical key order comes from the schema as today (`key-order.ts`).
  - The `full.sododeck.json` example gains the new fields on its existing views, and `test/fixtures.ts` gains invalid cases: an unknown kind, a duplicate id, and a bad id pattern.

- **Rationale:** constitution II says additive optional fields don't bump `version`. Older files stay valid. A new enum value is additive for files, though an older app would reject a file that uses `flows`, which is acceptable before launch.
  - Exclusions are stored rather than expanded into `includes`, so components added later are hidden too (spec Assumptions).
  - `includes` stays and is honoured when present.
- **Alternatives:**
  - One `filters` object: nesting that adds nothing.
  - `pinned` as a node flag: rejected by clarification (pins are per view).
  - `collapsed` on the group: rejected by §g-22.
  - Encoding "flows · owner" as `owner` plus a flag: unclear to readers of the file.

## R2 — Yjs layout, cascade and integrity

- **Decision:** each new list is a `Y.Array` of ids inside the view's `Y.Map`, following the existing `includes` pattern. The layout comment in `deck.ts` and ADR 0005 are amended by the new ADR 0012; no migration is needed because the fields are absent in stored docs. Changes:
  - `cascade.ts`, node removal: also removes the id from `pinned`.
  - `cascade.ts`, group removal: removes the id from `excludeGroups` and `collapsed` in every view. Views are reported in `RemovalResult.updated`.
  - `refs.ts`: adds `views.pinned` and `views.excludeGroups` / `views.collapsed` (group refs).
  - `integrity.ts`: checks the new references.
  - `round-trip.test.ts`: gains a deck using every field.
- **Rationale:** constitution III requires references by id, cleaned in the same undo step (FR-061), and the same code path as today.

## R3 — Presets are data, and "no stored views" is resolved in one place

- **Decision:** `packages/model/src/views.ts` (pure) exports:
  - `VIEW_PRESETS`: three `View` objects with fixed ids `system`, `feature` and `infra`.
    - System: `subtitleField: 'tech'`.
    - Feature: `'flows'`.
    - Infra: `'host'` plus `dimKinds: ['client']`.
  - `resolveViews(file)`: returns `file.views` when non-empty, else `VIEW_PRESETS`.
  - `baseViewId(views)`: the first view's id.
  - `CUSTOM_VIEW_DEFAULTS`: `subtitleField: 'tech'`.

  The type only picks these defaults and the tooltip (FR-002a); no other code branches on `view.type`.

- **Rationale:**
  - Fixed preset ids let the app keep `currentViewId` stable across materialization (R4).
  - Ids are unique per collection, and presets are written only when `views` is empty, so they cannot collide.
  - Presets are plain data in the model, so a future CLI or MCP reader sees the same defaults.
- **Alternatives:**
  - Generating ids at materialization: the current view id would change mid-action, and the UI would have to re-map it.
  - Presets living only in the app: a second reader would disagree.

## R4 — View editor ops, with materialization inside the op

- **Decision:** add `ops/views.ts` with editor methods. Every method takes a `viewId`. If the deck has no stored views and `viewId` is a preset id, the op first writes `VIEW_PRESETS` in its own transaction with the untracked origin (R5), then applies the change with the tracked origin (FR-001, amended after analysis). Undo therefore never removes the saved views: if it did, undoing the first move after a later collapse would drop that collapse, breaking FR-050.

  | Op                                                | Writes                                                                                                                |
  | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
  | `moveInView(viewId, positions: Record<Id,Point>)` | base view: `node.position`, and deletes that view's own `positions[id]` if present; other views: `view.positions[id]` |
  | `setPinned(viewId, nodeIds, pinned)`              | `view.pinned`                                                                                                         |
  | `updateView(viewId, patch)`                       | `title`, `subtitleField`, `feature`, `exclude*`, `dimKinds` (validated)                                               |
  | `addView(data?)` → `Id`                           | appends a custom view (`Custom <n>`, lowest unused n)                                                                 |
  | `removeView(viewId)`                              | refuses the last view (`invalid`)                                                                                     |
  | `setCollapsed(viewId, groupId, on)`               | `view.collapsed`, **untracked** (R5)                                                                                  |
  - `moveInView` is also what Tidy layout uses, inside one `batch`.
  - A drag keeps using `beginGesture` / `endGesture`, so a drag is one step.
  - The generic `add` / `update` / `remove` for `views` stay and are used by import and the JSON panel.

- **Position rule:** `viewPosition` prefers a view's own override in **every** view, the base view included. A deck normally has no overrides on its base view, but when the base view is deleted the next view becomes the base and keeps its overrides; showing them keeps its layout unchanged, and each later move there turns that component back into a base position.
- **Rationale:**
  - One place knows the base-view rule and the materialization rule, and both are unit-testable in Node.
  - The app never writes view internals directly (AGENTS.md rule 2).

## R5 — Collapse: saved and synced, never an undo step

- **Decision:** the editor gets a second transaction origin, `viewStateOrigin`.
  - It is registered in `editorOrigins`, so `observeDeck` reports its changes as `local` in this tab and `remote` in others.
  - It is **not** in the `UndoManager`'s `trackedOrigins`. `setCollapsed` runs with it, and so does every preset materialization (R4).
  - Yjs keeps other steps undoable: undoing a tracked edit never touches the `collapsed` array, because that array was modified only by an untracked origin.
  - Undoing a view delete restores the view's `Y.Map` as it was, `collapsed` included (FR-050).
- **Tests (`packages/model/test/views.test.ts`):**
  - rename then collapse, then ⌘Z: the rename is undone and the group stays collapsed;
  - collapse only: `canUndo()` is false;
  - delete view, then undo: collapse entries are back;
  - a second doc synced via updates sees the collapse;
  - move in Infra on a deck with no views (materializes), collapse, then ⌘Z: the move is undone, the views and the collapse stay.
- **Alternatives:**
  - Keeping collapse in the UI store and persisting it separately: that makes a second source of truth (constitution I).
  - Tracking collapse and filtering it out at undo time: Yjs has no per-item skip.

## R6 — Current view and switching (app, UI state)

- **Decision:** the UI store gains:
  - `currentViewId: Id | null`, where null means the first resolved view;
  - `revealed: ReadonlySet<Id>`: nodes created in this view while hidden by its filters, cleared on switch (spec edge case);
  - `switchView(id)`: clears selection, drill, focus and `revealed`, and announces "<title> view".

  The store's `collapsed` Set and `setCollapsed` / `toggleCollapsed` / `expandAll` are **removed**. Their ~10 call sites read `useCollapsed()`, a `Set` memoized on the current view's `collapsed` array identity (the snapshot shares structure), and write through a `useViewActions()` hook that wraps the editor ops. `resetForDeck` sets `currentViewId` to null.

  `useViewSync` (next to the existing `pruneView` sync) handles two cases:
  - the current view vanished (remote delete or undo): switch to the left neighbour and announce it;
  - materialization: ids are fixed, so nothing needs to happen.

- **Rationale:** the current view is per tab (FR-005), and collapse now comes from the document (constitution I). Switching fits the canvas with the existing `fitView`.

## R7 — Visible graph takes the view

- **Decision:**
  - A new pure `editor/view-filter.ts` has `viewFilter(deck, view, revealed)`, which returns `hidden: ReadonlySet<Id>` (node ids) and `dimmed: ReadonlySet<Id>`. The rules are:
    - `includes`, when present, is a whitelist;
    - `excludeGroups` covers the group subtree;
    - `excludeKinds` and `excludeTags` hide matching nodes;
    - `feature` keeps only the nodes at either end of an edge used by a step of a flow whose `feature` matches (FR-014);
    - `revealed` nodes are never hidden.
  - `visibleGraph(deck, scope, collapsed, hidden)` treats hidden nodes as absent: their edges are dropped (FR-012), not merged or turned into ports. The cache key adds `hidden` (by identity; memoized per view and deck).
  - `deck-to-flow` gets a `ViewRender` with three parts:
    - a `position(node)` resolver: the view's own position, else the base position, else the grid slot;
    - `subtitle(node)`: tech / host / owner / "n flows · owner" / none, with flow counts from `flowCountByNode(deck)`, memoized per deck;
    - `dimmed`.
  - `deck-node.tsx` shows `data.subtitle` where it now shows `tech`, adds the `view-dimmed` class, adds ", dimmed in this view" to its accessible name, and draws a `Pin` glyph when `data.pinned` (every level except Landscape).
  - Sticky geometry keeps using the node's displayed position through the same resolver.
- **Rationale:** there is one derivation (ADR 0011) with one more input. Hidden-by-view is different from collapse, since nothing is merged. Everything stays linear and memoized: `viewFilter` is O(nodes + groups + steps).
- **Alternatives:** filtering in `deck-to-flow` after the graph, which would give wrong merged counts and port pills.

## R8 — Moves go through the view

- **Decision:** `onNodesChange` in `use-canvas-handlers.ts` calls `editor.moveInView(currentViewId, …)` instead of `update('nodes', …, {position})`, still inside `batch` and the drag gesture. Note moves are unchanged.
- **Rationale:** it implements FR-020 and FR-021, and the model decides between base and override.

## R9 — Tidy layout: ELK in the existing worker, pins honoured after layout

- **Decision:** extend `layout/elk-layout.ts` to `computeLayout(request)`:
  - **Request:** `nodes {id, width, height, parent?}`, `groups {id, parent?}` (compound nodes), `edges`, and `pinned: Record<id, {x,y}>`.
  - **ELK run:** `layered` with direction RIGHT and `hierarchyHandling: INCLUDE_CHILDREN`, so members of a group stay together and group padding is respected (FR-031). The spacing is what the file uses today.
  - **Pins (pure `applyPins`, unit-tested):**
    1. Run ELK on the full set, pinned nodes included, so edges still shape the layers.
    2. Translate the result by the median offset between the pinned nodes' ELK positions and their real positions, which keeps the arrangement near the pins.
    3. Put pinned nodes back exactly.
    4. Run a deterministic overlap sweep that pushes unpinned nodes right, then down, until no box overlaps a pinned box. Pinned nodes are never moved (SC-001).
  - **Collapsed groups:** laid out as one node of the collapsed card size. Members get the card's delta and keep their relative positions.
  - **Drilled scope:** only the scope's members are sent (FR-030).
  - **Hidden nodes:** not sent and not moved.
  - **Orchestration (app):** `editor/tidy-layout.ts` builds the request from the visible graph. `useTidyLayout()` does the rest:
    - creates the worker client **on first use** (elk stays in the worker chunk and is never in the main bundle);
    - shows an indeterminate progress bar with Cancel after 500 ms;
    - on Cancel, terminates the worker and recreates it lazily next time;
    - applies the result with one `editor.batch(() => editor.moveInView(view, positions))`, which is one undo step (FR-033). Only nodes that still exist and are still unpinned are applied (US3 #7);
    - then fits the view and announces "Layout tidied, <n> components moved".
  - The button is disabled in flow mode or recording, when the view is empty, and when every component is pinned (FR-035).
- **Rationale:**
  - The constitution names ELK in a worker, and the dependency is already approved and installed.
  - ELK layered has no hard fixed-position constraint for arbitrary nodes (its interactive modes only keep relative order), so pins are enforced after layout. That is simple, deterministic and testable.
  - ELK layered takes about 100–400 ms for 200 nodes with ~400 edges, well inside the 2 s budget. It is measured by a Vitest perf test in Node and by the bench.
- **Alternatives:**
  - ELK `fixed` or `interactive` algorithms: they don't lay out the free nodes.
  - Excluding pinned nodes from ELK: the layout ignores the edges to them.
  - Dagre: a new dependency, and no compound-node support.
  - Running on the main thread: violates constitution V.

## R10 — Undo or redo of a change made in another view

- **Decision:** `useUndoContext` subscribes to `observeDeck` for origin `undo` / `redo`. If every change is in scope `views` and names a single view id other than the current view, it shows a toast via `useToast` (`MOTION.toastMs`) with the action "Go to <title>", which calls `switchView(id)`, and announces the same text. The toast text is "Undid <action> in <title>" (or "Redid …"). The action comes from the changed keys:

  | Changed key                                        | Action          |
  | -------------------------------------------------- | --------------- |
  | `positions`                                        | "move"          |
  | `pinned`                                           | "pin"           |
  | `title`                                            | "rename"        |
  | `exclude*`, `dimKinds`, `subtitleField`, `feature` | "view settings" |
  | anything else                                      | "change"        |

  Tidy layout also only changes `positions`, so it reads "move". The `batch` gives it no separate label, which is acceptable. Changes that include `nodes` (base positions) show nothing extra (FR-045).

- **Rationale:** `observeDeck` already reports scope, id and keys for undo. No model change is needed.

## R11 — Search results for hidden components

- **Decision:**
  - `buildPaletteResults` takes `hidden: ReadonlySet<Id>` and appends " · Hidden in this view" to a hidden node's `meta`, as text rather than colour (FR-016).
  - `openResult` gets `isHidden(id)` and `firstViewShowing(id)` in its context. For a hidden node it selects nothing, stays in the view and shows a toast "<title> is hidden in this view" with the action "Show in <view>" (or no action when no view shows it).
  - Enter while that toast is showing triggers the action: the palette closes, and the toast's action button takes focus.
  - `firstViewShowing` runs `viewFilter` over `resolveViews(deck)` in order.
- **Rationale:** this is clarification Q7, with the smallest change to 009's palette.

## R12 — View switcher, tab menu and settings popover (UI)

- **Decision:** add these components in `apps/app/src/editor/views/`:
  - `view-switcher.tsx`: a `role="tablist"` with a roving tabindex (←/→, Home/End, Enter/Space), design 02, 20, 21 and 22 (segmented control, current tab raised). A "+" button adds a view.
    - Overflow uses a `ResizeObserver` (feature-detected in `features.ts`; the fallback shows every tab and lets them scroll). Tabs that don't fit go into a "More views" `DropdownMenu`, and the current tab always stays visible.
    - It sits in the top bar's centre slot, where the 010 comment reserved space. `SessionChip` replaces it while recording (design 41).
  - `view-tab-menu.tsx`: a `DropdownMenu` opened by right-click, the ⋯ button (shown on hover and focus) or Shift+F10 / the context-menu key. Its items are Rename, View settings…, and Delete view (disabled on the last view, with a tooltip).
  - `view-rename-input.tsx`: an inline input on double-click or Rename. Enter commits and Esc cancels; blank input is rejected, keeping the old title with a hint.
  - `view-settings-popover.tsx`: a `Popover` anchored to the tab with:
    - a subtitle radio group: Technology, Hosting, Flows · owner, Owner, None;
    - "Hide groups", "Hide kinds", "Hide tags" and "Dim kinds" checkbox lists. Kinds and tags come from the deck's content plus any already chosen, so they stay domain-neutral;
    - a Feature select ("All features" or a feature).
      Every change is one undo step. Esc returns focus to the tab.
  - Delete uses the existing `ConfirmDeleteDialog` pattern plus `useUndoToast` ("View "X" deleted").
  - Creating a view shows the toast 'View "Custom n" created' (2.6 s = `MOTION.toastMs`; checked against the design).
  - The Tidy layout button in `canvas-toolbar.tsx` uses lucide `LayoutGrid` with the label "Tidy layout". "Pin position" is a `Switch` in the node inspector plus a toolbar toggle (lucide `Pin` / `PinOff`) when the selection contains nodes.
- **Rationale:** these reuse `@sododeck/ui` components (`DropdownMenu`, `ContextMenu`, `Popover`, `Switch`, `Select`, `InlineEdit`, `Tooltip`, `Toast`).
  - `packages/ui` has no `Checkbox` or `RadioGroup` yet. Both are added as thin token-styled wrappers of the `radix-ui` primitives the package already depends on, so no new dependency is needed.
  - The rename field reuses `InlineEdit`. The undesigned parts are the defaults accepted in design-analysis row 634 and clarification Q3.
- **Open for the visual check:** the settings popover, the Tidy button and the pin glyph have no design frame. Screenshots go to the founder in the PR (backlog: "need design or founder approval").

## R13 — "System view" strings

- **Decision:** one helper, `viewCrumbTitle(view)` in `editor/views/view-title.ts`, returns "<title> view". The duplicated `scopeTitle` in `canvas.tsx` and `use-canvas-shortcuts.ts` is merged into `outline.ts`'s `parentScopeTitle(deck, scope, view)`, and `drill-crumbs.tsx` reads the current view. Tests that assert "System view" keep passing, because the first preset's title is "System".

## R14 — Performance and bench

- **Decision:**
  - The bench deck gets `options.views`, which adds three views with overrides for 50% of the nodes, 20 pins and one exclusion.
  - New scenarios in `perf.bench.ts`:
    - `view-switch`: time from click to the settled canvas, target ≤ 200 ms (SC-003);
    - `tidy-layout-200`: a 200-node deck with 5 pins, from click to the result applied, target < 2 s (SC-001);
    - `pan-during-layout`: fps while the 500-node layout runs, target ≥ 60 (SC-002).
  - `pnpm bench` runs before and after, and the results go in `bench-before.md` / `bench-after.md`.
  - A Node Vitest perf test in `elk-layout.test.ts` asserts that 200 nodes finish in < 2 s on CI. It is loose, with the hard gate being the bench.

## R15 — ADR

- **Decision:** add `docs/decisions/0012-saved-views-and-layout.md`, covering:
  - the new view fields;
  - presets with fixed ids, materialized on the first view change outside undo history;
  - the base-view rule (first view edits `node.position`);
  - collapse as an untracked origin;
  - pins enforced after ELK layout.

  It amends ADR 0005's layout table (new `Y.Array` fields) and supersedes ADR 0011's "collapse is UI state" for collapse only.

## R16 — Out of scope, confirmed

- Reordering views and dragging tabs.
- Per-view drill, focus, zoom or viewport.
- Layout options UI.
- Per-view component data.
- Role layers (V-5) and sequence/swimlane (V-6).
- Export scope "current view" (012 reads `resolveViews` and the view filter).
- Syncing the current view between tabs.
