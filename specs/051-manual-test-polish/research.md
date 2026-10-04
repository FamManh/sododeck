# Research: Manual-test polish (051)

All paths are relative to `apps/app/src/` unless they start with `packages/`, `docs/` or `DESIGN.md`. Names were checked on `main` at `90fe17a`.

## R1 — Hover focus only inside Focus mode (US1)

**Today**

- `editor/hover-focus/use-hover-focus.ts:21-33` `suspendedBy()` turns hover off when `s.focusMode` is **on**. So hover focus runs only when Focus mode is off: the exact reverse of what the founder wants.
- Focus mode lives in `state/ui-store.ts` (`focusMode`, `setFocusMode`).
  - F handler: `editor/use-canvas-shortcuts.ts:498-517`. It refuses unless exactly one node or group is selected.
  - Toolbar toggle: `editor/shell/tools-island.tsx:68-110`.
- `editor/canvas.tsx`:
  - `focusId` (:416-428) is the single selected node or group while `focusMode` is on.
  - Focus mode turns itself off when the selection empties (:577-587).
- Dimming paths:
  - Pinned focus goes through `view.focus` in `deck-to-flow.ts`, which sets the `dimmed` class plus `aria-hidden` / `inert`.
  - Hover goes through `hover-focus-style.tsx`, which writes one generated `<style>` and touches no React Flow objects.

**Decision**

- Hover is **active only when Focus mode is on and no focus is pinned**. In `suspendedBy()`, `s.focusMode` becomes `!s.focusMode || pinned(s)`. `pinned` is true when exactly one node or group is selected.
- Extract the selection-to-target rule into one pure helper, `focusTargetId(selection, collapsed)` in `editor/focus-target.ts`. `canvas.tsx`, the F handler and the hook all use it.
- F and the toggle turn Focus mode on even with an empty selection, and no longer announce "Select a component to focus". Remove the auto-exit at `canvas.tsx:577-587`.
- Pinned focus and hover never run at once, so the `inert` on dimmed cards cannot block `mouseenter`. When a focus is pinned, hover is suspended anyway.

**Rationale**

- It matches the founder's "a mode you turn on when needed" and reuses the existing mode and toggle (spec clarification).
- The change is a few lines in the hook and the canvas.
- The 034 rendering path (generated stylesheet, no React Flow rebuild per hover) is kept, so the hover performance figures still hold.

**Alternatives rejected**

- Hover overriding a pinned selection inside Focus mode: it needs restore rules with higher specificity, or React Flow rebuilds per hover (034 perf design). It also contradicts spec AS4.
- A new preference "Highlight on hover": it adds a setting the spec does not ask for.

## R2 — Duplicate-drag keeps the original in place (US2)

**Today** (`editor/editing/drag-session.ts`)

- `apply()` writes the dragged ids' positions into the doc every frame. With ⌥ held the originals still move.
- `stop()` → `duplicateOnDrop()` (:526-540) moves the originals back and pastes `selectionFragment(...)` at the drop position.
- The whole drag is one gesture: `beginGesture` / `endGesture`, and `cancelGesture` on Esc.
- The modifier is tracked live (`onKey`, `pointer()`); ⌥ also sets the drop target to "no group".
- DESIGN.md :255 describes "a dashed Muted ghost stays at the origin". It was never built.

**Decision.** Create the copies **as soon as duplicate mode starts**, inside the open gesture, and move the copies instead of the originals:

1. The duplicate mode starts when the pointer has moved past the threshold with ⌥ held, or when ⌥ is pressed mid-drag. At that point the controller:
   - writes the originals back to their start positions;
   - pastes the copies at the current dragged positions (`editor.pasteFragment`, `offset: 0`, the same parent rule as today);
   - sets the session's moving ids to the copies' ids.
2. Releasing ⌥ mid-drag removes the copies, again inside the gesture, and switches the moving ids back to the originals at the current delta.
3. Dropping ends the gesture as one undo step and selects the copies. Esc or window blur cancels the gesture, which removes the copies and restores the originals with no undo entry.
4. Guides, snapping and the drop target are computed for the moving ids, so they work for copies unchanged (spec AS6).
5. The look while duplicating:
   - The wrapper gets `data-duplicating` while copies exist. CSS then removes the drag lift from the original, which React Flow still marks `.dragging`.
   - The copies get the lift through a UI-store `dragCopyIds` set, which `deck-to-flow.ts` maps to an `sd-drag-copy` class. The copies are new nodes, so this costs no extra rebuild.

**Rationale**

- The copies are real nodes, so they look exactly like the final result, multi-select and groups come for free, and alignment uses the existing code.
- The gesture machinery already gives one undo step and a clean cancel.

