# Research: Image editing (crop and flip) (057)

All unknowns from the plan's Technical Context are resolved here. Code references are to the state of
`main` after 055 (`48bba013`).

## R1. How crop and flip are stored

- **Decision:** two additive, optional fields on the `Image` object:
  - `crop`: `{ x, y, width, height }`, fractions of the picture's natural size (0–1), measured in the
    picture's own, **unflipped** coordinates. Absent means the whole picture. Never written equal to
    the whole picture (reset removes the key). Written rounded to 6 decimals so files stay stable.
  - `flipX: true`, `flipY: true`: `const: true`, absent means not flipped, the same convention as
    `locked` (unflipping removes the key).
- **Rationale:** fractions do not depend on the on-canvas size, on compression (055 may store a
  2048 px copy of a larger file) or on the SVG fallback size, so a crop stays right whatever the
  stored pixels are. Keeping crop in unflipped coordinates makes flip a pure mirror of the visible
  part (spec US2-6) and lets crop and flip change independently. `const: true` flags keep a deck
  without edits byte-identical (FR-015, SC-006).
- **Alternatives considered:** crop in natural pixels (breaks when the stored copy differs from the
  file the user saw, and for SVG); crop in on-canvas pixels (breaks on every resize); one
  `flip: 'h' | 'v' | 'hv'` enum (harder to toggle one axis, and a fourth value "none" or absence
  would both mean the same); a `transform` matrix (opens the door to rotate, which is out of scope).

## R2. One geometry for canvas and export

- **Decision:** a pure function in `packages/model/src/geometry.ts`,
  `pictureLayout(box, natural, crop?, flip?)`, returns the rectangle the visible part is drawn in
  (the cropped region fitted inside the box, centred, as `object-fit: contain` does today) and the
  transform that draws the whole picture so only that region shows. The canvas node and the SVG
  export both draw from it.
- **Rationale:** SC-003 (canvas, PNG and SVG identical) is only testable if both draw from one
  calculation. The box can be letterboxed today (free resize with ⇧), so the fit step is needed.
- **Alternatives considered:** CSS `object-view-box` on the canvas (not in all target browsers, and
  export would still need its own maths); separate maths per renderer (two places to drift).

## R3. SVG and PNG export

- **Decision:** an image with no crop and no flip is written exactly as today (one `<image>` with
  `preserveAspectRatio="xMidYMid meet"`), so decks without edits export byte-identically (FR-021).
  An edited image is written as a nested `<svg>` at the box with
  `viewBox` = the crop region in natural pixels and `preserveAspectRatio="xMidYMid meet"`, holding
  one `<image>` of the whole picture at natural size, mirrored inside the viewBox by a
  `transform` when flipped. A nested `<svg>` clips to its viewport, so no `clipPath` id is needed.
  PNG export rasterises that SVG (`rasterize.ts`), so it follows with no change.
- **Rationale:** the picture stays the original embedded bytes (FR-014, no edited copy), the output
  is self-contained, and the nested viewBox expresses "this region, fitted" natively.
- **Alternatives considered:** `clipPath` + transformed `<image>` (needs unique ids per export and
  more attributes); drawing a cropped copy to a canvas and embedding that (a new edited copy of the
  bytes, slower, loses SVG vector pictures).

## R4. Crop session: UI state, one write on confirm

- **Decision:** crop mode is UI-only state in the Zustand store,
  `cropSession: { imageId, crop, handle } | null`, where `crop` is the working rectangle in picture
  fractions. Nothing is written to the document while dragging. **Confirm** calls one model op,
  `setImageCrop(id, crop | null)`, which writes `crop`, `size` and `position` in one transaction
  (one undo step). **Cancel** clears the session: no write, no undo step.
- **Rationale:** FR-007 / FR-009 / SC-005 follow by construction; nothing half-written can be left
  by an interruption. Unlike resize (`image-resize.ts`, live writes inside a gesture), other tabs
  do not see the crop until it is confirmed, which is fine for a modal edit.
- **Alternatives considered:** live writes inside a gesture like resize (a remote tab would see a
  flickering frame, and a long crop session would hold the gesture open while the user reads).

## R5. Keeping the scale on confirm and reset

- **Decision:** a pure function `cropFrame(box, natural, from, to, flip)` in `geometry.ts` computes
  the new box. The displayed scale `s` is the scale at which the old visible region is drawn in the
  old box (the `pictureLayout` fit). The new box is the new region × `s`, placed where that region is
  drawn now (mirrored when flipped), so the part that stays visible does not move. `setImageCrop`
  calls it inside the op, so the result is atomic and unit-tested in the model. Limits: a crop region
  smaller than 32 px on canvas at `s` is refused by the crop frame (FR-005); a reset whose full
  picture would exceed the 4096 px resize limit (`IMAGE_SIZE_LIMITS.max`) is scaled down to fit,
  keeping the centre of the old visible part in place.
