# Implementation Plan: Image editing (crop and flip)

**Branch**: `057-image-editing` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/057-image-editing/spec.md`

## Summary

Add non-destructive crop and flip to 055's image object. The `Image` record gains three optional
fields: `crop` (the visible rectangle as fractions of the natural picture, in unflipped
coordinates), `flipX: true` and `flipY: true`. One pure function, `pictureLayout`, turns box +
natural size + crop + flip into what to draw, and both the canvas node and the SVG export use it,
so canvas, PNG and SVG match. Crop mode is UI-only state; confirm writes `crop`, `size` and
`position` in one model op (one undo step, picture keeps its on-canvas scale), cancel writes
nothing. Flip on a selection makes all selected images the same (founder). The stored picture is
never touched. No new dependency, no new root key, `version` stays 1.

## Technical Context

**Language/Version**: TypeScript strict (`noUncheckedIndexedAccess`), Node ≥ 24, pnpm monorepo

**Primary Dependencies**: existing only: React 19, `@xyflow/react` (node, `NodeResizeControl` style
reused for crop handles), Yjs, Zustand, Zod / Ajv, `lucide-react` 1.48 (`Crop`, `FlipHorizontal2`,
`FlipVertical2`, `Undo2`).

**Storage**: Yjs document (three optional `Image` fields); `.sododeck` v1 additive. Picture store
(Dexie `blobs`) unchanged.

**Testing**: Vitest (geometry, ops, round-trip, schema parity, load checks); Testing Library for the
actions, crop mode (pointer and keyboard), image node drawing; SVG export string tests. No new e2e;
the smoke suite stays green.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox, Safari.

**Project Type**: monorepo web app (`packages/schema`, `packages/model`, `apps/app`).

**Performance Goals**: no regression in `pnpm bench` (500 nodes / 1,000 edges, synthetic images);
crop handles follow the pointer at 60 fps (no document writes during a crop drag).

**Constraints**: no network; tokens only; keyboard-operable crop mode; unedited images and decks
without edits draw, save and export byte-identically to today.

**Scale/Scope**: per image edits; tens to a few hundred images per deck (055).

## Constitution Check

_GATE: passed before Phase 0, re-checked after Phase 1._

| Principle                                    | Result                                                                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | Pass. Crop and flip live in the Yjs `Image` record. The crop session is UI-only working state in Zustand, never a copy of document data, and becomes one document write on confirm.     |
| II. Schema-owned format, lossless round-trip | Pass. Additive optional fields in v1.json, types and Zod regenerated, Ajv / Zod parity, round-trip cases, 055 files re-save byte-identically. All Yjs ↔ JSON stays in `packages/model`. |
| III. Stable identity                         | Pass. No new ids; the image id and picture id are unchanged by edits.                                                                                                                   |
| IV. Local-first, private                     | Pass. No network; export embeds the original picture bytes only.                                                                                                                        |
| V. Performance off the main thread           | Pass. No heavy work: crop and flip are a few arithmetic operations; no image re-encoding (a "bake" is out of scope). Bench before and after.                                            |
| VI. Strict types and tested                  | Pass. `pictureLayout`, `cropFrame`, `minCropFraction`, crop-trim and the ops are pure / unit-tested; UI by role and label.                                                              |
| VII. Accessible                              | Pass. Every control named; crop mode fully keyboard-operable with announcements (contracts/ui.md).                                                                                      |
| VIII. Simplicity, dependencies               | Pass. No dependency; nested SVG viewBox instead of clip-path ids; no live gesture writes. Not built: rotate, presets, bake, multi-image crop, shortcuts.                                |

No deviations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/057-image-editing/
├── plan.md              # this file
├── research.md          # R1–R12
├── data-model.md        # Image fields, ops, geometry, crop session
├── quickstart.md        # automated checks + 16 manual scenarios
├── contracts/
│   ├── file-format.md   # Crop def, flipX / flipY, rules C1–C3, SVG output
│   └── ui.md            # actions, double-click, crop mode, drawing
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                  # $defs.Crop; Image.crop, Image.flipX, Image.flipY
├── src/generated/{types,zod}.ts    # pnpm schema:generate
├── examples/full.sododeck.json     # uses crop, flipX, flipY
├── test/                           # parity + fixtures (valid, out-of-range crop)
└── CLAUDE.md

packages/model/
├── src/geometry.ts                 # pictureLayout, cropFrame, minCropFraction, CropRect
├── src/ops/images.ts               # setImageCrop, setImageFlip
├── src/editor.ts                   # DeckEditor wrappers
├── src/load-checks.ts              # C2: trim crop past the picture edge, problem 'crop-trimmed'
├── src/key-order.ts / write.ts     # crop, flipX, flipY after locked (if key order is listed there)
├── test/                           # geometry, ops (undo, locked, no-op), round-trip, 055 byte-identity, trim
└── CLAUDE.md                       # image ops list

apps/app/src/
├── state/ui-store.ts               # cropSession + open/update/close
├── editor/images/image-node.tsx    # edited picture drawn from pictureLayout; crop overlay when in session
├── editor/images/picture-view.tsx  # new: clipped, mirrored <img> from pictureLayout
├── editor/images/crop-overlay.tsx  # new: dimmed picture, frame, 8 handles, keyboard
├── editor/images/crop-bar.tsx      # new: Reset / Cancel / Done in the toolbar's place
├── editor/images/crop-session.ts   # new, pure: drag / key maths on CropRect (clamp, ⇧ ratio, min)
├── editor/images/use-crop-interruptions.ts  # new: cancel on selection / deck / flow / lock / unmount
├── editor/actions/image-actions.ts # image.crop, image.resetCrop, image.flipX, image.flipY
├── editor/quick-edit/selection-toolbar.tsx  # hidden while cropSession is open
├── editor/use-canvas-handlers.ts   # image branch of onNodeDoubleClick → crop
├── editor/deck-to-flow.ts          # pass crop / flip / natural size in ImageFlowNode data
├── editor/export/scene.ts          # SceneImage gains crop, flip, natural size
└── editor/export/render-svg.ts     # nested <svg viewBox> for edited images; unchanged otherwise
docs/decisions/0037-image-support.md  # addendum: crop / flip fields, export, undo (or ADR 0039)
DESIGN.md                           # Image object: crop mode, crop bar, flip toggles
docs/backlog.md                     # 057 status
```