**Risks** (cover with failing tests first)

- React Flow keeps dragging the original's id while the doc holds that node at its start. The controller already computes positions as session start plus pointer delta, so React Flow's own position is ignored.
- A test must prove the original stays rendered at its start for the whole drag.
- Other tabs see the copies while the drag runs (036 sync). That is acceptable: a cancelled gesture removes them.

**Alternatives rejected**

- A UI-only ghost overlay: it would have to re-render cards outside React Flow, and guides and snapping would not see it.
- The dashed origin ghost from DESIGN.md: the founder's feedback is that the original must stay visible as a card.

**Out of scope.** Stickies have no duplicate-drag today and stay that way (spec edge case).

## R3 — No tilt while dragging (US4)

- The tilt is CSS only:
  - cards: `index.css:114-120` (`.react-flow__node.dragging .sd-card { transform: rotate(-2.5deg) … }`)
  - shapes: `index.css:219-225` (`rotate(-3deg)`)
- **Decision**: drop the `rotate(...)` and keep the lip and the Float shadow (the lift).
  - Update DESIGN.md: the `--sd-deck-tilt` token row (:201), the "Being dragged" state (:255, which also drops the origin ghost) and :260.
  - Export already never tilts (`export/render-svg.ts:519`).
- A CSS test (pattern: `quick-edit-css.test.ts`) asserts that the dragging rules contain no `rotate`.

## R4 — Card details down to 50 % (US3)

**Today**

- `editor/levels.ts`: `LANDSCAPE_MAX = 45`, `SYSTEM_MAX = 90`, `CONTAINER_MAX = 150`, `HYSTERESIS = 2`. `LEVEL_MID_ZOOM.system = 0.68`.
- `deck-node.tsx` shows the type name, the description, full field chips and tag pills only at Container or Component.

**Decision**

- `LANDSCAPE_MAX = 30`, `SYSTEM_MAX = 50`, `CONTAINER_MAX = 150` (unchanged).
- `LEVEL_MID_ZOOM`: landscape `0.2`, system `0.4`, container `1.0`, component unchanged.
- Card markup is unchanged: details are already scaled by the canvas transform, like the title.
- Update the comment on `liplessSelector` (it names 45 % and 90 %). The lip rule (< 60 %) stays.
- Update the DESIGN.md "Zoom levels (123)" table.

**Rationale**

- Moving only the System boundary would leave a 46–50 % System band that hysteresis (±2) makes flicker.
- Shifting Landscape to 30 % keeps four usable bands (spec clarification).

**Performance**

- Container cards have more DOM (chips, description), and at 51–90 % many more cards are on screen than at 100 %.
- Run `pnpm bench` before and after. The zoom/pan fps scenarios in `bench/perf.bench.ts` (:155, :430-449) are the gate (Principle V, 60 fps at 500 / 1,000).
- If they regress beyond 5 %: hide the chips row (not the description) at System, and record that in the plan's report.

**Consumers to re-check** (none need logic changes): `canvas.tsx` (announcement), `zoom-island.tsx` / `level-indicator.tsx`, `merged-edge.tsx`, `group-boundary-node.tsx`, `shape-node.tsx`, `export/scene.ts` (always Container), `levels.test.ts`, `level-indicator.test.tsx`.

## R5 — Whole export option row selects (US5)

**Today**

- `packages/ui/src/components/radio-group.tsx` `RadioGroupItem` renders `<span>` → Radix `Item` + `<label htmlFor>`. The label is only as wide as its text.
- `editor/export/export-dialog.tsx:222-248` puts the border, the padding and the subtitle `<p>` in a plain `<div>` around it. Padding, the empty space and the subtitle are all dead zones.

**Decision**

- In `packages/ui`, the item's outer element becomes the `<label>` (wrapping the radio button and the label content) instead of a `<span>`. The label content keeps its own `htmlFor`-free span.
- Add an optional `description` prop, rendered inside the label under the text, so it is clickable too.
- The export dialog passes its row classes as `className` (now on the label) and its subtitle as `description`. It keeps `aria-label` and `aria-describedby`, so the accessible name stays the format name.

**Rationale**

- A label wrapping a labelable `<button role="radio">` is native, keyboard behaviour is unchanged (Radix arrow keys), and other users get a bigger hit area for free.
- Other users to re-check: `views/view-settings-popover.tsx`, `design-gallery/fields-section.tsx`, `packages/ui/test/radio-group.test.tsx`.

**Alternatives rejected**

- `onClick` on the row `<div>`: it fixes one dialog only, and adds a click handler on a non-interactive element (lint `jsx-a11y` style concerns).

