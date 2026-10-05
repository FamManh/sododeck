# Tasks: Image editing (crop and flip) (057)

**Inputs**:

- [plan.md](plan.md), [spec.md](spec.md). Founder decisions (2026-10-05): free crop only (no presets); double-click opens crop mode; flip on a mixed selection makes all images the same; no keyboard shortcut for flip.
- [research.md](research.md) (R1–R12), [data-model.md](data-model.md), [contracts/file-format.md](contracts/file-format.md), [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md), ADR [0037](../../docs/decisions/0037-image-support.md).
- Precedents to copy: 055 image ops (`packages/model/src/ops/images.ts`), `locked: true` convention (`const: true`, unset removes the key), image resize (`apps/app/src/editor/editing/image-resize.ts`) for handle styling and clamping, `image-actions.ts` for actions, `importedMessage` in `apps/app/src/library/library-actions.ts` for the once-only load toast.

**Tests**: required (constitution VI). Write each group's tests first and watch them fail. No new e2e; the smoke suite must stay green.

**Organization**: one phase per user story in spec order of value: US2 (flip, P1) before US1 (crop, P1) because flip needs no new interaction mode and ships alone; US4 (save / export, P1) is mostly delivered by Phase 2 and closed in its own phase; US3 (reset / undo, P2) last.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1 to US4 from spec.md.

## Path Conventions

- Schema: `packages/schema/schema/v1.json`, tests in `packages/schema/test/`
- Model: `packages/model/src/`, tests in `packages/model/test/`
- App: `apps/app/src/` (editor in `apps/app/src/editor/`), tests next to code (`*.test.ts(x)`)
- Test pictures: reuse the tiny pictures and helpers of 055 (`packages/model/test/image-helpers.ts`, app image tests).

---

## Phase 1: Setup