**Structure Decision**: existing layout. Format in `schema`, Yjs ↔ JSON, geometry and ops in
`model`, crop mode, actions, drawing and export in `apps/app`. No new package.

## Phase 0 and Phase 1 outputs

- Phase 0: [research.md](research.md), all unknowns resolved (R1–R12).
- Phase 1: [data-model.md](data-model.md), [contracts/file-format.md](contracts/file-format.md),
  [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md).
- Spec updated from research: FR-016 and its edge case (strict per-field schema, soft trim past the
  picture edge, R10); "tab hidden" removed from interruptions (R9).

## Delivery order (for tasks)

1. **Format and model** (tests first): `Crop` def and flags, parity, example; `pictureLayout`,
   `cropFrame`, `minCropFraction`; `setImageCrop`, `setImageFlip`; load trim; round-trip and 055
   byte-identity.
2. **Drawing**: `picture-view.tsx` in the image node for edited images; scene + SVG export; PNG
   follows. (Delivers US4 render side; testable with hand-written decks.)
3. **Flip**: actions, toggle state, multi-select rule, menu kinds. (US2.)
4. **Crop mode**: session state, overlay, pointer maths, crop bar, confirm / cancel, double-click,
   interruptions. (US1.)
5. **Reset and keyboard**: reset action (toolbar, menu, crop bar), keyboard operation and
   announcements. (US3, FR-019.)
6. **Docs and gate**: ADR addendum, DESIGN.md, package `CLAUDE.md`s, backlog status, bench before
   / after, lint, typecheck, test, build, e2e, quickstart screenshots.

Slices 1–3 ship a useful flip on their own; slice 4 needs 1–2.

## Post-design Constitution Check

Re-checked after Phase 1: unchanged, all pass. Watch items: bench numbers (image node gains a branch
for edited images); 055 files must re-save byte-identically (key order of the new fields).