## R6 — Calm save indicator (US6)

**Today**

- `storage/deck-persistence.ts` emits `pending` on the first buffered update and writes 100 ms later (`flushMs = 100`, not a debounce). It emits `saved` when the buffer is empty after a write.
- `storage/save-status.ts`: `pending` → `saving` at once, held ≥ `SAVING_MIN_MS = 200`.
- When typing, every keystroke cycles `pending` → `saved`, so the spinner (`editor/save-status.tsx`, `LoaderCircle animate-spin`) never stops.
- `SAVED_MAX_HOLD_MS` is declared but unused.

**Decision** (UI only; persistence is unchanged)

- In `createSaveStatusStore`, `pending` from `saved` starts a **show delay** (`SAVING_SHOW_DELAY_MS = 1000`) instead of switching to `saving`.
  - A `saved` before the delay ends cancels it, and the state stays `saved`: no animation.
  - If the delay ends with the write still pending, the state becomes `saving` (with the existing 200 ms minimum hold).
  - `failed` applies at once, as today.
  - The reducer gains `{ kind: 'pending'; since }`, which renders exactly like `saved`.
- Remove the unused `SAVED_MAX_HOLD_MS`.

**Rationale**

- Writes still land about 100 ms after an edit, well inside Principle V's 500 ms and the spec's FR-011. So no data-loss window is added and only the display calms down.
- `pagehide` / `visibilitychange` flushes are unchanged.

**Alternatives rejected**

- Debouncing writes until typing pauses: it widens the data-loss window for a cosmetic issue.

## R7 — Pack order and Logistics off by default (US7)

**Today**

- `packages/model/src/card-types.ts`:
  - `PACK_LIST` order (architecture, process, logistics, data, database, shapes) is both the display order and the order `sortPacks` writes to files (`read.ts:214`).
  - `CATEGORIES` gives the Add tabs.
  - `NEW_DECK_PACKS` is every pack.
- Nothing turns a pack on automatically for cards already on the board.

**Decision**

- Split **display order** from **file order**.
  - `PACK_LIST` keeps its order, so `sortPacks` and the files written stay byte-identical: the untracked samples, fixtures and round-trip tests are untouched.
  - Add a `PACK_DISPLAY_ORDER: readonly PackId[] = ['shapes', 'process', 'data', 'database', 'architecture', 'logistics']`. `Pack.order` comes from it.
  - Reorder `CATEGORIES` the same way (UI only).
  - `packs-panel.tsx` and `palette.tsx` sort by `order`.
- Add `onByDefault: boolean` to `Pack`, `false` only for Logistics. `NEW_DECK_PACKS = PACKS.filter(p => p.onByDefault)` in file order.
- Imports keep their `packs` (no change). Legacy decks with no list keep `LEGACY_PACKS`.
- A deck that has Logistics cards but no Logistics pack cannot appear from this change: existing decks keep their stored list.

**Rationale**: the founder's order is a UI preference. The file format and lossless round-trip (Principle II) must not move.

**Docs**: amend ADR 0025 (it says "all four packs on"), update `packages/model/CLAUDE.md` (`NEW_DECK_PACKS`), and update `apps/app/CLAUDE.md:105`.

## R8 — Library sidebar clean-up (US8)

**Decision**

- Delete the orphaned code:
  - `library/storage-card.tsx` (+ test)
  - `storage/storage-estimate.ts` (+ test)
  - the `storageCard` prop and slot in `library/library-sidebar.tsx` and `routes/library-page.tsx`
  - `supportsPersistentStorage` / `supportsStorageEstimate` in `lib/features.ts` (+ tests). No other callers.
- `library/import-button.tsx`: the visible text becomes "Import", with `aria-label="Import deck file (.sododeck.json)"`. The visible word starts the accessible name (WCAG 2.5.3, label in name).
- Docs:
  - `docs/spec.md` G-4: mark it retired by founder decision 2026-10-04.
  - `apps/app/CLAUDE.md:35-36`: remove the storage card.

**Rationale**: no dead code is left behind (Principle VIII).

**Risk**: dropping G-4 removes a P0 product requirement, explicitly requested by the founder. The report must state it.

## R9 — Records

- One ADR, `docs/decisions/0031-manual-test-polish.md`, records the three behaviour changes that redefine earlier decisions:
  - hover focus only inside Focus mode (034)
  - the new level thresholds (frame 123 / DESIGN.md)
  - pack display order and Logistics off by default (ADR 0025), plus G-4 retired
- `0030` is reserved by 050 (groups as connector ends). If numbering has moved by the time this lands, take the next free number.