- **Rationale:** spec Clarifications ("the picture keeps its on-canvas scale"), FR-008, FR-010.
  Letterboxed boxes collapse to the fitted region on the first crop, which is the expected result.
- **Alternatives considered:** keep the box size and zoom the picture into it (the picture jumps in
  scale, which the founder's default rejected).

## R6. Flip on a selection ("make them all the same")

- **Decision:** the action computes `on = !targets.every(isFlipped(axis))` over the selected,
  unlocked images and calls one model op, `setImageFlip(ids, axis, on)`, in one transaction. The
  toolbar button is pressed when `targets.every(isFlipped(axis))`. Locked images in the selection are
  skipped; when every selected image is locked the action is disabled with the locked reason.
- **Rationale:** clarification Q3 (founder): one press leaves all images facing the same way.
- **Alternatives considered:** per-image toggle (rejected by the founder).

## R7. Where the controls live

- **Decision:** a new action module in `apps/app/src/editor/actions/image-actions.ts` (the shared
  action list, ADR 0015): `image.crop` (toolbar + menu, kind `image`), `image.resetCrop` (toolbar +
  menu, kind `image`, disabled when not cropped), `image.flipX` / `image.flipY` (toolbar for `image`
  and `images`, menu for `image`, `images` and `mixed` when the selection holds an image). Icons from
  `lucide-react` 1.48: `Crop`, `FlipHorizontal2`, `FlipVertical2`, `Undo2` (reset). No keyboard
  shortcut (clarification Q4). Double-click on an image opens crop mode: the image branch of
  `onNodeDoubleClick` in `use-canvas-handlers.ts` (it returns early today).
- **Crop mode chrome:** the selection toolbar is hidden while crop mode is open (it already hides
  during gestures) and a small crop bar in the toolbar's place offers **Reset**, **Cancel** and
  **Done**, using the selection toolbar tokens from `DESIGN.md` (no new frame exists).
- **Alternatives considered:** a Flip dropdown (one more click for a one-click action, SC-002); a
  dialog for crop (leaves the canvas, against the backlog goal).

## R8. Keyboard and screen readers in crop mode

- **Decision:** on entering crop mode focus moves to the crop frame. Tab order: frame, the eight
  handles (clockwise from top-left), Reset, Cancel, Done. Arrow keys move the focused handle's edges
  (or the whole frame) by 1 canvas pixel, ⇧ for 10, clamped like a drag. Enter confirms, Escape
  cancels, from anywhere in crop mode. Each handle and the frame has an accessible name ("Crop top
  left corner", "Crop area") and announces the crop size after a key move. Entering, confirming and
  cancelling are announced through the existing announcer.
- **Rationale:** FR-019, SC-007, constitution VII. The step is finer than an image nudge (8 / 32
  px) because a crop is a precision edit.

## R9. Interruptions and remote changes

- **Decision:** the session is cancelled when the selection stops being exactly that image, the
  deck changes, the image node unmounts (deleted, hidden by a collapsed group, out of drill scope),
  the image becomes locked, or flow mode starts. Remote moves, resizes and flips are allowed while
  the session is open; confirm reads the latest box and flip, because the session stores only the
  crop in picture fractions.
- **Spec note:** the spec's "tab hidden" interruption is dropped: switching tabs and coming back
  should not lose a crop in progress, and nothing is written meanwhile. Recorded here; the spec edge
  case is updated.

## R10. Invalid crop values in a file

- **Decision:** the schema checks shape and ranges (`x`, `y` in [0, 1); `width`, `height` in
  (0, 1]), so a crop of the wrong type or outside 0–1 makes the file invalid like any other bad
  field, reported with its path (and fixable through 062). A crop that is in range per field but runs
  past the picture edge (`x + width > 1` or `y + height > 1`, typically from a hand-edited file) is
  trimmed to the picture on load and reported once as a load problem (`crop-trimmed`), so the deck
  still opens. A trimmed crop that collapses below the minimum is dropped (image shown uncropped).
- **Rationale:** consistent with every other field of the format (strict schema, ADR 0020 style),
  while keeping FR-016's promise that a near-miss never blocks a deck. Ajv / Zod parity covers the
  per-field ranges; the cross-field bound lives in the model's load checks like 055's picture
  problems.
- **Spec note:** FR-016 and the matching edge case are reworded to this split.

## R11. Picture missing and natural size

- **Decision:** crop needs the natural size, read from `meta.assets[asset].width / height`. With no
  asset facts or no bytes (placeholder) Crop is disabled; flip and reset stay available and the
  values are kept. The placeholder itself is never flipped or cropped (its text must stay readable).

## R12. Performance

- **Decision:** the canvas node computes `pictureLayout` only for images with a crop or a flip; an
  unedited image keeps its present `<img class="object-contain">`. Decks without images are not
  touched. `pnpm bench` before and after (the bench deck already contains synthetic images from
  055).
