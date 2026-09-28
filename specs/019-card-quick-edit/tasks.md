# Tasks: Card Quick Edit

**Input**: design documents in `specs/019-card-quick-edit/`:

- [plan.md](plan.md) and [spec.md](spec.md). The spec was clarified on 2026-09-28 (FR-001: option A).
- [research.md](research.md) (R1–R14) and [data-model.md](data-model.md).
- [contracts/quick-edit-ui.md](contracts/quick-edit-ui.md).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI asks for unit tests (Vitest) for every pure module and store, and for component tests (Testing Library) that query by role and name as given in [quick-edit-ui.md](contracts/quick-edit-ui.md). Write each test first and watch it fail. Do not add Playwright tests. The smoke suite must pass unchanged.

**Scope guards**:

- No change to `packages/schema` or `packages/model`. Every write goes through `useEditor()` and is exactly one undo step (`oneStep` / `editor.batch`). The only local copies of document values are the input draft and the filter text (FR-009, FR-047).
- **Enter keeps its 018 behaviour**: it opens details on a plain component and drills into a component with children. Double-click and F2 rename (FR-001).
- **Not shown until the feature that owns them lands**:
  - 016: Copy, Paste, Duplicate, Group (⌘G), Align, nudge.
  - 017: Reset route, handles.
  - 020: Fill, Stroke.
- **No new fields** (§g-40). Links and Rules popovers reuse the 008 editors (`LinksField`, `AttachedRules`).
- **Stickies**: no new sticky toolbar.

**Approvals**: no new runtime dependency. Radix Toolbar comes from the existing `radix-ui` umbrella in `packages/ui`. No Complexity Tracking items.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, and no dependency on an unfinished task).
- **[Story]**: US1–US7 from spec.md.

## Path Conventions

- **App**: `apps/app/src/…`, with tests next to the code (`*.test.ts(x)`).
  - New code goes in `apps/app/src/editor/actions/` and `apps/app/src/editor/quick-edit/`.
  - Test harnesses are in `apps/app/src/test/` (`render-canvas.tsx`, `render-inspector.tsx`).
  - Read `apps/app/CLAUDE.md` first. Canvas recipes are in `.agents/skills/react-flow/SKILL.md`.
- **UI**: `packages/ui/src/…`. Read `packages/ui/CLAUDE.md` first: tokens only, no `dark:`, `focusRing`, `data-slot`, and a gallery entry for every new component.
- **Shortcuts**:
  - "⌘" means ⌘ on Apple platforms and Ctrl elsewhere (`isMod` in `apps/app/src/lib/features.ts`).
  - Single-letter keys are ignored in text targets (`isTextTarget`).
  - Canvas keys go in `editor/use-canvas-shortcuts.ts`, and shell keys in `editor/shell/use-shell-shortcuts.ts`.
  - Every visible label comes from `editor/shell/shortcuts.ts`.
