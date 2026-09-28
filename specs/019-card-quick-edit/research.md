# Research: Card Quick Edit (019)

These are the decisions taken while planning. The spec is [spec.md](spec.md). It was clarified on 2026-09-28: FR-001 uses option A, where double-click and F2 rename and Enter keeps its 018 behaviour.

Code was read on `main` at `406a098`:

- **Store:** `apps/app/src/state/ui-store.ts`.
- **Keys:** `editor/use-canvas-shortcuts.ts` (`useCanvasKeyDown`, `useEditorShortcuts`) and `editor/shell/{use-shell-shortcuts,shortcuts,regions,shell-geometry,detail-drawer,fit-selection}.ts(x)`.
- **Canvas:** `editor/{use-canvas-handlers,canvas-actions,canvas-geometry,deck-node,group-boundary-node,collapsed-group-node,visible-graph,deck-to-flow,json-panel-view,json-panel-header}.ts(x)`.
- **Fields:** `editor/fields/*` and `editor/inspector/{bulk-inspector,derive,choices,edge-inspector}.tsx`.
- **Other editor code:** `editor/views/pin-controls.tsx`, `editor/stickies/sticky-actions.ts`, `editor/command-palette/*`.
- **Library and shared UI:** `lib/menu-kit.ts`, `library/{deck-menu,deck-keys,folder-menu}.tsx`, `packages/ui/src/components/*`.
- **Model:** `packages/model/src/editor.ts`.

**Facts that shape the plan:**

- **Double-click** (`onNodeDoubleClick`):
  - On a group, it drills in.
  - On a plain component, it opens the drawer (018).
  - On a component with children, it drills in.
- **Enter** (`useCanvasKeyDown`): opens the drawer on a plain component, drills into groups and parent components, and opens the edge popover on an edge.
- **F2** handles stickies only.
- **Titles:**
  - A card title is a plain `<span>` in `DeckNode`, and a group label is a `<span>` in `GroupBoundaryNode`.
  - `InlineEdit` (`packages/ui`) already renames the deck, views and flows. Enter or blur commits and Esc reverts.
  - The schema `Text` type has `minLength: 1`, so a title can never be empty.
- **Adding a component:** `addComponent(editor, kind, position)` creates the title "New <kind>" and moves the spot with `freeSpot` in +24 / +24 steps. It then selects, focuses and announces the new card. It is used by the palette click, digits 1–6 and drop.
- **Undo:**
  - `DeckEditor.batch(fn)` is one undo step, and so is `oneStep(editor, write)`.
  - `transact` calls `stopCapturing()` when the key changes, so two different edits never merge into one step.
  - The bulk inspector writes every node inside one `batch` (`writeAll` / `writeAllOnce`).
- **Menus:**
  - The canvas has no context menu today.
  - `lib/menu-kit.ts` (`dropdownKit` / `contextKit`) lets one item tree render as a Radix DropdownMenu or ContextMenu. The library uses it, with ⇧F10 / ContextMenu opening a controlled DropdownMenu.
  - `packages/ui` has `ContextMenu*`, `DropdownMenu*` (with `shortcut`, `destructive`, Sub, RadioGroup), `Popover`, `Combobox`, `TagInput`, `TagChip` (`partial`, `count`) and `Tooltip`.
  - Radix Toolbar ships inside the `radix-ui` umbrella that `packages/ui` already depends on.
- **Actions:** there is no action registry. `command-palette/commands.ts` builds a static `PaletteCommand[]`, and `shell/shortcuts.ts` holds only labels.
- **Selection rect:** no helper gives the selection's screen rect. The drawer uses `nodeElement(id).getBoundingClientRect()` together with `panToClear`.
- **Draw order:** components are drawn in `deck.nodes` order (`visibleGraph` filters and keeps array order). `zIndex` is set only on groups (−1) and stickies (1). `editor.reorder(c, id, toIndex)` exists.
- **Copy JSON:** `selectionView` and `selectionText` in `json-panel-view.ts` give the Selection-tab JSON. The clipboard write is inline in `json-panel-header.tsx`, behind `supportsClipboardWrite()`.
- **Pins:** `PinSwitch` exports the component only. `usePinState` / `useTogglePins` are internal. `useViewActions().pin(ids, on)` is the call underneath.
- **Tokens:** there is no `--sd-selection-text` token. Menus use `shadow-float` and popovers use `shadow-hover`, while DESIGN.md asks for `0 12px 32px` on menus and toolbar popovers. The next ADR number is 0015.