- [x] T001 On branch `057-image-editing`, confirm a green baseline: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`. Before any code change run `pnpm bench` and save the output as `specs/057-image-editing/bench-before.md`.
- [x] T002 Commit the spec folder (spec, plan, research, data-model, contracts, quickstart, tasks, checklists) as `docs: image crop and flip spec, plan and tasks (057)`; mark 057 in `docs/backlog.md` as "spec / plan / tasks in `specs/057-image-editing/`" in the same commit.

---

## Phase 2: Foundational (format, geometry, ops, drawing)

**Purpose**: the file format, the pure geometry and the model ops every story uses, and drawing an edited image on the canvas and in export from a hand-written deck. No new controls yet.

### Format

- [x] T003 [P] Add fixtures to `packages/schema/test/fixtures.ts` (or the file 055 used for image fixtures): valid image with `crop: {x:0.25,y:0.1,width:0.5,height:0.5}`, `flipX: true`, `flipY: true`; invalid: `crop.x: 1`, `crop.x: -0.1`, `crop.width: 0`, `crop.height: 1.5`, `crop` missing `height`, `crop` with an extra key, `crop.x: "0.2"`, `flipX: false`, `flipY: "yes"`. Run the schema tests and watch the invalid ones fail to be refused.
- [x] T004 Edit `packages/schema/schema/v1.json` per contracts/file-format.md: new `$defs.Crop` (`additionalProperties: false`; required `x`, `y`, `width`, `height`; `x`, `y` `minimum 0` `exclusiveMaximum 1`; `width`, `height` `exclusiveMinimum 0` `maximum 1`; every property with a `description`); `Image.properties.crop` (`$ref`), `flipX`, `flipY` (`const: true`, described like `locked`), appended after `locked`. Run `pnpm schema:generate`. Update `packages/schema/examples/full.sododeck.json` so an image uses `crop`, `flipX`, `flipY` (coverage test) and add the fields to `packages/schema/CLAUDE.md`. `pnpm --filter @sododeck/schema test` green, Ajv / Zod parity included.

### Model: geometry

- [x] T005 [P] Write tests first in `packages/model/test/geometry.test.ts` for `pictureLayout(box, natural, crop?, flip?)`: no crop + matching box → view = box, picture = box; letterboxed box (box wider than picture) → view centred, contain fit; crop `{0.5,0,0.5,1}` on a 200×100 picture in a 100×100 box → view 100×100 at box origin, picture 200×100 at x −100; `flipX` with that crop → picture x mirrored so the same region (right half of the picture) fills view, and `flipX: true` returned; `flipY` likewise. For `cropFrame(box, natural, from, to, flip)`: first crop of a full 400×200 picture in a 400×200 box at (0,0) to the right half → box (200,0,200,200); same with `flipX` → box (0,0,200,200) (the right half of the picture is drawn on the left); reset (`to` = whole) from that result → back to (0,0,400,200); a reset whose full picture would exceed 4096 px is scaled to fit with the old visible centre kept; letterboxed `from` box collapses to the fitted region. For `minCropFraction(box, natural, crop)`: the fraction equal to 32 canvas px at the displayed scale. Also a rounding helper: values rounded to 6 decimals.
- [x] T006 Implement `CropRect`, `pictureLayout`, `cropFrame`, `minCropFraction`, `roundCrop` and `isWholeCrop` in `packages/model/src/geometry.ts`, export from `packages/model/src/index.ts`. Use `IMAGE_MIN_SIZE` and a new exported `IMAGE_MAX_SIDE = 4096` (move the 4096 literal from `apps/app/src/editor/editing/image-resize.ts` `IMAGE_SIZE_LIMITS.max` to use it). T005 green.

### Model: ops, load, round-trip

- [x] T007 [P] Write tests first in `packages/model/test/images.test.ts` (new `describe('crop and flip (057)')`): `setImageCrop(id, crop)` writes `crop`, `size`, `position` in one undo step (one `undo()` restores all three); position is relative to the group when the image is in a group; `setImageCrop(id, null)` deletes `crop` and restores the box via `cropFrame`; a crop equal to the whole picture is stored as no `crop`; same crop again → no transaction, no undo step; locked image → `DeckEditError` `locked`; image in a locked group → `locked`; crop out of bounds or below the 32 px minimum → `invalid`; image whose `asset` has no `meta.assets` entry → `missing-reference`. `setImageFlip(ids, 'x', true)` sets `flipX: true` on all ids in one undo step; `false` deletes the key; any locked id → `locked`, nothing written; already in that state → no undo step. A copied and pasted image (`toFragment` / `pasteFragment`) keeps `crop`, `flipX`, `flipY` (add to `packages/model/test/image-clipboard.test.ts`).
- [x] T008 Implement `setImageCrop` and `setImageFlip` in `packages/model/src/ops/images.ts` (use `cropFrame`, `roundCrop`, `isWholeCrop`, `assertUnlocked`, the group lock check used by `moveImage`, `assertValid(validateObject('images', …))`; one `ctx.transact` without merge key), add `DeckEditor` wrappers in `packages/model/src/editor.ts` with doc comments, export the types. Make sure `read.ts` / `write.ts` / `key-order.ts` handle the new keys and their order (`crop`, `flipX`, `flipY` after `locked`). T007 green.
- [x] T009 [P] Write tests first in `packages/model/test/round-trip.test.ts` and `packages/model/test/load.test.ts`: JSON → doc → JSON is byte-identical for an image with `crop`, `flipX`, `flipY` and for a 055 image without them (no new keys appear); picture bytes in `assets` are unchanged by edits; `loadDeck` of a file with `crop: {x:0.6,y:0,width:0.6,height:1}` opens, the crop becomes `{x:0.6,y:0,width:0.4,height:1}` and `trimmedCrops` lists `{ imageId, path: 'images.0.crop' }`; a crop trimmed to zero size is removed and listed; a well-formed crop yields an empty list.
- [x] T010 Implement the C2 trim in `packages/model/src/deck.ts` `loadDeck` (next to `repairAssets`, before `buildDoc`), as a pure helper `trimCrops(input)` in `packages/model/src/load-checks.ts`; add `trimmedCrops: { imageId: string; path: string }[]` to `LoadedDeck`. Update `packages/model/CLAUDE.md` (image ops, geometry, load result). T009 green.

### Drawing (canvas and export)

- [x] T011 [P] Write tests first: `apps/app/src/editor/images/image-node.test.tsx` — an unedited image still renders one `<img>` with `object-contain` and no wrapper transform; an image with `crop` renders a clipping box sized `pictureLayout.view` and the `<img>` at `pictureLayout.picture`; `flipX` adds a horizontal mirror on the picture, never on the caption or the lock glyph; the placeholder is never mirrored. `apps/app/src/editor/export/render-svg.test.ts` — an unedited image's SVG is byte-identical to before (snapshot of the existing case); an edited image is a nested `<svg>` with `viewBox` = crop in natural pixels (mirrored when flipped, contracts/file-format.md example: `viewBox="320 80 640 400"`, `transform="translate(1280 0) scale(-1 1)"`) and `preserveAspectRatio="xMidYMid meet"`; no outside URL. `apps/app/src/editor/export/scene.test.ts` — `SceneImage` carries `crop`, `flipX`, `flipY` and `natural` from `assets`.
- [x] T012 Pass `crop`, `flipX`, `flipY` and natural `width` / `height` (from `deck.assets[asset]`) through `ImageFlowNode` data in `apps/app/src/editor/deck-to-flow.ts`; create `apps/app/src/editor/images/picture-view.tsx` (clipped, mirrored `<img>` from `pictureLayout`, tokens only) and use it in `apps/app/src/editor/images/image-node.tsx` only when the image has a crop or a flip.
- [x] T013 Add `crop`, `flipX`, `flipY`, `natural` to `SceneImage` in `apps/app/src/editor/export/scene.ts` (`sceneImage`) and write the nested `<svg viewBox>` branch in `picture()` of `apps/app/src/editor/export/render-svg.ts` from `pictureLayout`, keeping the unedited branch untouched. PNG follows through `rasterize.ts` (no change). T011 green.

**Checkpoint**: a hand-written deck with crop and flip draws and exports correctly; no controls yet.

---

## Phase 3: User Story 2 - Flip an image (Priority: P1) 🎯 MVP

**Goal**: flip horizontal / vertical on one or many images from the selection toolbar and the context menu.

**Independent Test**: select an image, Flip horizontal: mirrored; again: back; select two images with one flipped, Flip horizontal: both flipped, button pressed; each press is one undo step.

- [x] T014 [P] [US2] Write tests first in `apps/app/src/editor/actions/image-actions.test.ts` (create if missing): `image.flipX` / `image.flipY` are offered on the toolbar for kinds `image` and `images` and in the menu for `image`, `images` and `mixed` only when the selection holds an image; `run` with mixed flipped / unflipped images flips all (R6), with all flipped unflips all; locked images in the selection are skipped; all locked → disabled with reason "Locked"; `pressed` is true only when every selected unlocked image is flipped on that axis; one undo step per run.
- [x] T015 [US2] Add `image.flipX` (`FlipHorizontal2`, "Flip horizontal") and `image.flipY` (`FlipVertical2`, "Flip vertical") to `IMAGE_ACTIONS` in `apps/app/src/editor/actions/image-actions.ts` per contracts/ui.md; if the action type has no toggle / pressed state yet, add an optional `pressed?: Dynamic<boolean>` to `Action` in `apps/app/src/editor/actions/types.ts` and render `aria-pressed` for it in `apps/app/src/editor/quick-edit/selection-toolbar.tsx` (`ActionButton`) and as a checked menu item in `apps/app/src/editor/quick-edit/canvas-menu.tsx`. No shortcut. T014 green.
- [x] T016 [P] [US2] Add Testing Library cases to `apps/app/src/editor/images/image-toolbar.test.tsx`: the one-image toolbar shows "Flip horizontal" and "Flip vertical" buttons with `aria-pressed`; clicking mirrors the picture (via `picture-view`) and leaves position, size, caption and connectors unchanged; the multi-image toolbar shows both flips.

**Checkpoint**: flip works end to end, saves, reloads and exports (Phase 2).

---

## Phase 4: User Story 1 - Crop an image (Priority: P1)

**Goal**: crop mode with eight handles and an inside drag, Shift keeps proportions, Done / Enter / click outside confirms in one undo step, Cancel / Escape leaves nothing.

**Independent Test**: paste a screenshot, double-click, drag the top-left handle to the middle, Enter: only the bottom-right quarter shows at the same scale and place; ⌘Z restores it in one step; Escape on a new session leaves no undo step.

- [x] T017 [P] [US1] Write tests first in `apps/app/src/editor/images/crop-session.test.ts` for the pure maths: `dragHandle(crop, handle, delta, { keepRatio, min })` for each of the eight handles in picture fractions (delta converted from canvas px with the displayed scale and mirrored when flipped); clamped to [0, 1] and to `min`; `keepRatio` on corners keeps width / height ratio; `moveFrame(crop, delta)` keeps size and stays inside; `nudge(crop, target, key, large, scale)` moves by 1 or 10 canvas px.
- [x] T018 [US1] Implement `apps/app/src/editor/images/crop-session.ts` (pure; `CropHandle` = eight handles + `'frame'`). T017 green.
- [x] T019 [US1] Add `cropSession: { imageId; crop: CropRect; handle: CropHandle | null } | null` with `openCrop(imageId, crop)`, `updateCrop(crop, handle?)`, `closeCrop()` to `apps/app/src/state/ui-store.ts`, plus unit tests in the store's test file (open, update, close; never touches the document).
- [x] T020 [P] [US1] Write component tests first in `apps/app/src/editor/images/crop-overlay.test.tsx`: opening shows the whole picture, a dimmed area outside the frame, a frame named "Crop area, W × H" and eight handles named "Crop top left corner", "Crop top edge", …; pointer drag on a handle updates the frame (clamped); drag inside moves it; Shift on a corner keeps proportions; Enter calls `setImageCrop` once and closes; Escape closes with no document change and no undo step; the connector handles, lock glyph and caption are hidden in crop mode.
- [x] T021 [US1] Create `apps/app/src/editor/images/crop-overlay.tsx` (rendered inside `image-node.tsx` when `cropSession?.imageId` matches; whole picture from `pictureLayout` with `crop` = whole, frame from the session crop; handles with the `sd-resize-handle` look at constant screen size using `getZoom()`; pointer events update the store through `crop-session.ts`; tokens only) and `apps/app/src/editor/images/crop-bar.tsx` (selection toolbar container style and placement: Reset, Cancel, Done primary). Hide the selection toolbar while `cropSession` is open in `apps/app/src/editor/quick-edit/selection-toolbar.tsx`. Confirm = `editor.setImageCrop(id, isWholeCrop(crop) ? null : crop)` then `closeCrop()`; pointer down outside the picture and the bar = confirm. T020 green.
- [x] T022 [P] [US1] Write tests first: `image.crop` in `apps/app/src/editor/actions/image-actions.test.ts` (toolbar + menu for kind `image` only; disabled with "Locked" for a locked image or one in a locked group, "Picture missing" when the picture is missing or the asset facts are absent; run opens the session with the current crop or the whole picture); double-click in `apps/app/src/editor/use-canvas-handlers.test.tsx` (double-click on an image opens crop mode; on a locked image calls the locked hint; on a missing picture announces "Picture missing, nothing to crop"; card and group double-click unchanged).
- [x] T023 [US1] Add `image.crop` (`Crop`, "Crop") to `apps/app/src/editor/actions/image-actions.ts` and replace the early return for images in `onNodeDoubleClick` in `apps/app/src/editor/use-canvas-handlers.ts` with the crop entry (`refuseLocked` from `apps/app/src/editor/lock.ts` when locked). T022 green.
- [x] T024 [P] [US1] Write tests first in `apps/app/src/editor/images/use-crop-interruptions.test.tsx`: the session closes without a write when the selection changes, the deck changes, flow mode starts, the image becomes locked (remote or local), or the image node unmounts (deleted, group collapsed); a remote move or flip while open keeps the session and confirm applies to the latest box (two editors on one doc, as in `packages/model/test/concurrency.test.ts`).
- [x] T025 [US1] Implement `apps/app/src/editor/images/use-crop-interruptions.ts` and mount it from `crop-overlay.tsx` / `image-node.tsx` (unmount cancels). T024 green.
- [x] T026 [US1] Add a test in `apps/app/src/editor/images/image-node.test.tsx` that resizing a cropped image by a corner keeps the cropped ratio and ⇧ resizes freely (existing `image-resize.ts` keeps the box ratio; confirm no change is needed, fix if it reads the natural ratio).

**Checkpoint**: crop works with the pointer; US2 still works.

---

## Phase 5: User Story 4 - Edits survive saving, sharing and export (Priority: P1)

**Goal**: everything the canvas shows survives reload, file round-trip, two tabs and PNG / SVG export; a trimmed crop is reported once.

**Independent Test**: crop and flip two images, export PNG, SVG and the deck file; open the file in a fresh profile: identical.

- [x] T027 [P] [US4] Write tests first in `apps/app/src/library/library-actions.test.ts`: `importedMessage` gains the trimmed-crop count and appends "N image crops were trimmed to the picture edge." once (singular / plural), combined with the missing-pictures sentence; `apps/app/src/storage/library-ops.test.ts`: `importFile` returns `trimmedCrops` from `loadDeck`; export of a deck with edited images embeds the original picture bytes.
- [x] T028 [US4] Carry `trimmedCrops` through `apps/app/src/storage/library-ops.ts` and `apps/app/src/library/library-actions.ts` (`importedMessage`) and every caller that shows the import toast. T027 green.
- [x] T029 [P] [US4] Add an export test in `apps/app/src/editor/export/use-export-result.test.ts` (or `export-dialog-images.test.tsx`): PNG export of a deck with a cropped, flipped image goes through the same SVG (nested `<svg viewBox>` present in the rasterised source) and a deck without edits produces the same SVG as before.
- [x] T030 [P] [US4] Add a JSON panel test in `apps/app/src/editor/json-panel-view.test.ts`: an edited image shows `crop`, `flipX`, `flipY` and no picture bytes.

**Checkpoint**: US4 acceptance scenarios 1–8 covered by tests (two-tab case by T024).

---

## Phase 6: User Story 3 - Undo the edits or start over (Priority: P2)

**Goal**: Reset crop from toolbar, menu and crop bar; keyboard-only crop mode; announcements.

**Independent Test**: crop and flip an image, Reset crop: whole picture, same scale, still flipped; undo walks back crop sessions, resets and flips one at a time.

- [x] T031 [P] [US3] Write tests first in `apps/app/src/editor/actions/image-actions.test.ts`: `image.resetCrop` (toolbar + menu for `image`) disabled with "Not cropped" when there is no crop and "Locked" when locked; run calls `setImageCrop(id, null)` once and announces "Crop reset"; the crop bar's Reset sets the working frame to the whole picture without writing until Done (`crop-overlay.test.tsx`). Add a model test in `packages/model/test/undo.test.ts`: crop, flip, reset, flip in sequence are undone one at a time in reverse order; two images sharing one picture are edited independently.
- [x] T032 [US3] Add `image.resetCrop` (`Undo2`, "Reset crop") to `apps/app/src/editor/actions/image-actions.ts` and wire the crop bar's Reset in `apps/app/src/editor/images/crop-bar.tsx`. T031 green.
- [x] T033 [P] [US3] Write keyboard tests first in `apps/app/src/editor/images/crop-overlay.test.tsx`: on open, focus is on the frame; Tab order frame → eight handles clockwise from top-left → Reset → Cancel → Done; arrows move the focused handle or frame by 1 canvas px, ⇧ by 10, clamped; the size is announced after a key move; Enter applies ("Crop applied"), Escape cancels ("Crop cancelled") from any element in crop mode; opening announces the crop-mode instructions (contracts/ui.md).
- [x] T034 [US3] Implement keyboard operation, focus management and announcements in `apps/app/src/editor/images/crop-overlay.tsx` and `crop-bar.tsx` using `nudge` from `crop-session.ts` and the existing announcer (`useUiStore.getState().announce`). T033 green.

**Checkpoint**: all four stories pass their independent tests.

---

## Phase 7: Polish & cross-cutting

- [x] T035 [P] Add an addendum section "057: crop and flip" to `docs/decisions/0037-image-support.md` (fields and units, unflipped crop coordinates, nested-SVG export, one-write crop session, soft trim C2, rejected alternatives from research R1–R4, R10).
- [x] T036 [P] Update `DESIGN.md` (Image object: crop mode look, crop bar, flip toggle buttons, handle sizes; tokens only) and `apps/app/CLAUDE.md` if it lists editor modules or UI state (crop session).
- [x] T037 [P] Update `docs/backlog.md` §057 status to "implemented on `057-image-editing`" with the spec path and the ADR addendum.
- [x] T038 Run `pnpm bench` and save as `specs/057-image-editing/bench-after.md`; compare with `bench-before.md` and note any regression in the report.
- [x] T039 Run the full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; fix anything red (the smoke suite, incl. the no-third-party-requests check, must pass unchanged).
- [x] T040 Run the manual scenarios in `specs/057-image-editing/quickstart.md` (`pnpm dev`), record results in `specs/057-image-editing/quickstart-results.md`, take screenshots of scenarios 1, 6, 9, 11 in light and dark into `specs/057-image-editing/screenshots/`.
- [x] T041 Open the PR (Conventional Commits title `feat: image crop and flip (057)`), with the final report: what changed, bench numbers, what was skipped, what is uncertain.

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** → stories.
- Inside Phase 2: T003 → T004; T005 → T006; T006 → T007 → T008; T004 + T008 → T009 → T010; T006 + T008 → T011 → T012, T013.
- **US2 (Phase 3)** needs Phase 2 only. **US1 (Phase 4)** needs Phase 2 (T018 → T019 → T021; T021 → T023, T025). **US4 (Phase 5)** needs T010 and T013. **US3 (Phase 6)** needs US1 (crop bar, overlay).
- **Polish** after the stories you ship.

### Parallel opportunities

- Phase 2: T003, T005 together; then T007 and T011 tests while the other's implementation runs (different packages).
- US2: T014 and T016 tests in parallel.
- US1: T017, T020, T022, T024 tests in parallel (different files); T018 before T021.
- US4: T027, T029, T030 in parallel.
- Polish: T035, T036, T037 in parallel.

### Parallel example: User Story 1

```text
T017 crop-session.test.ts      | T020 crop-overlay.test.tsx
T022 image-actions + canvas handlers tests | T024 use-crop-interruptions.test.tsx
```

## Implementation Strategy

1. **MVP**: Phase 1 + Phase 2 + US2 (flip). Useful alone, small, exercises format, ops, drawing and export.
2. **Crop**: US1 (pointer), then US4 (load toast, export checks), then US3 (reset, keyboard).
3. Each checkpoint: `pnpm --filter` tests for the touched packages, then the full gate at T039.
4. Stop after T041; do not start other backlog items.
