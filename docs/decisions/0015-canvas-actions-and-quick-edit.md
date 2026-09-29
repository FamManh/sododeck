# 0015. Canvas actions and quick edit: one action list, edits on the card

- **Status:** Accepted
- **Date:** 2026-09-28
- **Feature:** `specs/019-card-quick-edit` (spec, research R1–R14, contracts)

## Context

After 018 the canvas is full-bleed, but every edit still goes through the details drawer: a
double-click opens it, and titles, owners, kinds and tags are edited there. Most diagram work is
naming boxes and setting a few fields, so each change costs a trip to a side panel. The design
(states 95–104 and the menu in 115) moves those edits onto the canvas: an inline title, a details
button on the card, a toolbar over the selection and a context menu. Three constraints shape it:

- Keys, the toolbar and the menus must agree: an item is enabled exactly when its shortcut works
  (FR-039). Later features (016 copy / paste / group / align, 017 reset route, 020 fill / stroke)
  must add their actions without rebuilding these surfaces (FR-040).
- The document stays the single source of truth. Nothing may hold a copy of a title or a field
  beyond the text being typed (FR-009, FR-047), and every change is one undo step.
- The schema's `Text` type has `minLength: 1`: a title can never be empty, even for a moment.

## Decision

1. **One action list.** `apps/app/src/editor/actions/` holds plain action objects
   (`id`, `label`, `icon`, `shortcut`, `section`, `surfaces`, `targets`, `modes`, `applies`,
   `disabledReason`, `children`, `run`). The pure `actionsFor(list, ctx, surface)` returns the
   sections that apply to a target (component, components, connection, group, sticky, mixed,
   canvas) in a mode (edit, flow, session, view-only). The toolbar and the menu render its result;
   the new keys (F2, ⇧⌘C, ⇧⌘G, ⇧F10, P) run actions through `useRunAction`, which checks
   `applies` and `disabledReason` first. Existing keys whose actions also appear in menus (Delete,
   Space, ⌘A, ⌘0) keep their handlers but call the same functions. A later feature adds a module
   (for example `clipboard-actions.ts`) to `ACTIONS` in `actions/index.ts`; the surfaces pick it
   up without change.
2. **Double-click and F2 rename; Enter keeps its behaviour** (clarified FR-001, option A).
   Double-click on any component, and F2 on a focused or selected component or group, start
   title edit inside the card. Enter still opens the details drawer on a plain component and
   drills into a component with children; the pointer path to drill in is the menu's "Open
   inside". A double-click on a group label or a collapsed group still drills in. This
   supersedes 018's "double-click opens the drawer" (ADR 0014 §4).
3. **The title edit session lives in the UI store; the draft lives in the input.** `titleEdit`
   names the object and whether it is new. `InlineEdit` holds the only copy of the text. Commit
   trims it; empty or unchanged writes nothing; otherwise one `oneStep` update.
4. **"Untitled <kind>" is the stored fallback title.** A new component is written as, for
   example, "Untitled service" and starts in title edit with an empty field and the placeholder
   "Name this component". Esc or an empty commit keeps the fallback. Adding and naming are two
   undo steps. The document is valid at every moment, so autosave and the JSON panel never see
   an empty title.
5. **One toolbar, placed from DOM rects measured at rest.** The selection toolbar is one island
   in the shell's overlay layer. Its position comes from the union of the selected elements'
   `getBoundingClientRect()` and the pure `toolbarPlacement` (12 px above, flipped below near the
   top islands, clamped to the window). It is measured on selection change and when a pan, zoom
   or drag ends, and it is hidden while one runs (`canvasGesture`), so pan and zoom do no toolbar
   work.
6. **One controlled menu anchored at a point.** Right-click, ⇧F10 / the ContextMenu key and the
   toolbar's "More actions" all open the same controlled `DropdownMenu`, whose trigger is an
   invisible anchor at `contextMenu.point`. Keyboard opening focuses the first enabled item and
   Esc returns focus to the opener.
7. **The details button is CSS-only.** It shows on hover or focus inside the card and is hidden
   by `data-*` flags on the canvas wrapper (dragging, flow mode, Hide UI, tiny cards). The
   tiny-card flag is one boolean zoom selector on the wrapper, so cards never subscribe to zoom.

## Alternatives considered

- **Moving every existing shortcut into the action list now:** too big a change for 019, with a
  risk of regressions in 003–018 key handling.
- **Separate item lists per surface:** they would drift apart and break FR-039.
- **Enter renames, double-click opens details** (options B and C of the clarification): Enter is
  the keyboard path to details and drill-in since 018, and the design shows double-click editing
  the title (96).
- **A floating input over the card, or `contentEditable`:** the card must keep its size (96), and
  `contentEditable` is harder to test and make accessible.
- **An empty title while the user types:** invalid for the schema (`minLength: 1`).
- **Creating the card only when its name is committed:** the card would not be visible while it
  is named, and ⌘⏎ chaining gets complex.
- **React Flow `NodeToolbar`:** only for nodes, and one toolbar per node.
- **A toolbar position from flow bounds × viewport:** needs per-type geometry for edges and
  collapsed groups; DOM rects already cover every type.
- **Radix `ContextMenu` for right-click plus a `DropdownMenu` for the keyboard:** two components
  and two focus behaviours; `ContextMenu` cannot be opened from a key or a button.
- **A zoom subscription per card for the details button:** re-renders every card on each zoom
  tick at 500 components.

## Consequences

- `addComponent` titles are "Untitled <kind>" instead of "New <kind>".
- The canvas has a context menu for the first time; the browser menu no longer shows on it.
- The drawer opens from Enter, the details button, the toolbar's "Open details", the menu, ⌘⇧D
  and Deck settings, no longer from a double-click.
- `packages/ui` gains `Toolbar` and `ChoiceList`, `InlineEdit` gains optional props, and two
  tokens are added (`--sd-selection-text`, `--shadow-menu`).
- 016, 017 and 020 register their toolbar and menu items as action modules.
