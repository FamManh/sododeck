# Contract: UI (057)

Tokens and component styles from `DESIGN.md` (selection toolbar, context menu, resize handle, focus
ring). Icons from `lucide-react`. No new design frame exists; nothing here adds a colour.

## Actions (shared action list, `apps/app/src/editor/actions/image-actions.ts`)

| Id                | Label           | Icon              | Toolbar           | Menu                                       | Enabled when                                                         | Run                                        |
| ----------------- | --------------- | ----------------- | ----------------- | ------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------ |
| `image.crop`      | Crop            | `Crop`            | `image`           | `image`                                    | one image, unlocked (incl. group lock), picture available, edit mode | open crop mode                             |
| `image.resetCrop` | Reset crop      | `Undo2`           | `image`           | `image`                                    | one image, unlocked, has a crop                                      | `setImageCrop(id, null)`; announce         |
| `image.flipX`     | Flip horizontal | `FlipHorizontal2` | `image`, `images` | `image`, `images`, `mixed` (with ≥1 image) | ≥1 selected unlocked image                                           | `setImageFlip(unlocked ids, 'x', on)` (R6) |
| `image.flipY`     | Flip vertical   | `FlipVertical2`   | `image`, `images` | `image`, `images`, `mixed` (with ≥1 image) | ≥1 selected unlocked image                                           | `setImageFlip(unlocked ids, 'y', on)` (R6) |

- Flip buttons are toggle buttons: `aria-pressed="true"` when every selected unlocked image is
  flipped on that axis, else `false`.
- Disabled reasons (tooltip / `disabled-reason`): "Locked", "Picture missing", "Not cropped".
- No keyboard shortcut for any of them (clarification Q4).
- A disabled action attempted on a locked image by double-click shows the existing locked hint
  (`refuseLocked`).

## Double-click

Double-click on an image (canvas, edit mode) = `image.crop` when enabled; locked → locked hint;
picture missing → announce "Picture missing, nothing to crop". Caption editing is unchanged
(toolbar field popover / inspector).

## Crop mode

- **Look:** the whole picture is drawn at the current scale around the visible part (it may extend
  past the image box); the area outside the crop frame is dimmed with the overlay token; the crop
  frame has a 1 px primary border, eight resize handles (`sd-resize-handle` style, constant screen
  size at any zoom), and a move cursor inside. Connector handles, the lock glyph and the caption are
  hidden. The selection toolbar is hidden; a **crop bar** (selection toolbar container style, same
  placement rules) shows **Reset** (`Undo2`, disabled when the working frame is the whole picture),
  **Cancel** and **Done** (primary).
- **Pointer:** corner / edge handles resize the frame; dragging inside moves it; the frame is clamped
  to the picture and to the minimum (`minCropFraction`, 32 canvas px a side); ⇧ on a corner keeps
  the frame's proportions. A pointer down outside the picture and the crop bar = Done.
- **Keyboard:** focus starts on the frame (`role="group"`, name "Crop area, W × H"). Tab order:
  frame → handles clockwise from top-left ("Crop top left corner", "Crop top edge", …) → Reset →
  Cancel → Done. Arrows: 1 canvas px, ⇧ 10 px, on the focused handle's edges or the whole frame.
  Enter = Done, Escape = Cancel (from any element in crop mode).
- **Announcements (announcer):** "Crop mode. Drag the handles or use the arrow keys. Enter to apply,
  Escape to cancel." on open; "Crop applied" / "Crop cancelled" on close; the size after each key
  move.
- **Interruptions → cancel:** selection changes, Escape, flow mode, deck switch, the image unmounts
  or becomes locked (research R9).

## Canvas drawing

- Unedited image: unchanged (`<img>` with `object-contain`).
- Edited image: a clipping box at `pictureLayout.view` inside the node; the `<img>` at
  `pictureLayout.picture`, mirrored with `scale(-1, 1)` / `scale(1, -1)` about the view's centre.
  Alt text, caption and placeholder are never mirrored.

## Export

PNG and SVG as in [file-format.md](file-format.md#export-not-part-of-the-file-format-listed-for-completeness);
placeholders as in 055.