## R1 — One action list shared by keys, toolbar and menus

- **Decision:**
  - Add `apps/app/src/editor/actions/`, where an **action** is a plain object: `{ id, label, icon?, shortcut?: ShortcutId, section, danger?, applies(ctx), disabledReason?(ctx), run(ctx) }` (see [data-model.md](data-model.md)).
  - `ActionContext` is built once per open menu or toolbar render. It holds the target kind (component / components / connection / group / canvas / mixed), the selection ids, the mode (`edit`, `flow`, `session`, `viewOnly`), the menu point and the snapshot, plus `editor` and the store.
  - Pure `actionsFor(ctx, surface)` returns sections of applicable actions for a surface (`menu`, `toolbar`).
  - The list is an array assembled in `actions/index.ts` from per-area modules (`title-actions`, `field-actions`, `arrange-actions`, `group-actions`, `connection-actions`, `canvas-actions`, `view-actions`). 016, 017 and 020 each add a module to that array (FR-040).
  - New keys (F2, ⌘E, ⇧⌘C, P, ⇧F10) call `runAction(id)`. Existing keys whose actions also appear in menus (Delete, Space, ⌘A, fit) keep their handlers, but they call the same exported function the action's `run` calls. The action's `applies` reuses the predicate the key handler uses (FR-039).
- **Rationale:** one place decides "does this apply here", so a menu item is enabled exactly when its shortcut works, and later features only add actions (backlog plan hint).
- **Alternatives considered:**
  - Moving every existing shortcut into the registry now: too big a refactor for 019's scope, with a risk of regressions in 003–018 key handling.
  - Per-surface item lists: these would drift apart and break FR-039.

## R2 — Inline title edit: one edit session in the UI store, the draft only in the input

- **Decision:**
  - The UI store gains `titleEdit: { target: 'node' | 'group', id, isNew, kind? } | null`, with `startTitleEdit`, `endTitleEdit`.
  - `DeckNode` renders a `CardTitleInput` in place of the title span when `titleEdit.id === id`. `GroupBoundaryNode` and `CollapsedGroupNode` do the same for the label.
  - The input is `InlineEdit` from `packages/ui`, extended with optional props:
    - `placeholder`
    - `autoFocus` with select-all
    - `onCancel`
    - an `onKeyDown` passthrough (Tab, ⇧Tab, ⌘⏎)
    - `className` for in-card sizing
  - `InlineEdit` keeps its only state, the draft text (FR-009).
  - **Commit:** trim the text. If it is empty or unchanged, write nothing (FR-005); otherwise `oneStep(editor, () => editor.update('nodes' | 'groups', id, { title }))`. Then announce "Renamed to <title>".
- **Entry points:**
  - `onNodeDoubleClick` on any component, including one with children, starts title edit (FR-001).
  - Double-click on a group label or collapsed group still drills in.
  - F2 in `useCanvasKeyDown` handles the focused component or group, and still handles stickies.
  - The Rename action and the group toolbar also start title edit.
  - Enter is unchanged.
  - Title edit is refused in flow mode, during a session, and in view-only mode (FR-010).
- **Pointer drilling:** drilling into a component with children by pointer moves to the menu item **Open inside** (`drillInto`). Its label comes from `SHORTCUTS` with ⏎.
- **Tab / ⇧Tab:** commit, then `startTitleEdit` on the next or previous component in keyboard order. That order is the same one the arrow keys use (`focus-set.ts` reading order). The canvas focuses and reveals that card.
- **End conditions:**
  - A click outside or a selection change commits, via InlineEdit's blur.
  - When the target is removed (a remote delete or undo), `pruneSelection` also clears `titleEdit`, and the input unmounts without writing.
  - ⌘Z inside the input is the browser's text undo, because `isTextTarget` already guards document undo.
