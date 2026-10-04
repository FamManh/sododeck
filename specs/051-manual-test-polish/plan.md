# Implementation Plan: Manual-test polish

**Branch**: `051-manual-test-polish` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/051-manual-test-polish/spec.md`. It records founder manual-test feedback and 7 default decisions, 2 of them taken during planning.

**Dependency**: 029–038 and 040 are merged on `main`; names were checked at `90fe17a`. 050 (connector editing) touches `drag-session.ts`, `guides-overlay.tsx` and `deck-to-flow.ts` too: rebase on whichever lands first. The main touch points:

- **Focus**:
  - `editor/hover-focus/use-hover-focus.ts` (`suspendedBy`)
  - `editor/canvas.tsx` (`focusId` :416, auto-exit :577)
  - `editor/use-canvas-shortcuts.ts` (F :498)
  - `editor/shell/tools-island.tsx`
  - `state/ui-store.ts`
- **Drag**:
  - `editor/editing/drag-session.ts` (`apply`, `stop`, `duplicateOnDrop`, `onKey`, `cancel`)
  - `editor/use-canvas-handlers.ts`
  - `editor/deck-to-flow.ts` (node `className`)
  - `index.css` (:114-120 card tilt, :219-225 shape tilt)
- **Zoom**: `editor/levels.ts`, `editor/canvas.tsx` (`liplessSelector` comment), `editor/level-indicator.tsx`, `editor/deck-node.tsx` (read only).
- **Export**: `packages/ui/src/components/radio-group.tsx`, `editor/export/export-dialog.tsx`.
- **Save**: `storage/save-status.ts`, `editor/save-status.tsx`.
- **Packs**:
  - `packages/model/src/card-types.ts`
  - `editor/palette.tsx`, `editor/packs-panel.tsx`
  - `storage/library-ops.ts` (uses `NEW_DECK_PACKS`)
- **Library**:
  - `library/storage-card.tsx`, `storage/storage-estimate.ts`
  - `library/library-sidebar.tsx`, `routes/library-page.tsx`
  - `lib/features.ts`, `library/import-button.tsx`

## Summary

Nine small fixes from manual testing. Root causes and decisions are in [research.md](research.md).

- **Focus (R1)**:
  - Hover focus runs only inside Focus mode, when no card is pinned.
  - F works with nothing selected.
  - Focus mode no longer exits when the selection empties.
- **Duplicate-drag (R2)**:
  - Copies are created inside the open gesture as soon as ⌥ is active, and they move while the originals go back to their start positions.
  - Toggling ⌥ adds or removes the copies.
  - Drop gives one undo step. Esc or blur cancels.
- **No tilt (R3)**: remove `rotate` from the dragging CSS and keep the lift.
- **Zoom (R4)**: Landscape ≤ 30 %, System 31–50 %, Container 51–150 %. Card markup is unchanged.
- **Export (R5)**:
  - `RadioGroupItem`'s outer element becomes the `<label>`, with an optional `description`.
  - The export row uses it, so the whole row selects.
- **Save (R6)**: "Saving…" shows only when a write has been pending for 1 s or more. Writes stay at 100 ms.
- **Packs (R7)**:
  - Display order is split from file order.
  - Logistics gets `onByDefault: false`.
  - Files and round-trip are unchanged.
- **Library (R8)**:
  - Delete the storage card and its orphaned helpers.
  - The import button reads "Import", with the accessible name "Import deck file (.sododeck.json)".
- **Records (R9)**:
  - ADR 0031.
  - DESIGN.md (zoom table, drag state, tilt token).
  - `docs/spec.md` (V-3 wording, G-4 retired).
  - ADR 0025 amendment.
  - Package `CLAUDE.md` files.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed, **no new dependency**: `@xyflow/react` ^12.12, `yjs`, `zustand` 5, `radix-ui` (RadioGroup), `lucide-react`.

**Storage**:

- No schema, Yjs or file change. `.sododeck.json` output stays byte-identical (pack file order is kept).
- UI store: `focusMode` meaning widened, plus a new `dragCopyIds`.
- Save-status store: a new hidden `pending` state.

See [data-model.md](data-model.md).

**Testing**:

- Vitest:
  - `levels.test.ts`
  - `save-status.test.ts`
  - `focus-target.test.ts` (new)
  - drag-session tests
  - `packages/model/test/card-types.test.ts` and `packs.test.ts` (display order, `onByDefault`, file order unchanged)
  - a CSS test for no `rotate`
- Testing Library: `canvas.test.tsx` (focus, ⌥-drag), `deck-node.test.tsx`, `export-dialog.test.tsx`, `packages/ui/test/radio-group.test.tsx`, `save-status.test.tsx`, `palette.test.tsx`, `packs-panel.test.tsx`, library page and `import-button.test.tsx`.
- Bugs start with a failing test (Principle VI): the export row click, the original moving during ⌥-drag, and the spinner during typing.
- Existing 034 hover tests flip: they expect no lighting outside Focus mode.
- No new e2e (`TODO(e2e)`); the smoke suite stays green.

**Target Platform**: evergreen desktop browsers (Chromium for bench and e2e).

**Project Type**: pnpm/turbo monorepo: Vite SPA `apps/app` plus `packages/{model,ui}`.

**Performance Goals**:

- 60 fps pan/zoom at 500 nodes / 1,000 edges, with no regression beyond 5 % against `bench-before.md`. The risk is R4, which keeps more DOM visible at 51–90 %.
- The 034 hover scenario in `bench/perf.bench.ts` has to turn Focus mode on first. Its numbers should be unchanged.
- The ⌥-drag paste happens once per mode switch, not per frame.

**Constraints**:

- Tokens only, no network.
- Duplicate-drag copies live inside one gesture: one undo step, and cancel leaves nothing behind.
- The export radio's accessible name stays the format name.

**Scale/Scope**:

- Model: 1 file plus 2 tests.
- UI package: 1 component plus 1 test.
- App: ~20 files; ~5 deleted (storage card and estimate, with their tests).
- Docs: ADR 0031, DESIGN.md, spec.md, ADR 0025, and 2 `CLAUDE.md` files.
- Estimate **3–4 d**: R2 1.5 d, R1 0.5 d, R4 0.5 d (incl. bench), the rest 1 d.

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes; no violations._

| Principle                                    | Status | How                                                                                                                                                                                                                            |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Single source of truth                    | ✅     | Duplicate-drag copies are real doc nodes written through `editor` inside the gesture, with no shadow copy in React or React Flow state. `dragCopyIds`, `focusMode` and `hoverFocus` are UI-only.                               |
| II. Schema-owned format, lossless round-trip | ✅     | No schema change. Pack **file** order (`PACK_LIST` / `sortPacks`) is kept, so output is byte-identical. A model test asserts `toJSON` keeps the stored order.                                                                  |
| III. Stable identity                         | ✅     | Copies get fresh ids from `pasteFragment`, as today. No id is derived from a title.                                                                                                                                            |
| IV. Local-first, private                     | ✅     | No network. Removing the storage card removes the `storage.persist` / `estimate` calls and their feature-detects together. Writes still persist within 100 ms.                                                                 |
| V. Performance                               | ✅     | Bench before and after (R4 is the risk; fallback in research). There are no per-frame doc writes beyond today's drag. Hover keeps the 034 stylesheet path.                                                                     |
| VI. Strict types, tested behaviour           | ✅     | Pure helpers (`focusTargetId`, levels, the save reducer, the pack registry) get unit tests. UI is tested by role and label. Each reported bug starts with a failing test. No new e2e.                                          |
| VII. Accessible by default                   | ✅     | Focus mode stays reachable by keyboard (F) and its toggle shows pressed state. The radio row is a native label, so the keyboard is unchanged. The import button's name contains its visible label. The duplicate is announced. |
| VIII. Simplicity, justified deps             | ✅     | No dependency. Dead code (storage estimate and its feature-detects) is deleted rather than kept. One ADR records the redefinitions.                                                                                            |

## Project Structure

### Documentation (this feature)

```text
specs/051-manual-test-polish/
├── spec.md
├── plan.md                      # this file
├── research.md                  # R1–R9
├── data-model.md                # registry, levels, UI store, drag session, save status
├── quickstart.md                # automated + manual validation
├── contracts/ui-behaviour.md    # C1–C8 for component tests
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
packages/model/
├── src/card-types.ts                    # PACK_DISPLAY_ORDER, Pack.onByDefault, NEW_DECK_PACKS, CATEGORIES order
├── test/card-types.test.ts, packs.test.ts
└── CLAUDE.md                            # NEW_DECK_PACKS wording