- **Commits**: after each task or logical group, use Conventional Commits (`feat(app): …`, `feat(ui): …`, `test(app): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Create branch `019-card-quick-edit` from the latest `main`. Run `pnpm install && pnpm test` to confirm a green start.
- [x] T002 Run `pnpm bench` on the unchanged code and save the table in `specs/019-card-quick-edit/bench-before.md`.
- [x] T003 Add the `selection-toolbar-pan` scenario to `apps/app/bench/perf.bench.ts` (R13, SC-007). On the 500 / 1,000 deck it selects three nodes and waits for `role=toolbar` named `/^Selection:/`. It records the time from the selection click to the toolbar being visible (SC-004, target ≤ 100 ms), then measures pan and zoom fps the same way as the `default` scenario. Until the toolbar exists (T030), it logs `TODO(019): not available yet` and records no number. This is not a skipped test.
- [x] T004 [P] Write ADR `docs/decisions/0015-canvas-actions-and-quick-edit.md` in the header format of 0014. It covers:
  - R1: the shared action list, and how 016, 017 and 020 add modules.
  - R2 / FR-001: double-click and F2 rename, and Enter keeps its behaviour. This supersedes 018's "double-click opens the drawer".
  - R3: the stored fallback "Untitled <kind>", because `Text` has `minLength: 1`.
  - R5: toolbar placement from DOM rects, measured at rest.
  - R7: one controlled menu anchored at a point, for right-click, keyboard and "More".
  - The alternatives listed in research.

---

## Phase 2: Foundational (blocks every user story)

### Tokens and `packages/ui`

- [x] T005 [P] Add `--sd-selection-text` (light and dark values from `docs/design/design-analysis.md` "`--seltx`" row, mapped to our palette) and `--shadow-menu: 0 12px 32px var(--sd-shadow)` to `packages/ui/src/styles/tokens.css` and `theme.css`.
  - Register `shadow-menu` in the tailwind-merge config in `packages/ui/src/lib/utils.ts`.
  - Switch the menu content class in `packages/ui/src/lib/menu.ts` from `shadow-float` to `shadow-menu`.
  - Add an `::selection` rule scoped to `[data-slot=inline-edit]`.
  - Extend the token parity test in `packages/ui/test/`. `tokens-only.test.ts` must stay green.
- [x] T006 [P] Extend `packages/ui/src/components/inline-edit.tsx` (+ its test) with the optional props from R2. Existing callers (`deck-name.tsx`, `view-switcher.tsx`, `flows/rename-field.tsx`) must behave the same. The new props:
  - `placeholder`
  - `autoFocus` (focuses and selects all text on mount)
  - `startEmpty` (the draft starts as `''`)
  - `onCancel()` (called on Esc after reverting)
  - `onKeyDown(event, draft)` (called before the built-in handling; `preventDefault` there skips the built-in Enter / Esc)
  - `className`
  - `aria-label`, which overrides `label`

  Tests: select-all on mount, placeholder shown with an empty draft, Esc calls `onCancel`, and a `preventDefault` in `onKeyDown` suppresses the commit.

- [x] T007 [P] Create `packages/ui/src/components/toolbar.tsx` (+ `toolbar.test.tsx`). It wraps Radix `Toolbar` from `radix-ui` and exports `Toolbar`, `ToolbarButton` and `ToolbarSeparator`, styled to the inventory: 44 tall, 4 padding, 34 px buttons, 1×20 dividers, Surface, 1 px Hairline, 12 radius, `shadow-hover`.
  - Button states: hover Surface 2, `data-state=open` → Orange Soft + Orange Ink, disabled 40 %, `focusRing`.
  - Tests by role: `toolbar` with its name; ← / → / Home / End move focus; disabled buttons are skipped.
- [x] T008 [P] Create `packages/ui/src/components/choice-list.tsx` (+ `choice-list.test.tsx`) per R6 and the contract's "Field popover".
  - Props: `label`, `filterLabel`, `options: { value; label; state?: 'selected' | 'partial'; count?: string }[]`, `mixed?: boolean`, `none?: { label }`, `create?: (typed) => string | null`, `multiple?`, `onPick(value | null)`.
  - It renders a `searchbox` (focused on mount) plus a `listbox`. It shows a "Mixed" note when `mixed`, a check on selected rows, and partial rows as a dashed `TagChip` with the count in the text ("2 of 3").
  - Keys: ↑ / ↓ move the active option (`aria-activedescendant`), and Enter picks. In multiple mode Enter toggles and the list stays open.
  - Tests: filter narrows the list, "none" returns `null`, "Use 'x'" appears only when `create` returns text, and partial text is present.
- [x] T009 Add gallery entries for `Toolbar`, `ChoiceList` and the new `InlineEdit` props in `apps/app/src/design-gallery/` (the pattern of `overlays-section.tsx`). Update the components table in `packages/ui/CLAUDE.md`.

### Store, clipboard, shortcuts

- [x] T010 Extend `apps/app/src/state/ui-store.ts` (+ `ui-store.test.ts`) with the data-model "UI store additions":
  - Fields: `titleEdit`, `contextMenu`, `toolbarField`, `canvasGesture`.
  - Actions: `startTitleEdit`, `endTitleEdit`, `openContextMenu`, `closeContextMenu`, `openToolbarField`, `closeToolbarField`, `setCanvasGesture`.
  - Export types `TitleEdit`, `MenuTarget`, `ToolbarFieldId`.
  - Tests:
    - `startTitleEdit` is refused while `isFlowMode`, in a `flowSession` or in view-only mode, and it closes the menu and field.
    - `setCanvasGesture` closes `toolbarField`.
    - `pruneSelection` clears `titleEdit` and `contextMenu` whose targets are gone.
    - `resetForDeck` clears all four fields.
- [x] T011 [P] Create `apps/app/src/lib/clipboard.ts` (+ test). `copyText(text): Promise<boolean>` uses `supportsClipboardWrite()` and `navigator.clipboard.writeText`, and returns `false` on failure or when unsupported. Refactor `apps/app/src/editor/json-panel-header.tsx` to use it, with the same toasts. Its existing tests must stay green.
- [x] T012 [P] Add a "Quick edit" section to `apps/app/src/editor/shell/shortcuts.ts` (+ test) with these ids:
  - `rename` (F2; double-click noted in the label)
  - `saveAndAddAnother` (⌘⏎)
  - `focusToolbar` (⌘E)
  - `contextMenu` (⇧F10)
  - `copyJson` (⇧⌘C)
  - `ungroup` (⇧⌘G)
  - `connectionProtocol` (P)
  - `openDetails` (⏎, reuse it if it already exists)
  - `collapseGroup` (Space, reuse it if it exists)
  - `selectAll` (⌘A)
  - `fit` (⌘0)

  Uniqueness tests stay green, and the help dialog lists the section (FR-045).

### Action list (R1)

- [x] T013 Create `apps/app/src/editor/actions/types.ts` with the data-model "Action" and `ActionContext` types: `Action`, `ActionContext`, `Surface = 'menu' | 'toolbar'`, `Mode = 'edit' | 'flow' | 'session' | 'viewOnly'`, `Section` (ordered `open`, `edit`, `clipboard`, `arrange`, `view`, `danger`) and `ResolvedSection { id; actions: ResolvedAction[] }`. A `ResolvedAction` has `label` resolved, plus `disabled: string | null` and `children?`.
- [x] T014 Create `apps/app/src/editor/actions/actions-for.ts` (+ `actions-for.test.ts`). The pure `actionsFor(list, ctx, surface): ResolvedSection[]` filters by `surfaces`, `targets` and `modes` and then `applies`. It resolves labels and `disabledReason`, drops empty sections, and keeps section and list order. Tests use a fake list and cover the target × mode matrix and section ordering.
- [x] T015 Create `apps/app/src/editor/actions/index.ts` (+ `index.test.ts`), which exports `ACTIONS: readonly Action[]` built from the per-area modules. It starts empty and is filled in by story tasks. Tests: ids are unique, every `shortcut` exists in `SHORTCUTS`, and every action has at least one surface and one target.
- [x] T016 Create `apps/app/src/editor/actions/use-action-context.ts`:
  - `useActionContext(target?: MenuTarget, point?)` builds `ActionContext` from `useEditor()`, `useDeckSnapshot()`, `useUiStore`, the current view id (`useViewState`) and the mode (flow / session / view-only).
  - `targetOf(selection, deck): MenuTarget` returns `component | components | connection | group | sticky | mixed | canvas` (`sticky` = only stickies selected).
  - `useRunAction()` returns `(id, ctx) => void`, which finds the action and runs it only when it applies and is enabled. Keys use this helper so their availability matches the menus (FR-039).
  - Add unit tests for `targetOf`.

**Checkpoint**: foundation ready. `pnpm lint && pnpm typecheck && pnpm test` is green.

---

## Phase 3: User Story 1 — Rename a component where it is (P1) 🎯 MVP

**Goal**: double-click or F2 edits a component's or group's title inside the card. Enter or blur commits and Esc cancels. An empty or unchanged title writes nothing. Tab chains to the next card. Each rename is one undo step.

**Independent test**: double-click a card, type "Billing API" and press Enter. The card, outline, drawer and JSON all show it, and one ⌘Z restores the old title. Repeat with Esc, with an empty title and with Tab (spec US1).

- [ ] T017 [P] [US1] Create `apps/app/src/editor/quick-edit/title-edit.ts` (+ `title-edit.test.ts`), with no React:
  - `commitTitle(editor, target, id, draft, previous): 'renamed' | 'unchanged'`. It trims the draft. Empty or equal → `'unchanged'` with no write. Otherwise it runs `oneStep(editor, () => editor.update(target === 'node' ? 'nodes' : 'groups', id, { title }))`.
  - `nextTitleTarget(order: readonly Id[], id, dir: 1 | -1): Id | null`, where the order comes from the same reading order the arrow keys use (`editor/focus-set.ts`).
  - Tests: trimming, empty, unchanged, exactly one undo step (`editor.undo()` restores), and wrap-free next / previous.
- [ ] T018 [US1] Create `apps/app/src/editor/quick-edit/card-title-input.tsx` (+ test). It wraps `InlineEdit` with `autoFocus`, `aria-label` "Component title" or "Group title", and `className` sized to the title line, so the card keeps its size.
  - **Commit:** `commitTitle`, then `announce("Renamed to …")` when renamed, then `endTitleEdit()`.
  - **Esc:** `endTitleEdit()`, and focus returns to the card (`focus(id)`).
  - **Tab / ⇧Tab:** preventDefault, commit, then `startTitleEdit` on `nextTitleTarget(...)`. The canvas reveals and focuses that card, and `select({ nodes: [next] })`.
  - Test by role with `render-canvas` harness.
- [ ] T019 [US1] Change `apps/app/src/editor/deck-node.tsx` (+ `deck-node.test.tsx`). When `useUiStore(s => s.titleEdit?.id === id)` is true, it renders `CardTitleInput` in place of the title span, in both the component and container layouts. The selector must return a boolean so other nodes don't re-render. Test: with the store set, the textbox "Component title" is in the card and the title span is gone.
- [ ] T020 [P] [US1] Change `apps/app/src/editor/group-boundary-node.tsx` and `collapsed-group-node.tsx` (+ tests). While `titleEdit` targets the group, they render the label as `CardTitleInput` with target `group`. Double-click on the label still drills in (010).
- [ ] T021 [US1] Change `onNodeDoubleClick` in `apps/app/src/editor/use-canvas-handlers.ts` (FR-001). For any component (with or without children) it calls `select({ nodes: [id] }); focus(id); startTitleEdit({ target: 'node', id, isNew: false })`. Groups, stickies and ports are unchanged. It does nothing in view-only, flow or session modes.
  - Update the double-click cases in `apps/app/src/editor/canvas.test.tsx` and `apps/app/src/routes/editor-page.test.tsx`. Double-click now shows the textbox and no longer opens the drawer or drills. Enter still opens the drawer, and still drills into a component with children.
- [ ] T022 [US1] Add F2 to `useCanvasKeyDown` in `apps/app/src/editor/use-canvas-shortcuts.ts` (+ test). On the current component → `startTitleEdit({ target: 'node' })`. On a current group → `startTitleEdit({ target: 'group' })`. Stickies keep their existing F2. It is ignored in text targets and non-edit modes. Enter behaviour is untouched (the existing Enter tests must still pass).
- [ ] T023 [US1] Create `apps/app/src/editor/actions/title-actions.ts`, with ids from contract R8. Register it in `ACTIONS`, and add cases to `index.test.ts` / `actions-for.test.ts` for component, group, flow mode and a component with children.
  - `details.open`: all targets except canvas and mixed. Modes: edit, flow, session, viewOnly. Shortcut `openDetails`. Run: select + `openDrawer()`.
  - `node.openInside`: a component with `childCount > 0`. Run: `drillInto`.
  - `title.rename`: component and group, edit mode. Shortcut `rename`. Run: `startTitleEdit`.
- [ ] T024 [US1] Edge cases (spec) in `card-title-input.test.tsx` / `deck-node.test.tsx`:
  - Removing the node (via `editor.remove` in the test) ends the edit without writing.
  - A click on another card commits first.
  - ⌘Z typed inside the input does not undo the document.
  - When title edit starts on a card under the drawer, `panToClear` pans it into view. This reuses the drawer's helper from `editor/shell/shell-geometry.ts` via a small hook in `card-title-input.tsx`.

**Checkpoint**: US1 is demonstrable on its own (quickstart 1–2).

---

## Phase 4: User Story 2 — Add and name new components quickly (P1)

**Goal**: new components start in title edit with an empty field and the placeholder "Name this component". ⌘⏎ saves and adds another of the same kind. Esc keeps "Untitled <kind>".

**Independent test**: press C then 2, type "Auth", press ⌘⏎, type "Users" and press Enter. Add another and press Esc: it stays "Untitled service". Two ⌘Z undo the name, then the card (spec US2).

- [ ] T025 [US2] Change `addComponent` in `apps/app/src/editor/canvas-actions.ts` (+ test).
  - The title becomes `Untitled ${kindLabel(kind).toLowerCase()}` (via `editor/kind-label.ts`).
  - There is a new optional `{ edit?: boolean }`. With `edit`, it calls `startTitleEdit({ target: 'node', id, isNew: true, kind })` after select / focus.
  - The announcement stays "Added …".
  - Placement keeps the existing `freeSpot` rule (offset while another card sits at exactly the same spot; FR-012 as clarified). Do not change `freeSpot`.
  - Update the "New service" assertions in `state/ui-store.test.ts`, `routes/editor-page.test.tsx`, `editor/canvas.test.tsx`, `editor/announcer.test.tsx` and `editor/palette.test.tsx`.
- [ ] T026 [US2] In `CardTitleInput` (+ test), when `isNew` is set it passes `startEmpty` and `placeholder="Name this component"`:
  - **Esc** or an **empty commit** → `endTitleEdit()` with no write, so the title stays "Untitled <kind>" (FR-014).
  - **⌘⏎** → commit when not empty, then `addComponent(editor, kind, freeSpot(deck, position + 24), { edit: true })`.
  - Tests: placeholder shown, Esc keeps "Untitled service", ⌘⏎ creates a second card in edit, and exactly two undo steps (name, then card; FR-015).
- [ ] T027 [P] [US2] Pass `{ edit: true }` from every add path (FR-011):
  - the palette click in `apps/app/src/editor/palette.tsx`
  - digits 1–6 in `apps/app/src/editor/shell/use-shell-shortcuts.ts`
  - drop in `apps/app/src/editor/use-canvas-handlers.ts` (`onDrop`)

  Test: the palette flyout stays open after a number-key add (018 rules), and focus is in the new card's textbox.

**Checkpoint**: US1 + US2 cover "name boxes fast" (quickstart 3).

---

## Phase 5: User Story 3 — Edit common fields from a toolbar on the selection (P1)

**Goal**: one floating toolbar above the selection. The one-component and multi-component variants have Kind, Owner, Tags, Tech, Links and Rules popovers. Each pick is one undo step across the selection. The toolbar flips below near the top, stays inside the window, and hides during gestures.

**Independent test**: select one card and change each field. Select two cards, set Owner once, and one ⌘Z reverts both. A selection near the top shows the toolbar below. Panning hides it (spec US3).

- [ ] T028 [P] [US3] Create `apps/app/src/editor/quick-edit/toolbar-placement.ts` (+ test). `toolbarPlacement(rect, size, viewport, { gap = 12, topLimit = 68, edge = 12 })` → `{ x, y, side }`. It centres over the rect, flips below when `rect.top - gap - size.height < topLimit`, and clamps x to `[edge, viewport.width - edge - size.width]`. Tests: above, flip, left and right clamps, and a rect wider than the window.
- [ ] T029 [P] [US3] Create `apps/app/src/editor/quick-edit/toolbar-variant.ts` (+ test). `toolbarVariant(selection): 'component' | 'components' | 'connection' | 'group' | 'mixed' | 'none'`. Only stickies, or nothing, → `none`. One edge → `connection`. One group → `group`. Nodes only → `component(s)`. Anything else → `mixed`.
- [ ] T030 [US3] Create `apps/app/src/editor/quick-edit/selection-rect.ts` (the union of `getBoundingClientRect()` over `[data-id="<id>"]` elements for selected nodes, edges and groups, following the pattern in `shell/detail-drawer.tsx`). Also create `apps/app/src/editor/quick-edit/selection-toolbar.tsx` (+ test):
  - It reads the selection, `canvasGesture`, `titleEdit`, flow / session / view-only and `hideUi`, and renders nothing when hidden (FR-026).
  - It measures the rect on selection change and on a `canvasGesture` → `null` transition, then places itself with `toolbarPlacement`. It is `fixed` inside the overlay layer.
  - It renders `Toolbar` named per the contract, with buttons from `actionsFor(ACTIONS, ctx, 'toolbar')`.
  - Field buttons are `aria-haspopup="dialog"`, with the value in the name ("Owner: Payments team" or "Owner: Mixed").
  - Tests: hidden during a gesture, title edit and flow mode; the name for 1 and for 3 selected; the flip, with the rect mocked.
- [ ] T031 [US3] Mount `SelectionToolbar` in the overlay layer in `apps/app/src/editor/shell/canvas-shell.tsx`, so Hide UI hides it. In `apps/app/src/editor/canvas.tsx`, set `canvasGesture` from React Flow `onMoveStart` / `onMoveEnd` (only when the move comes from a user event) and `onNodeDragStart` / `onNodeDragStop`. Existing canvas tests must stay green.
- [ ] T032 [P] [US3] Create `apps/app/src/editor/quick-edit/choice-state.ts` (+ test). `choiceState(shared: Shared<T>, options, format)` → `ChoiceList` options with `selected` / `mixed`. `tagChoices(nodes)` → options with `partial` and "n of N". `deckValues(deck, field)` gives the distinct owners or techs, sorted case-insensitively. It builds on `inspector/derive.ts` `bulkView`.
- [ ] T033 [US3] Create `apps/app/src/editor/quick-edit/field-popover.tsx` (+ test). It is a `Popover` anchored to the toolbar button, open while `toolbarField === id`, a `dialog` named after the field, with `shadow-menu` and a width of 236–272.
  - **Kind:** `ChoiceList` from `KIND_OPTIONS`.
  - **Owner / Tech:** `ChoiceList` with `none` ("No owner" / "No technology") and `create`.
  - **Tags:** multiple.
  - **Links:** renders `LinksField`.
  - **Rules:** renders `AttachedRules`.
  - **Writes:** single node → `oneStep(update)`. Multi → `editor.batch` over all nodes, wrapped in `oneStep` (the same shape as `writeAllOnce` in `inspector/bulk-inspector.tsx`; extract a shared helper if needed). Then it announces "<Field> set to <value> on <n> components" (FR-025, FR-043).
  - **Esc** closes it and focuses its toolbar button.
  - Tests: owner on two nodes = one undo step; mixed shown; partial tag applied to all; "No owner" clears; Esc focus return.
- [ ] T034 [US3] Create `apps/app/src/editor/actions/field-actions.ts`. `field.kind`, `field.owner`, `field.tags` and `field.tech` apply to component and components. `field.links` and `field.rules` apply to component only. All are toolbar only, edit mode, and run `openToolbarField(id)`. Also add the toolbar surface to `details.open`, for the **component** target only (the components and group variants have no Open details button, per the contract). Register them in `ACTIONS`. Order: Open details, Kind, Owner, Tags, Tech, Links, Rules, then More (T040).
- [ ] T035 [US3] Live sync check in `selection-toolbar.test.tsx`: after a pick, the drawer (if open) and `selectionView` show the new value, with no local copy (FR-027, FR-047).

**Checkpoint**: all P1 stories are done. This is the recommended first merge point (quickstart 1, 3, 5).

---

## Phase 6: User Story 4 — Open details from the card itself (P2)

**Goal**: a round details button on the card's top-right corner, shown on hover or focus, opens the drawer on that card. It is hidden while dragging, in flow mode, in Hide UI, in view-only and on tiny cards.

**Independent test**: hover a card, click the icon, and the drawer opens on it. Tab to a card and activate the icon by keyboard. Zoom out and the icon disappears (spec US4).

- [ ] T036 [P] [US4] Create `apps/app/src/editor/quick-edit/details-button.tsx` (+ test). A `button` named "Open details for <title>", with the tooltip "Open details" and the `PanelRight` icon, 22 px, in the inverse style. `tabIndex` follows the card's roving `tabIndex`. `onClick` / `onKeyDown` stop propagation, then `select({ nodes: [id] }); focus(id); openDrawer()` (FR-017).
- [ ] T037 [US4] Render `DetailsButton` in `apps/app/src/editor/deck-node.tsx` (+ test), positioned top-right.
  - Show it with `group-hover/node:opacity-100 group-focus-within/node:opacity-100`, and lift the card with `shadow-hover` on hover (no transition under reduced motion).
  - Hide it with CSS when an ancestor has `[data-dragging]`, `[data-flow]`, `[data-view-only]`, `[data-hide-ui]` or `[data-tiny-cards]`, or when the node itself is being dragged (the React Flow `dragging` prop).
  - Not rendered while `titleEdit` targets this card.
- [ ] T038 [US4] In `apps/app/src/editor/canvas.tsx` (+ test), set the `data-*` flags on the canvas wrapper. `data-tiny-cards` comes from one `useStore` selector: `zoom * NODE_SIZE.width < 80`, boolean. Test: each flag hides the button (`toBeVisible` false via computed style, or assert the attribute plus a class contract), and the node components do not subscribe to zoom.

**Checkpoint**: quickstart 4.

---

## Phase 7: User Story 5 — Right-click for the actions that apply (P2)

**Goal**: one context menu for components, selections, connections, groups and the empty canvas, listing only the actions that apply. It opens by right-click, ⇧F10 / ContextMenu or "More actions".

**Independent test**: right-click each target and compare with the contract table. Open the same menus with ⇧F10 and from "More" (spec US5).

- [ ] T039 [US5] Create `apps/app/src/editor/quick-edit/canvas-menu.tsx` (+ test), a controlled `DropdownMenu` (R7):
  - It is open while `contextMenu !== null`, and its trigger is an invisible 0×0 anchor fixed at `contextMenu.point`.
  - Its content is a `menu` named "Actions for <target>", built from `actionsFor(ACTIONS, ctx, 'menu')` and rendered with `dropdownKit` from `lib/menu-kit.ts`:
    - separators between sections
    - `shortcut` hints from `shortcutLabel`
    - `destructive` for the danger section, with the `Trash2` icon
    - submenus for `children`
    - disabled items with their reason as a tooltip
  - With `via: 'keyboard' | 'toolbar'`, `onOpenAutoFocus` focuses the first enabled item. `onCloseAutoFocus` restores `returnFocus`.
  - Mount it in `editor/shell/canvas-shell.tsx`. Unlike the toolbar, it stays available under Hide UI, so mount it outside the part that Hide UI removes.
  - Tests: first item focused (keyboard), Esc restores focus, and a disabled item has a description.
- [ ] T040 [US5] Wire right-click in `apps/app/src/editor/canvas.tsx` / `use-canvas-handlers.ts` (+ tests):
  - `onNodeContextMenu`, `onEdgeContextMenu`, `onSelectionContextMenu` and `onPaneContextMenu` each call `preventDefault`. An unselected target is selected first, and right-clicking inside the selection keeps it (FR-034). Then `openContextMenu({ target: targetOf(...), point: { x: clientX, y: clientY }, via: 'pointer' })`.
  - Group labels and collapsed groups get `onContextMenu` in `group-boundary-node.tsx` / `collapsed-group-node.tsx`.
  - Sticky nodes go through `onNodeContextMenu` as well: the target is `sticky` (FR-033a).
  - Add a "More actions" toolbar action (`more`: component, components, connection, group and mixed variants; toolbar only) in `apps/app/src/editor/actions/common-actions.ts`. It opens the menu below its button with `via: 'toolbar'`.
- [ ] T041 [US5] Add ⇧F10 and the ContextMenu key to `useCanvasKeyDown` (+ test). The target is the current focused object or selection, and the canvas when there is none. The point is the bottom-left of the object's `getBoundingClientRect()`, or the canvas centre. `via: 'keyboard'`.
- [ ] T042 [P] [US5] Complete `apps/app/src/editor/actions/common-actions.ts` (+ cases in `actions-for.test.ts`):
  - **`json.copy`** (component, components, connection, group, sticky, mixed; all modes; shortcut `copyJson`): `copyText(selectionText(selectionView(...).entries))`, then the toast "Copied JSON for <label>", or the existing "Couldn't copy …" toast (FR-036).
  - **`view.pin`** (component and components, edit mode, only while a view is active): label "Pin" / "Unpin" / "Pin all" / "Unpin all" from `usePinState` logic, run `useViewActions().pin(ids, !allPinned)`. Export `usePinState` / `useTogglePins` (or a pure `pinState(ids, pinned)`) from `apps/app/src/editor/views/pin-controls.tsx`.
  - **Sticky target:** add `sticky` to the targets of `details.open` (T023), `json.copy` and `delete`. The sticky's Delete uses the existing removal path (`requestRemoval` / `describeRemoval` handle `stickies`).
  - **`delete`** (component, components, connection, sticky, mixed; edit mode; section `danger`): `requestDelete(selection)`, the existing dialog and toast (FR-038).
- [ ] T043 [P] [US5] Create `apps/app/src/editor/actions/arrange-order.ts` (+ test) and `arrange-actions.ts`.
  - `arrangeOrder(nodeIds, moved, 'front' | 'back')` → the new order, keeping the relative order of the moved ids.
  - The action `arrange` (component and components, edit mode) has the children `arrange.front` / `arrange.back`. Each runs one `editor.batch` of `editor.reorder('nodes', id, index)` calls.
  - Test: the draw order changes (the node DOM order in `render-canvas`), and it survives `toJSON` → load.
  - First confirm that `visibleGraph` / `toFlowNodes` keep the `deck.nodes` order for components. If they don't, fix the ordering in `apps/app/src/editor/deck-to-flow.ts`, with a test (research R8).
- [ ] T044 [P] [US5] Create `apps/app/src/editor/actions/canvas-actions.ts` for the canvas target:
  - `canvas.add`, with six children `canvas.add.<kind>` (labels with 1–6), running `addComponent(editor, kind, screenToFlowPosition(point), { edit: true })` (FR-012 click point).
  - `canvas.addSticky`: `addNoteAt(editor, flowPoint)`.
  - `canvas.selectAll`: extract the ⌘A body in `use-canvas-shortcuts.ts` into an exported function and call it from both places.
  - `canvas.fit`: `fitView({ padding: 0.2 })`, all modes.
  - Register them, with tests.
- [ ] T045 [US5] In `apps/app/src/editor/quick-edit/canvas-menu.test.tsx`, check the menu for each contract target (component, components, connection, group, sticky, canvas, mixed) against the contract table, both in edit mode and in flow mode (only Open details, Copy JSON and Fit). There must be no item without a runnable action (SC-006). Also check that Delete asks for confirmation as the Delete key does.
- [ ] T046 [US5] Add ⇧⌘C to `useEditorShortcuts` in `apps/app/src/editor/use-canvas-shortcuts.ts` (+ test). It uses `event.code === 'KeyC'` and runs `json.copy` through `useRunAction`, skipping text targets.

**Checkpoint**: quickstart 7.

---

## Phase 8: User Story 7 — Do all of it from the keyboard (P2)

**Goal**: ⌘E reaches the toolbar, arrows move inside it, Esc returns to the selection, and Tab enters the toolbar from a selected card. Everything is announced and listed in the help dialog.

**Independent test**: with the keyboard only, run the acceptance scenarios of US1, US3, US5 and US6 (spec US7).

- [ ] T047 [US7] Add ⌘E to `apps/app/src/editor/shell/use-shell-shortcuts.ts` (+ test). When the toolbar is shown, it calls `preventDefault` and focuses its first button (by `data-quick-toolbar`, or an exported `focusSelectionToolbar()` in `selection-toolbar.tsx`). Otherwise it does nothing. It is skipped in text targets and dialogs.
- [ ] T048 [US7] Toolbar keyboard in `selection-toolbar.tsx` (+ test). Esc on the toolbar (with no popover open) focuses `focusedId` / `focusedEdgeId`, or the group element. Tab after the last button returns focus to the selected card. In `useCanvasKeyDown`, Tab on a selected object with a visible toolbar moves focus to the toolbar (FR-041).
- [ ] T049 [US7] Accessibility pass (+ tests in the respective files), per contract R10:
  - Check the names and roles for the toolbar, field buttons (`aria-expanded`), popover `dialog`, `listbox` (`aria-multiselectable` for tags), menu, submenus and title textbox.
  - Check that announcements use the existing `announce()`.
  - Check that the mixed and partial states appear in text.
- [ ] T050 [US7] Check that `editor/shell/shortcut-help-dialog.tsx` shows the "Quick edit" section from T012 (+ test).

**Checkpoint**: quickstart 8.

---

## Phase 9: User Story 6 — Quick edit on connections and groups (P3)

**Goal**: the connection toolbar has Label, Protocol and Direction, with P opening the protocol picker. The group toolbar has Rename, Ungroup, Collapse / Expand and Select members. Each change is one undo step.

**Independent test**: select a connection and change its label, protocol and direction. Select a group and use each toolbar action (spec US6).

- [ ] T051 [US6] Create `apps/app/src/editor/actions/connection-actions.ts` (+ cases):
  - **`edge.label`** (connection; toolbar and menu; shortcut ⏎): runs `openEdgePopover(id)`.
  - **`edge.protocol`**: in the toolbar it opens the `protocol` field. In the menu it has radio children from `PROTOCOLS` (`protocolLabel`).
  - **`edge.direction`**: the same, from `DIRECTIONS`.
  - **Writes:** `oneStep(editor, () => editor.update('edges', id, { protocol | direction }))`, then announce.
  - In `field-popover.tsx`, add the `protocol` and `direction` fields as single-choice `ChoiceList`s.
- [ ] T052 [US6] Add P to `useCanvasKeyDown` (+ test). With one selected connection it calls `openToolbarField('protocol')`, only when the toolbar is visible. It is ignored in text targets.
- [ ] T053 [US6] Create `apps/app/src/editor/actions/group-actions.ts` (+ cases), all for the group target in edit mode. Register them.
  - **`group.collapse`**: label "Collapse" / "Expand", shortcut `collapseGroup`, runs `toggleGroupCollapsed(editor, id)`.
  - **`group.selectMembers`**: `select({ nodes: directMembers })`, where the direct members are `deck.nodes` whose `group === id`. The toolbar then switches to the components variant.
  - **`group.ungroup`**: toolbar only, label "Ungroup", shortcut `ungroup` (⇧⌘G). Runs `oneStep(editor, () => editor.remove('groups', id))`.
  - Bind ⇧⌘G in `useEditorShortcuts` in `apps/app/src/editor/use-canvas-shortcuts.ts` (`event.code === 'KeyG'` with ⇧ and ⌘). It runs `group.ungroup` through `useRunAction` when one group is selected, and is skipped in text targets (FR-042, FR-039). 016 later reuses this binding.
  - **`group.delete`**: menu only, section `danger`, label "Delete group", with the tooltip "Members move to the parent level". It runs the same operation.
  - `title.rename` already covers groups (T023).
  - Tests: ungroup is one undo step, members move to the parent (read back with `readDeck`), and select members.
- [ ] T054 [US6] In `selection-toolbar.test.tsx`, check the connection and group variants: button names per the contract; Enter on a selected connection still opens the edge popover (the existing behaviour); Space still collapses.

**Checkpoint**: every story is done (quickstart 6).

---

## Phase 10: Polish & cross-cutting

- [ ] T055 [P] Update `apps/app/CLAUDE.md`. Cover `editor/actions/` (how later features add actions: 016 copy / paste / group / align, 017 reset route, 020 fill / stroke), `editor/quick-edit/`, the new store fields, and the rule "keys that also appear in menus run the action's function". Update `packages/ui/CLAUDE.md` (the components table: Toolbar, ChoiceList, InlineEdit props, tokens).
- [ ] T056 [P] Update `docs/backlog.md` §019 status (link to `specs/019-card-quick-edit/`, note FR-001 option A and that "Paste disabled" moved to 016). Add a note in §016 / §017 / §020 that their menu and toolbar items register in `apps/app/src/editor/actions/`.
- [ ] T057 Run `pnpm bench` after the change. Write `specs/019-card-quick-edit/bench-after.md` comparing it with `bench-before.md`: no scenario below 60 fps, `selection-toolbar-pan` recorded (SC-007), and selection-to-toolbar time ≤ 100 ms (SC-004).
- [ ] T058 Visual check per quickstart: screenshots at 1440×900, light and dark, next to `docs/design/screens/` 95–104 and the menu in 115, in `specs/019-card-quick-edit/visual-check.md`. List any difference. Allowed: token overrides, lucide icons, items owned by 016 / 017 / 020, and Space for Collapse.
- [ ] T059 Run the full definition-of-done set: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. The smoke suite must pass unchanged. Fix anything red, and confirm there are no `.only` or skipped tests.
- [ ] T060 Walk through quickstart scenarios 1–10 by hand in `pnpm dev`, and note anything uncertain for the final report (what changed, what was skipped, what is uncertain).

---

## Dependencies & execution order

- **Setup (T001–T004)** comes first. T003 and T004 can run in parallel.
- **Foundational (T005–T016)** blocks every story.
  - T005–T008 are parallel (`packages/ui`). T009 comes after T006–T008.
  - T010, T011 and T012 are parallel.
  - T013 → T014 → T015 → T016.
- **US1 (T017–T024)** needs the foundation.
- **US2 (T025–T027)** needs US1's `CardTitleInput` (T018).
- **US3 (T028–T035)** needs the foundation. It is independent of US1 / US2, except that the toolbar hides during `titleEdit`.
- **US4 (T036–T038)** needs the foundation. It is independent.
- **US5 (T039–T046)**:
  - T039 needs T016.
  - T040's "More actions" needs US3's toolbar (T030).
  - The component menu's Rename / Open inside come from T023 (US1).
- **US7 (T047–T050)** needs US3 (toolbar) and US5 (menu).
- **US6 (T051–T054)** needs US3 (toolbar, popover) and US5 (menu).
- **Polish (T055–T060)** comes after the stories you plan to ship. T057–T060 come last.

```text
Setup → Foundation ─┬─ US1 → US2
                    ├─ US3 ─┬─ US5 ─┬─ US7
                    │       │       └─ US6
                    └─ US4  └───────┘
                                    → Polish
```

## Parallel examples

- **Foundation:** T005, T006, T007, T008 (different `packages/ui` files), T011 and T012 at once.
- **US3:** T028, T029 and T032 (pure modules) together, then T030 → T031 → T033 → T034.
- **US5:** T042, T043 and T044 (separate action modules) together, after T039.
- **Across stories:** once the foundation is done, US1 (inline edit), US3 (toolbar) and US4 (details button) touch mostly separate files. The overlap is `deck-node.tsx`, used by T019 and T037, so do those two one after the other.

## Implementation strategy

1. **MVP:** Setup + Foundation + **US1**. Double-click / F2 rename alone removes most trips to the drawer. Stop and validate (quickstart 1–2).
2. **P1 complete:** add **US2** (add and name) and **US3** (toolbar), then merge-ready (quickstart 1, 3, 5).
3. **P2:** **US4** (details icon), **US5** (menus), **US7** (keyboard).
4. **P3:** **US6** (connection and group variants).
5. **Polish:** docs, bench after, visual check, full DoD run, final report.

Each phase ends green (`pnpm lint && pnpm typecheck && pnpm test`) with small conventional commits.