- **Covered cards:** when title edit starts on a card covered by chrome, reuse `panToClear` against `currentInsets()`.
- **Rationale:** the plan hint says "no local copy of the title beyond the input draft". This reuses the proven InlineEdit semantics.
- **Alternatives considered:**
  - A floating input over the card: breaks "keeps its size / inside the card" (96).
  - `contentEditable`: harder to test and to make accessible.

## R3 — New components start in title edit

- **Decision:**
  - `addComponent(editor, kind, position, { edit: true })` creates the card with the title **"Untitled <kind label, lower case>"** (for example "Untitled service"). This replaces "New <kind>", because the schema forbids an empty title and FR-014 needs that fallback. Then it calls `startTitleEdit({ target: 'node', id, isNew: true, kind })`.
  - `CardTitleInput` with `isNew` shows an **empty** draft and the placeholder "Name this component".
  - Esc, or committing an empty title, keeps "Untitled <kind>" with no extra step.
  - **⌘⏎:** commit if the text is not empty, then `addComponent` with the same kind at `freeSpot(position + 24, +24)`, in edit.
  - Adding and renaming are separate `transact` keys, so they are two undo steps (FR-015).
  - Callers: the palette click, digits 1–6, drop, and canvas-menu "Add component ▸" at the menu point (FR-012).
  - The palette flyout is not closed by title edit (018 rules apply).
- **Rationale:** matches frame 97 and keeps the document valid at every moment, so the JSON panel and autosave never see an empty title.
- **Alternative considered:** creating the card only on commit. Rejected: the card would not be visible while it is being named, and ⌘⏎ chaining gets complex.

## R4 — Details icon: pure CSS visibility, one zoom flag on the canvas

- **Decision:**
  - `DeckNode` renders a `DetailsButton`: a 22 px inverse circle at the top-right, `aria-label="Open details"` with a tooltip. On activation it runs `select({ nodes: [id] }); focus(id); openDrawer()`.
  - It becomes visible through `group-hover/node` and `group-focus-within/node` classes, and the card lifts with `shadow-hover`.
  - It is hidden with `data-*` attributes on the canvas wrapper: `data-dragging`, `data-flow`, `data-view-only`, `data-hide-ui`, `data-tiny-cards`.
  - `data-tiny-cards` is one boolean selector on the React Flow zoom (`zoom * NODE_SIZE.width < 80`), set on the wrapper. Nodes do not subscribe to the zoom.
  - `tabIndex` follows the card's roving `tabIndex`, so the button is reachable by Tab only while its card is focused.
- **Rationale:** at 500 nodes a per-node zoom subscription would re-render every card on each zoom tick (SC-007). CSS toggles cost nothing.
- **Alternative considered:** `useStore` per node. Rejected for performance.

## R5 — Selection toolbar: one overlay island placed from DOM rects

- **Decision:** `editor/quick-edit/selection-toolbar.tsx` mounts in the shell overlay layer. It hides under Hide UI (it is part of the shell chrome) and is not an F6 region.
  - **Placement:**
    - `selectionScreenRect()` takes the union of `getBoundingClientRect()` over the selected node, edge and group elements, the same pattern the drawer uses.
    - The pure `toolbarPlacement(rect, size, viewport, insets)` → `{ x, y, side: 'above' | 'below' }` puts the toolbar 12 px above, flips it 12 px below when y < 68, and clamps it inside the window's 12 px edges (FR-019).
    - The rect is measured on selection change, on React Flow `onMoveEnd` and on `onNodeDragStop`. It is **not** measured every frame.
  - **Hiding:**
    - The UI store gains `canvasGesture: 'pan' | 'drag' | null`, set from `onMoveStart` / `onMoveEnd` and `onNodeDragStart` / `onNodeDragStop`. The toolbar hides while it is set.
    - It also hides while `titleEdit`, flow mode, a session, view-only or Hide UI is active (FR-026).
    - This means no per-frame work during pan or zoom.
  - **Variants:** `toolbarVariant(selection)` → `component | components | connection | group | mixed | none`. Stickies give `none` (no toolbar); as a menu target they are `sticky` (Open details, Copy JSON, Delete).
  - Each variant lists action ids from R1 with `surface: 'toolbar'`.
  - **Keyboard:**
    - The toolbar is Radix `Toolbar`, wrapped in `packages/ui` as `Toolbar`, `ToolbarButton`, `ToolbarSeparator`. Radix supplies roving focus with ← → Home End.
    - ⌘E (shell shortcut) focuses the first button. Esc inside returns focus to `focusedId` or `focusedEdgeId`.
    - Tab on a selected card moves into the toolbar when one is shown. Tab past the last button returns focus to the card.
