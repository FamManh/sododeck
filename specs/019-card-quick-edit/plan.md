# Implementation Plan: Card Quick Edit

**Branch**: `019-card-quick-edit` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/019-card-quick-edit/spec.md`. It was clarified on 2026-09-28: FR-001 uses option A, where double-click and F2 rename and Enter keeps its 018 behaviour.

**Dependency**: 018 (canvas-first layout) is merged on `main` (`406a098`). I checked these names on `main`:

- **Store:** `useUiStore` (`select`, `focus`, `focusEdge`, `openDrawer`, `openEdgePopover`, `announce`, `pruneSelection`, `drillInto`, `hideUi`, `activeFlow`, `flowSession`, `isFlowMode`).
- **Keys:** `useCanvasKeyDown`, `useEditorShortcuts`, `useShellShortcuts`, and `SHORTCUTS` / `shortcutLabel`.
- **Canvas handlers:** `onNodeDoubleClick` (in `use-canvas-handlers.ts`).
- **Canvas actions and geometry:** `addComponent` / `freeSpot` / `FREE_SPOT_STEP`, `panToClear` / `currentInsets`.
- **Fields:** `oneStep`, `bulkView` / `Shared<T>`, `KIND_OPTIONS`, `PROTOCOLS` / `DIRECTIONS`, `LinksField`, `AttachedRules`.
- **Other editor code:** `PinSwitch` (internal `usePinState` / `useTogglePins`), `toggleGroupCollapsed`, `addNoteAt`, `selectionView` / `selectionText`, `supportsClipboardWrite`.
- **Menus:** `dropdownKit`.
- **`packages/ui`:** `InlineEdit`, `DropdownMenu*`, `Popover*`, `TagChip`, `Tooltip*`.
- **Model:** `DeckEditor.{update, remove, reorder, batch}`.

## Summary

Most edits happen on the card itself.

- **Inline title edit** (R2, R3):
  - Double-click, F2 or Rename edits a component's or group's title inside the card. It uses `InlineEdit`, extended with a placeholder, select-all, `onCancel` and key passthrough.
  - The only state is `titleEdit` in the UI store plus the input's draft. The document is written once on commit, as one undo step.
  - New components start as "Untitled <kind>" in edit with an empty field. ⌘⏎ chains another card of the same kind.
  - Enter is unchanged: it opens details, or drills into a component with children. For a pointer, drilling moves to "Open inside".
- **Details icon** (R4): a CSS-only corner button on each card. It is hidden by `data-*` flags on the canvas wrapper, including one zoom flag, so there is no per-node subscription.
- **Selection toolbar** (R5, R6):
  - One overlay island placed from the selection's DOM rect. It is measured only at rest and hidden during gestures.
  - Variants: component, components, connection, group, mixed.
  - It is built on Radix Toolbar with a new `packages/ui` `ChoiceList` popover (filter, selected / mixed / partial, none).
  - Every pick is one undo step across the selection.
- **Context menus** (R7, R8): one controlled `DropdownMenu` anchored at a point serves right-click, ⇧F10 / ContextMenu and "More actions" for components, connections, groups, mixed selections and the empty canvas.
- **Shared actions** (R1): `editor/actions/` holds an action list (`applies`, `disabledReason`, `run`) used by the menus, the toolbar and the new keys. 016, 017 and 020 plug in by adding modules.
- **Keys** (R9): F2, ⌘E, ⇧F10 / ContextMenu, ⇧⌘C, P and Tab-into-toolbar. All labels come from `SHORTCUTS` ("Quick edit" section).
- **Tests / bench** (R13): pure unit tests, store tests, and component tests by role / name per the [contract](contracts/quick-edit-ui.md). No new e2e. Bench before and after, plus `selection-toolbar-pan`.
- **ADR 0015** (R14).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed, no new dependency.

- `@xyflow/react` 12: `onNodeContextMenu`, `onEdgeContextMenu`, `onPaneContextMenu`, `onSelectionContextMenu`, `onMoveStart` / `onMoveEnd`, `onNodeDragStart` / `onNodeDragStop`, `useStore` for one zoom flag.
- `zustand` 5.
- `radix-ui` (umbrella, already a `packages/ui` dependency): `Toolbar` is newly wrapped in `packages/ui`. `DropdownMenu` and `Popover` are already wrapped.
- `@sododeck/ui`: `InlineEdit` (extended), `DropdownMenu*`, `Popover*`, `Tooltip*`, `TagChip`, `focusRing`, plus the new `Toolbar` and `ChoiceList`.
- `lucide-react`: `PanelRight` (details), `Ellipsis`, `Shapes`, `User`, `Tags`, `Cpu`, `Link`, `Table2`, `ArrowUpToLine`, `ArrowDownToLine`, `Pin`, `PinOff`, `Copy`, `Trash2`, `Ungroup`, `ChevronsDownUp`, `SquareDashedMousePointer`, `Pencil`.

**Storage**: no document or schema change. New UI store fields: `titleEdit`, `contextMenu`, `toolbarField`, `canvasGesture` (see [data-model.md](data-model.md)).

**Testing**:

- **Vitest, pure:**
  - `actions/actions-for.ts`: target × mode matrix, unique ids, shortcuts exist.
  - `quick-edit/toolbar-placement.ts`: above, flip, clamp.
  - `toolbar-variant.ts`, `next-title-target.ts`, `arrange-order.ts`, `choice-state.ts`.
- **Vitest, store:** `titleEdit` refusal in flow / session / view-only, prune clears edit and menu, gesture closes the popover, `resetForDeck`.
- **Testing Library, by role and name:**
  - `card-title-input` (and inline edit in `deck-node`, `group-boundary-node`)
  - `details-button`, `selection-toolbar`, `field-popover` (each field)
  - `canvas-menu` (four targets, modes, keyboard open)
  - `use-canvas-shortcuts` (F2, ⇧F10, P, Tab), `use-shell-shortcuts` (⌘E), `use-editor-shortcuts` (⇧⌘C)
  - `packages/ui` `toolbar`, `choice-list`, `inline-edit`
- **Existing tests updated:** "New service" → "Untitled service" (5 files), double-click cases in `canvas.test.tsx` / `editor-page.test.tsx`, `pin-controls`, `json-panel-header`.
- **E2E:** no new tests (constitution VI). The smoke suite is unchanged (Enter still opens details).
- **Bench:** before and after, plus a new `selection-toolbar-pan`.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox and Safari. The clipboard write goes through `supportsClipboardWrite()` (`features.ts`).

**Project Type**: web app (monorepo). Changes are in `apps/app` and `packages/ui` (2 components, 2 tokens, `InlineEdit` props). `packages/schema` and `packages/model` are untouched.

**Performance Goals**:

- 60 fps pan / zoom at 500 / 1,000 with a selection and its toolbar (SC-007).
- The toolbar appears ≤ 100 ms after a selection change (SC-004).
- No per-node zoom subscription. No toolbar work during pan / zoom (hidden, measured on `onMoveEnd`).

**Constraints**: no document writes except on commit or pick. Each change is one undo step. No network. The clipboard write happens only on an explicit Copy JSON.

**Scale/Scope**:

- About 18 new files: `editor/actions/` (~8) and `editor/quick-edit/` (~10).
- 2 new `packages/ui` components.
- About 15 changed files.
- 1 ADR.

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes, with no deviations._

| Principle                        | Status | How                                                                                                                                                                                                                                                                           |
| -------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth        | ✅     | Title and fields are read from the snapshot and written through `useEditor()`. The only copies are the input draft and the filter text (FR-009, FR-047). The new store fields are UI-only.                                                                                    |
| II. Schema-owned format          | ✅     | No schema or model change. Arrange uses the existing node order and `reorder`. The "Untitled <kind>" fallback keeps `Text` `minLength: 1` valid.                                                                                                                              |
| III. Stable identity             | ✅     | Renames change `title` only. Every action targets objects by id. `titleEdit` and `contextMenu` targets are pruned when their object disappears.                                                                                                                               |
| IV. Local-first, private         | ✅     | No network. Copy JSON writes to the local clipboard only on an explicit user action, feature-detected. The smoke no-third-party test is unchanged.                                                                                                                            |
| V. Performance off main thread   | ✅     | No heavy work. The details icon is CSS-only with one zoom flag. The toolbar is measured at rest only. Bench before and after, with a toolbar pan scenario.                                                                                                                    |
| VI. Strict types, tested         | ✅     | Pure modules are unit-tested and components are tested by role / name per the contract. No new e2e.                                                                                                                                                                           |
| VII. Accessible                  | ✅     | Every action is reachable by keyboard (F2, ⌘E, arrows, ⇧F10, P, Tab). The toolbar, menu, dialog and listbox have roles and names, and changes are announced. Mixed and partial states are in text. Destructive items have an icon plus the word. Reduced motion is respected. |
| VIII. Simplicity, justified deps | ✅     | No new dependency (Radix Toolbar ships in the existing `radix-ui`). Links and Rules reuse the 008 editors. Existing keys are kept rather than re-plumbed. ADR 0015 records the decisions.                                                                                     |

## Project Structure

### Documentation (this feature)

```text
specs/019-card-quick-edit/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R14
├── data-model.md        # Phase 1: UI store fields, Action shape, transitions, validation
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── quick-edit-ui.md # user-visible contract (roles, names, keys, texts, menu items)
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/ui/src/
├── components/toolbar.tsx (+test)          # NEW Radix Toolbar wrapper: Toolbar, ToolbarButton, ToolbarSeparator
├── components/choice-list.tsx (+test)      # NEW filter + listbox; selected / mixed / partial / none / "Use '…'"
├── components/inline-edit.tsx (+test)      # + placeholder, autoFocus/selectAll, onCancel, onKeyDown, className
├── lib/menu.ts                             # shadow-menu
├── lib/utils.ts                            # tailwind-merge: shadow-menu
├── styles/tokens.css, theme.css            # + --sd-selection-text, --shadow-menu
└── (design gallery entries in apps/app/src/design-gallery/)
apps/app/src/
├── editor/actions/                         # NEW (R1, R8)
│   ├── types.ts                            # Action, ActionContext, MenuTarget, Section
│   ├── actions-for.ts (+test)              # pure: applicable actions per surface / target / mode
│   ├── index.ts (+test)                    # ACTIONS list (unique ids, shortcuts exist)
│   ├── title-actions.ts                    # details.open, node.openInside, title.rename
│   ├── field-actions.ts                    # field.* (open popovers)
│   ├── arrange-actions.ts, arrange-order.ts (+test)
│   ├── connection-actions.ts               # edge.label, edge.protocol, edge.direction
│   ├── group-actions.ts                    # collapse, selectMembers, ungroup, delete
│   ├── canvas-actions.ts                   # add ▸, add sticky, select all, fit
│   ├── common-actions.ts                   # json.copy, view.pin, delete
│   └── use-action-context.ts               # builds ActionContext; runAction(id)
├── editor/quick-edit/                      # NEW (R2–R7)
│   ├── card-title-input.tsx (+test)        # InlineEdit in the card; Tab / ⌘⏎ / Esc rules
│   ├── title-edit.ts (+test)               # commitTitle, nextTitleTarget (pure parts)
│   ├── details-button.tsx (+test)
│   ├── selection-toolbar.tsx (+test)       # overlay island, variants, ⌘E / Esc / Tab
│   ├── toolbar-placement.ts (+test)        # pure placement
│   ├── toolbar-variant.ts (+test)
│   ├── selection-rect.ts                   # DOM rect union of selected elements
│   ├── field-popover.tsx (+test)           # Popover + ChoiceList per field; Links / Rules reuse 008
│   ├── choice-state.ts (+test)             # Shared<T> → ChoiceList options
│   └── canvas-menu.tsx (+test)             # controlled DropdownMenu at a point
├── state/ui-store.ts (+test)               # + titleEdit, contextMenu, toolbarField, canvasGesture
├── lib/clipboard.ts (+test)                # copyText (from json-panel-header)
├── editor/deck-node.tsx (+test)            # title → CardTitleInput when editing; DetailsButton
├── editor/group-boundary-node.tsx, collapsed-group-node.tsx (+tests)  # label inline edit; onContextMenu
├── editor/canvas.tsx (+test)               # context-menu handlers, move / drag gesture flags, data-* flags
├── editor/use-canvas-handlers.ts           # double-click → title edit (FR-001)
├── editor/use-canvas-shortcuts.ts (+test)  # F2, ⇧F10 / ContextMenu, P, Tab, ⇧⌘C
├── editor/canvas-actions.ts (+test)        # addComponent(…, { edit }); "Untitled <kind>"
├── editor/shell/use-shell-shortcuts.ts (+test)  # ⌘E
├── editor/shell/shortcuts.ts (+test)       # "Quick edit" section
├── editor/shell/canvas-shell.tsx           # mounts SelectionToolbar + CanvasMenu in the overlay
├── editor/views/pin-controls.tsx           # export usePinState / useTogglePins
├── editor/json-panel-header.tsx            # use lib/clipboard.ts
├── editor/palette.tsx                      # add with { edit: true }
└── bench/perf.bench.ts                     # + selection-toolbar-pan
docs/decisions/0015-canvas-actions-and-quick-edit.md  # NEW ADR
apps/app/CLAUDE.md, packages/ui/CLAUDE.md   # updated (actions module, quick-edit, new ui components)
```

**Structure Decision**: the monorepo layout is unchanged.

- **`editor/actions/`** is the action list that later features extend.
- **`editor/quick-edit/`** holds the surfaces (inline edit, details icon, toolbar, popovers, menu).
- **`packages/ui`** gains only presentational pieces (`Toolbar`, `ChoiceList`, `InlineEdit` props, 2 tokens), because the design inventory marks the toolbar popover and context menu as "ui ➕".

## Complexity Tracking

No constitution violations to justify.