packages/ui/
├── src/components/radio-group.tsx       # outer <label>, optional description
└── test/radio-group.test.tsx

apps/app/src/
├── editor/focus-target.ts               # NEW focusTargetId (+ test)
├── editor/hover-focus/use-hover-focus.ts# active only in Focus mode with no pinned target
├── editor/canvas.tsx                    # focusId via focusTargetId; no auto-exit; data-duplicating
├── editor/use-canvas-shortcuts.ts       # F turns Focus mode on with nothing selected
├── editor/shell/tools-island.tsx        # toggle enabled without a selection
├── editor/editing/drag-session.ts       # duplicate mode: copies in-gesture, ⌥ toggle, cancel
├── editor/editing/gesture-hints.ts      # hint text check
├── editor/deck-to-flow.ts               # sd-drag-copy class from dragCopyIds
├── editor/levels.ts                     # 30 / 50 / 150, LEVEL_MID_ZOOM
├── editor/export/export-dialog.tsx      # row as RadioGroupItem className + description
├── editor/palette.tsx, editor/packs-panel.tsx  # sort by Pack.order
├── storage/save-status.ts               # pending state, SAVING_SHOW_DELAY_MS
├── editor/save-status.tsx               # pending renders as Saved
├── library/import-button.tsx            # "Import" + aria-label
├── library/library-sidebar.tsx, routes/library-page.tsx   # storage slot removed
├── library/storage-card.tsx (+test)     # DELETED
├── storage/storage-estimate.ts (+test)  # DELETED
├── lib/features.ts (+test)              # persistent-storage / estimate detects removed
├── state/ui-store.ts                    # dragCopyIds; focusMode no auto-clear
├── routes/bench-page.tsx, bench/perf.bench.ts  # hover scenario turns Focus mode on
└── index.css                            # no rotate on .dragging; data-duplicating lift rules