- **Rationale:** DOM rects already include edge label boxes and group bounds for every object type. Measuring only at rest keeps pan and zoom free.
- **Alternatives considered:**
  - Computing the rect from flow bounds × viewport: needs per-type geometry (edges, collapsed groups).
  - React Flow `NodeToolbar`: works only for nodes and renders one toolbar per node.

## R6 — Toolbar popovers: one filterable choice list in `packages/ui`

- **Decision:**
  - Add `packages/ui` `ChoiceList`: a filter field plus a `listbox` with an optional "none" row. Each option can be marked `selected`, `mixed` or `partial` (with a count).
  - Keyboard: ↑ ↓ move, Enter picks, Esc bubbles to the popover. The filter is focused on open.
  - Its frame is `PopoverContent`, 236–272 px wide.
  - Fields in the app (`editor/quick-edit/fields/`):
    - **Kind:** `KIND_OPTIONS`.
    - **Owner:** the owners used in the deck, plus "Use '<typed>'" and "No owner".
    - **Tech:** the technologies used in the deck, plus "Use '<typed>'" and "No technology".
    - **Tags:** multi-select. Toggling a partial tag applies it to all. Partial tags render as a `TagChip` with `partial` and `count`.
    - **Links:** reuses `LinksField` inside the popover.
    - **Rules:** reuses `AttachedRules` / `attach-rule-popover`.
    - **Connection Protocol / Direction:** `PROTOCOLS` / `DIRECTIONS` as a single-choice list.
  - Values come from the existing `bulkView` / `Shared<T>` derivation, so "Mixed" and "partial" match the bulk inspector (FR-024, FR-027).
  - **Writes:** every pick is one `oneStep` or `batch` across the selection (FR-025), then an announcement ("Owner set to Payments team on 3 components").
- **Rationale:** the inventory marks the toolbar popover as "ui ➕ (019)". A listbox with a filter is generic and presentational. Links and Rules already have full editors, so rewriting them would duplicate 008.
- **Alternative considered:** reusing `Combobox` as is. It is a text field with suggestions: it has no selected, mixed or partial marks and no "none" row.

## R7 — Context menus: one controlled DropdownMenu anchored at a point

- **Decision:** `editor/quick-edit/canvas-menu.tsx` renders a controlled `DropdownMenu` whose trigger is an invisible 0×0 anchor at `contextMenu.point`. Every way of opening it goes through this one component:
  - Right-click: `onNodeContextMenu`, `onEdgeContextMenu`, `onPaneContextMenu`, `onSelectionContextMenu`, plus `onContextMenu` on the group label and collapsed group. `preventDefault` stops the browser menu.
  - ⇧F10 or the ContextMenu key on the canvas opens the menu at the bottom-left of the focused object, or at the view centre when nothing is focused.
  - "More ⋯" opens it below the button.
  - Keyboard opening focuses the first enabled item (FR-035).
