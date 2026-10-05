# Data model: Image editing (crop and flip) (057)

Additive to 055's data model (`specs/055-image-support/data-model.md`). Nothing else changes.

## Document (Yjs, converted by `packages/model` only)

### Image (existing collection `images`) gains

| Field   | Type                                | Notes                                                                                                                                                                                                                           |
| ------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crop`  | `{ x, y, width, height }`, optional | Fractions of the natural picture, unflipped coordinates. `x`, `y` ∈ [0, 1); `width`, `height` ∈ (0, 1]; `x + width ≤ 1`, `y + height ≤ 1`. Absent = whole picture; never stored equal to `{0, 0, 1, 1}`. Rounded to 6 decimals. |
| `flipX` | `true`, optional                    | Mirrored left-to-right. Absent = not flipped; `false` is not valid.                                                                                                                                                             |
| `flipY` | `true`, optional                    | Mirrored top-to-bottom. Absent = not flipped; `false` is not valid.                                                                                                                                                             |

Key order: appended after `locked` in the order `crop`, `flipX`, `flipY`, so a file written by 055
re-saves byte-identically and a round-trip is byte-stable.

`size` and `position` keep their meaning: the on-canvas box of the **visible** part. A crop change
rewrites them (R5).

### Ops (new, `packages/model/src/ops/images.ts`)

| Op                               | Writes                                     | Undo                   | Refuses                                                                                                                           |
| -------------------------------- | ------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `setImageCrop(id, crop \| null)` | `crop` (or deletes it), `size`, `position` | one step, no merge key | locked image (`locked`); crop out of bounds or below the minimum on canvas (`invalid`); unknown asset facts (`missing-reference`) |
| `setImageFlip(ids, axis, on)`    | `flipX` / `flipY` (set or delete)          | one step for all ids   | any locked id (`locked`); unknown id                                                                                              |

No-op (no transaction, no undo step) when nothing would change.

### Pure geometry (new, `packages/model/src/geometry.ts`)

- `pictureLayout(box, natural, crop?, flip?)` → `{ view: Rect, picture: Rect, flipX, flipY }`:
  `view` is the cropped region fitted (contain, centred) in the box; `picture` is where the whole
  picture is drawn so the region fills `view`. Shared by the canvas node and the SVG export.
- `cropFrame(box, natural, from, to, flip)` → `Rect`: the new box for a crop change at the same
  displayed scale, with the still-visible part kept in place; scaled down to the 4096 px limit when
  needed (R5).
- `minCropFraction(box, natural, crop)` → `{ width, height }`: the smallest crop region (in
  fractions) that stays at least 32 canvas px at the current scale; used by the crop frame.

## UI-only (Zustand)

`cropSession: { imageId: Id; crop: CropRect; handle: CropHandle | null } | null`, with
`CropHandle` = the eight handles or `'frame'`. Opened by the Crop action or double-click, closed by
confirm, cancel or an interruption (research R9). Never document data.

## File (`.sododeck`)

`Image` gains optional `crop`, `flipX`, `flipY` as above; see
[contracts/file-format.md](contracts/file-format.md). No new root key; `version` stays 1.

## Load checks

- Per-field shape and ranges: JSON Schema (structural; a bad value makes the file invalid).
- `x + width > 1` or `y + height > 1`: trimmed on load, problem `crop-trimmed` (subject: image id,
  path `images.<i>.crop`); a trimmed region of zero size drops the crop.

## State transitions (crop mode, per editor)

`closed` → `open` (Crop action / double-click on one selected, unlocked image with its picture) →
`closed` on **confirm** (one write) or **cancel / interruption** (no write).