docs/decisions/0031-manual-test-polish.md  # NEW
docs/decisions/0025-card-type-registry.md  # amendment note
DESIGN.md (zoom levels, being-dragged state, tilt token) · docs/spec.md (V-3, G-4) · apps/app/CLAUDE.md
```

**Structure Decision**: existing monorepo layout. The only new module is `editor/focus-target.ts`; everything else edits files in place.

## Delivery order

Each step is a small commit, and each story can ship on its own.

1. **Quick wins**: US8 library, US5 export row, US4 tilt, US7 packs.
2. **US6** save indicator.
3. **US1** focus.
4. **US3** zoom: bench before, change, bench after.
5. **US2** duplicate-drag (the biggest; tests first).
6. Docs and ADR, quickstart walk-through and screenshots.

## Complexity Tracking

No constitution violations. Choices to note for review:

| Choice                                                    | Why                                                                                                                                      | Simpler alternative rejected because                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Real copies inside the drag gesture (not a ghost overlay) | Identical look, and guides, snap, multi-select and groups all work for free. One undo and a clean cancel come from the existing gesture. | A ghost overlay would re-render cards outside React Flow, and guides would not see it              |
| Separate pack display order from file order               | The founder's order is a UI preference. Files and round-trip must not change.                                                            | Reordering `PACK_LIST` would reorder `packs` in every exported file and break fixtures and samples |
| Landscape threshold 45 → 30 % (beyond the founder's ask)  | Moving System to 50 % alone leaves a 4 % band that flickers under hysteresis                                                             | Keeping 45 % gives a System band of 46–50 %                                                        |
| Retire G-4 (persistent storage, P0)                       | Explicit founder request                                                                                                                 | Keeping a hidden request path is dead UI                                                           |