- **Rendering:** items come from `actionsFor(ctx, 'menu')`. Sections are separated. Arrange, Protocol, Direction and Add component are submenus. Delete is `destructive`. Disabled items carry their `disabledReason` as a tooltip. Items render through `dropdownKit`.
- **Selection rules:** right-clicking an unselected object selects it first. Right-clicking inside the selection keeps it (FR-034).
- **Modes:** in flow mode, a session or view-only, only the non-editing actions apply: Open details, Copy JSON and Fit.
- **Focus return:** `onCloseAutoFocus` returns focus to the object or button that opened the menu.
- **Rationale:** Radix ContextMenu cannot be opened from the keyboard or from a button. One controlled menu gives the same items, flipping and submenu collision for every entry point (the library's pattern, simplified). Radix already handles flipping and submenus with a −6 overlap (via `sideOffset`/`alignOffset`).
- **Alternative considered:** a ContextMenu for right-click plus a DropdownMenu for the keyboard. That means two components and two focus behaviours.

## R8 — Menu and toolbar actions (the concrete list)

| Action id                                | Surfaces (target)                                             | Run                                                                  | Notes                                                  |
| ---------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| `details.open`                           | toolbar (component), menu (all but canvas and mixed)          | select + `openDrawer()`                                              | ⏎ label on components                                  |
| `node.openInside`                        | menu (component with children)                                | `drillInto`                                                          | pointer path to drill (FR-001)                         |
| `title.rename`                           | toolbar (group), menu (component, group)                      | `startTitleEdit`                                                     | F2                                                     |
| `field.kind/owner/tags/tech/links/rules` | toolbar (component; kind/owner/tags/tech also for components) | opens the popover                                                    | R6                                                     |
| `json.copy`                              | menu (component, components, connection, group, mixed)        | `copyText(selectionText(...))` + toast                               | ⇧⌘C; `lib/clipboard.ts` extracted from the JSON header |
| `arrange.front` / `.back`                | menu ▸ Arrange (component, components)                        | `batch`: `reorder('nodes', id, end / 0)` keeping relative order      | FR-037                                                 |
| `view.pin`                               | menu (component, components) in a view                        | `useViewActions().pin(ids, !allPinned)`; label Pin / Unpin / Pin all | §g-46; pin hooks exported                              |
| `delete`                                 | menu (component, components, connection, mixed)               | `requestDelete` (existing dialog + toast)                            | FR-038                                                 |
| `edge.label`                             | toolbar + menu (connection)                                   | `openEdgePopover(id)`                                                | ⏎                                                      |
| `edge.protocol` / `.direction`           | toolbar (popover), menu ▸ (radio)                             | `oneStep(update('edges', …))`                                        | P opens the protocol popover                           |
| `group.collapse`                         | toolbar + menu (group)                                        | `toggleGroupCollapsed`                                               | Space (§g-48)                                          |
| `group.selectMembers`                    | toolbar + menu (group)                                        | `select({ nodes: direct members })`                                  |                                                        |
| `group.ungroup` / `group.delete`         | toolbar (ungroup), menu (delete group)                        | `oneStep(remove('groups', id))`: members move to the parent (002)    | ⇧⌘G bound in 019 (FR-042); tooltip on Delete group     |
| `canvas.add`                             | menu ▸ Add component (canvas)                                 | `addComponent(kind, point, { edit: true })`                          | 1–6                                                    |
| `canvas.addSticky`                       | menu (canvas)                                                 | `addNoteAt(editor, point)`                                           |                                                        |
| `canvas.selectAll` / `canvas.fit`        | menu (canvas)                                                 | the ⌘A body / `fitView({ padding: 0.2 })`                            | fit also in view-only                                  |

The delete key refuses groups today. The group menu offers only "Delete group" (the members are kept), per 104.

## R9 — Keys added or changed

| Key                       | Where                               | Behaviour                                                        |
| ------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| double-click              | `onNodeDoubleClick`                 | Component → title edit (FR-001). Group → drill, unchanged.       |
| F2                        | `useCanvasKeyDown`                  | Component or group → title edit. Sticky, unchanged.              |
| ⌘E                        | `useShellShortcuts`                 | Focus the toolbar (preventDefault; also skipped in text fields). |
| ⇧F10 / ContextMenu        | `useCanvasKeyDown`                  | Open the canvas menu for the current target.                     |
| ⇧⌘C                       | `useEditorShortcuts` (`event.code`) | Copy JSON of the selection.                                      |
| ⇧⌘G                       | `useEditorShortcuts` (`event.code`) | Ungroup the selected group (`group.ungroup`).                    |
| P                         | `useCanvasKeyDown`                  | On a selected connection → the protocol popover in the toolbar.  |
| Tab                       | `useCanvasKeyDown`                  | With a toolbar shown → into the toolbar.                         |
| Tab / ⇧Tab / ⌘⏎ / Esc / ⏎ | `CardTitleInput`                    | R2 / R3.                                                         |

All labels live in `shell/shortcuts.ts` (a new section "Quick edit"), so the help dialog lists them (FR-045). Single keys keep the `isTextTarget` guard (FR-044).

## R10 — Accessibility

- **Toolbar:** `role="toolbar"`, `aria-label="Selection: <n> components"` (or "Connection …" / "Group <title>"). Buttons are named, and field buttons use `aria-haspopup="dialog"` with `aria-expanded`.
- **Popover:** a `dialog` named after the field ("Owner"). The list is a `listbox` with `aria-multiselectable` for Tags. Mixed or partial state is carried in the option's text ("Mixed", "2 of 3"), not only in style.
- **Menu:** a `menu` named "Actions for <target>". Destructive items carry an icon and the word "Delete". Submenus are `menuitem`s with `aria-haspopup`.
- **Title input:** a `textbox` named "Component title" or "Group title". The placeholder is not the name.
- **Details button:** "Open details for <title>".
- **Announcements:** all go through the existing `announce()`.
- **Reduced motion:** there is no lift or transition animation; the static shadow stays (FR-046).

## R11 — Tokens and `packages/ui` additions

- **Tokens:**
  - `--sd-selection-text` (inline title selection highlight, light and dark values from design-analysis).
  - `--shadow-menu` `0 12px 32px var(--sd-shadow)`, applied to `lib/menu.ts` and to popovers opened from the toolbar (DESIGN.md "Float"). Both are registered in the tailwind-merge config.
- **Components:** `toolbar.tsx` (Radix Toolbar wrapper) and `choice-list.tsx`, both with keyboard tests by role, and both shown in the `/design` gallery.
- **InlineEdit:** gains the optional props from R2 without breaking current callers.

## R12 — Existing behaviour to update

- `addComponent` title "New <kind>" → "Untitled <kind>". Five test files assert "New service" and are updated. The smoke suite does not use it.
- `onNodeDoubleClick` no longer opens the drawer or drills for components. `canvas.test.tsx` / `editor-page.test.tsx` double-click cases are updated. The 018 spec text "double-click on a card opens the drawer" is superseded (noted in ADR 0015).
- `pin-controls.tsx` exports `usePinState` / `useTogglePins`.
- The JSON header uses the new `lib/clipboard.ts`.
- `pruneSelection` clears `titleEdit` and `contextMenu` when their target disappears.

## R13 — Testing and bench

- **Unit tests (pure):**
  - `actionsFor` (every target × mode matrix, FR-029 / SC-006)
  - `toolbarPlacement` (above, flip below < 68, clamp left and right)
  - `toolbarVariant`
  - `nextTitleTarget` (Tab order)
  - `arrangeOrder` (front / back keep relative order)
  - `choiceState` (selected / mixed / partial from `Shared<T>`)
- **Store tests:** `titleEdit`, `contextMenu`, `canvasGesture`, and prune.
- **Component tests (by role / name, per [contracts/quick-edit-ui.md](contracts/quick-edit-ui.md)):**
  - Inline edit: double-click, F2, Enter, Esc, blur, empty, Tab chain, one undo step.
  - New card: placeholder, ⌘⏎, Esc → "Untitled service", two undo steps.
  - Details button.
  - Toolbar: variants, ⌘E, arrows, Esc, flip, hides on gesture.
  - Each popover: owner on two nodes = one undo step, mixed, partial tags, none.
  - Menus: all four targets, ⇧F10 first item focused, disabled reason, Esc focus return, flow mode subset.
  - Copy JSON with the clipboard mocked.
  - `packages/ui` `Toolbar` and `ChoiceList`.
- **E2E:** no new tests. The smoke suite is unchanged (Enter still opens details).
- **Bench:** before and after. New scenario `selection-toolbar-pan`: pan and zoom with a 3-node selection and a visible toolbar, at 500 / 1,000. The details icon is CSS-only, so the `default` scenario must not regress (SC-007).

## R14 — ADR 0015

`docs/decisions/0015-canvas-actions-and-quick-edit.md` records:

- the shared action list and how later features plug in
- double-click → rename and Enter → details (superseding 018's double-click)
- the single point-anchored menu
- "Untitled <kind>" as the stored fallback title
