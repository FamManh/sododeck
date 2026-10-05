# Feature Specification: Image editing (crop and flip)

**Feature Branch**: `057-image-editing`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "057 from docs/backlog.md: image crop and flip. Light editing of an image object on the canvas without leaving the editor: crop (drag handles, reset), flip horizontal / vertical. Edits are non-destructive (the stored picture is unchanged; the object keeps crop and flip values) and appear in export. Out of scope: rotate, filters, annotation, replacing the picture."

**Sources**: `docs/backlog.md` §057 (split from 055 on 2026-10-05); `specs/055-image-support/` (image object, picture store, deck file image section, PNG / SVG export, data model); `docs/decisions/0037-image-support.md`; `DESIGN.md` (selection toolbar, context menu, focus); AGENTS.md architecture rules 1, 2, 3, 5; constitution v1.0.0 (I, II, IV, VII).

## Context (today)

- Feature 055 added the image object: it can be moved, resized (aspect ratio kept by default), locked, grouped, connected, captioned, and is drawn in PNG / SVG export.
- The picture always shows whole. To show only part of a screenshot, the user has to edit it in another program and add it again, which loses the object's connectors, caption and place.
- The stored picture is shared by every image object that uses it (content-based id), so an edit must never change the stored bytes.

## Scope

**In scope**

- **Crop**: enter a crop mode on one selected image, drag handles on the edges and corners of a crop frame to choose the visible part of the picture, then confirm or cancel. Moving the crop frame inside the picture is allowed.
- **Reset crop**: one action shows the whole picture again.
- **Flip**: flip horizontal and flip vertical, each a toggle; applies to every selected image at once.
- **Non-destructive**: the stored picture never changes; the image object keeps its crop and flip values, and they can be undone, reset or changed at any time.
- **Everywhere the image is drawn**: canvas, PNG export and SVG export show the same crop and flip.
- **File and round-trip**: crop and flip are saved with the deck and in the deck file, and survive a lossless round-trip.

**Out of scope**

- Rotate (any angle), filters, brightness / contrast, annotation or drawing on a picture.
- Replacing the picture of an image object.
- Fixed-ratio crop presets (1:1, 16:9 …) and non-rectangular crops (circle, rounded mask).
- Cropping several images at once.
- Writing a cropped or flipped copy of the picture back to the picture store (a "bake" action).
- Animated GIF playback (still the first frame, as in 055).

## Clarifications

### Session 2026-10-05 (defaults taken from context; founder may revise)

- Q: How is a crop stored? → A: As the visible rectangle expressed relative to the whole picture (so it does not depend on the on-canvas size), plus two flip flags. Both are optional additions to 055's image object; an image without them shows the whole, unflipped picture.
- Q: Undo granularity while dragging crop handles? → A: One crop session (enter crop mode → any number of handle drags → confirm) is one undo step. Cancel leaves no undo step. Each flip is one undo step; reset crop is one undo step.
- Q: Does export honour crop and flip? → A: Yes, PNG and SVG export match the canvas exactly.
- Q: What happens to the object size when cropping? → A: The picture keeps its on-canvas scale: the object's frame shrinks or grows to the new visible part, and the part that stays visible does not move on the canvas.
- Q: Are fixed-ratio crop presets (1:1, 4:3, 16:9, original ratio) needed? → A: No (founder). Free crop only; Shift while dragging a corner keeps the current proportions; presets stay out of scope and can be added later without a file format change.
- Q: Does double-clicking an image open crop mode? → A: Yes (founder). Double-click opens crop mode; caption stays editable in the inspector as in 055.
- Q: With several images selected, some flipped and some not, what does a flip do? → A: Make them all the same (founder): if any selected unlocked image is not flipped on that axis, flip them all; if all are already flipped, unflip them all. The button shows pressed only when every selected unlocked image is flipped on that axis.
- Q: Should flip have keyboard shortcuts? → A: No (founder). Flip is reached only from the selection toolbar and the context menu; no new shortcut.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Crop an image to the part that matters (Priority: P1)

A user has pasted a full-window screenshot but only one dialog in it matters. They select the image, choose "Crop", drag the crop handles around the dialog and confirm. The image object now shows only the dialog, at the same scale and place, with its connectors and caption intact.

**Why this priority**: Cropping is the most common edit on a pasted screenshot and the main reason users leave the editor today.

**Independent Test**: Paste a screenshot, crop it to its top-left quarter, confirm: the object shows only that quarter, at the same on-canvas scale; reload: unchanged; ⌘Z: the whole picture is back in one step.

**Acceptance Scenarios**:

1. **Given** one selected, unlocked image, **When** the user chooses Crop (toolbar, context menu, or double-click on the image), **Then** crop mode opens: the whole picture is shown, the part outside the current crop is dimmed, and a crop frame with eight handles (four corners, four edges) is shown.
2. **Given** crop mode, **When** the user drags a corner or edge handle, **Then** the crop frame follows the pointer, cannot leave the picture, and cannot become smaller than the minimum image size.
3. **Given** crop mode, **When** the user drags inside the crop frame, **Then** the frame moves within the picture without changing its size.
4. **Given** crop mode, **When** the user holds Shift while dragging a corner, **Then** the crop frame keeps its current proportions.
5. **Given** crop mode with a changed frame, **When** the user confirms (Done button, Enter, or a click outside the image), **Then** the image object shows only the cropped part, the visible part stays where it was on the canvas at the same scale, and one ⌘Z restores the previous crop.
6. **Given** crop mode, **When** the user cancels (Cancel button or Escape), **Then** the image is exactly as before and no undo step is added.
7. **Given** a cropped image, **When** the user resizes it by a corner, **Then** the aspect ratio of the cropped part is kept (free resize with the modifier key, as in 055).
8. **Given** a cropped image, **When** the user enters crop mode again, **Then** the full picture is shown with the current crop as the starting frame, so a crop can be widened again.

---

### User Story 2 - Flip an image (Priority: P1)

A user has a picture of an arrow or a device facing the wrong way. They select it and choose "Flip horizontal" (or vertical). The picture mirrors in place; the caption and connectors stay as they were.

**Why this priority**: A single, cheap action that fixes a frequent layout annoyance; independent from crop.

**Independent Test**: Select an image, flip horizontal: the picture mirrors left-to-right; flip horizontal again: back to the original; each is one undo step.

**Acceptance Scenarios**:

1. **Given** a selected image, **When** the user chooses Flip horizontal, **Then** the picture is mirrored left-to-right inside the same frame; position, size, caption text and connectors do not change.
2. **Given** a selected image, **When** the user chooses Flip vertical, **Then** the picture is mirrored top-to-bottom inside the same frame.
3. **Given** a flipped image, **When** the same flip is chosen again, **Then** the picture returns to its unflipped look.
4. **Given** several selected images (possibly mixed with other items), **When** the user chooses a flip, **Then** if any selected unlocked image is not flipped on that axis, all of them become flipped; if all are already flipped, all become unflipped; other items are untouched, and it is one undo step.
5. **Given** several selected images, **When** the user looks at a flip button, **Then** it shows pressed only when every selected unlocked image is flipped on that axis.
6. **Given** a cropped image, **When** it is flipped, **Then** the same visible part of the picture stays visible, mirrored (crop and flip combine; flipping never shows a different part of the picture).

---

### User Story 3 - Undo the edits or start over (Priority: P2)

A user wants the original picture back after experimenting. They choose "Reset crop" (and toggle the flips off), or use undo.

**Why this priority**: Non-destructive editing is only useful if the way back is obvious.

**Independent Test**: Crop and flip an image, choose Reset crop: the whole picture shows again (flip unchanged); toggle flips off: the image looks exactly as when it was added.

**Acceptance Scenarios**:

1. **Given** a cropped image, **When** the user chooses Reset crop (toolbar, context menu, or in crop mode), **Then** the whole picture shows again at the same on-canvas scale, the previously visible part stays where it was, and it is one undo step.
2. **Given** an image that is not cropped, **When** the user looks at Reset crop, **Then** the action is disabled.
3. **Given** a cropped and flipped image, **When** the user undoes repeatedly, **Then** each crop session, reset and flip is undone one at a time in reverse order.
4. **Given** two image objects that use the same stored picture, **When** one is cropped and flipped, **Then** the other is unchanged.

---

### User Story 4 - Edits survive saving, sharing and export (Priority: P1)

A user crops and flips images, reloads, exports the deck file and the canvas as PNG / SVG, and opens the file elsewhere: every image looks the same everywhere.

**Why this priority**: An edit that is lost on reload or ignored by export would make the feature misleading.

**Independent Test**: Crop and flip two images, export to PNG, SVG and a deck file; import the file in a fresh browser profile: canvas and both exports show the same crop and flip.

**Acceptance Scenarios**:

1. **Given** a cropped and flipped image, **When** the page is reloaded, **Then** it shows the same crop and flip.
2. **Given** a deck with edited images, **When** saved to a deck file and opened again, **Then** crop and flip are restored exactly and the stored picture bytes in the file are the original ones.
3. **Given** a deck file from 055 (images without crop or flip), **When** opened and saved again, **Then** it opens unchanged and the saved file contains no crop or flip values.
4. **Given** an edited image, **When** the canvas is exported to PNG, **Then** only the cropped part is drawn, flipped as on the canvas, at the object's position and size.
5. **Given** an edited image, **When** the canvas is exported to SVG, **Then** the result shows the same crop and flip as the canvas and stays self-contained.
6. **Given** an edited image, **When** the JSON panel is open, **Then** it shows the crop and flip values on the image object.
7. **Given** an edited image, **When** it is copied and pasted, **Then** the copy keeps the crop and flip and still shares the stored picture.
8. **Given** two tabs open on one deck, **When** an image is cropped or flipped in one, **Then** the other shows the change.

---

### Edge Cases

- **Locked image** (or image in a locked group): Crop, Reset crop and Flip are disabled, and the usual locked hint shows if attempted by double-click.
- **"Picture missing" placeholder**: Crop is disabled (nothing to crop); flip values are kept and shown again once the picture becomes available; reset still works.
- **SVG picture**: crop and flip work the same as for raster pictures.
- **GIF picture**: crop and flip apply to the still frame shown.
- **Very small picture**: the crop frame cannot be made smaller than the minimum image size on canvas; for a picture already near that size, crop can only shrink as far as that minimum.
- **Image inside a collapsed group**: not reachable, so not editable; edits made before collapsing are kept.
- **Group bounds**: a crop that changes the object size updates the group's frame like any resize.
- **Crop mode interrupted** (another item selected, deck switched, flow mode started, the image locked, hidden or deleted by a remote change); switching browser tabs does not interrupt it: crop mode closes without applying, as a cancel.
- **Remote change during crop mode** (another tab moves or flips the same image): crop mode stays open and applies on confirm on top of the latest state; if the image was deleted, crop mode closes.
- **Zoom while in crop mode**: allowed; handles stay a constant on-screen size.
- **File with invalid crop values**: a value of the wrong type or outside 0–1 makes the file invalid like any other bad field, reported with its location; a crop that runs past the picture edge (for example a hand-edited file) is trimmed to the picture when the deck opens and reported once, and the deck still opens (an empty result is dropped and the image shows uncropped).
- **Connectors** on a cropped image attach to the cropped frame, not the full picture.
- **Alt text and caption** are not mirrored or cropped; only the picture is.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: An image object MUST be able to hold an optional **crop**: the visible rectangle of its picture, expressed relative to the whole picture so it is independent of the on-canvas size. Absent means the whole picture.
- **FR-002**: An image object MUST be able to hold two optional **flip** flags (horizontal, vertical). Absent means not flipped.
- **FR-003**: Crop and flip MUST NOT change the stored picture or its id; image objects that share a picture MUST be edited independently.
- **FR-004**: Users MUST be able to open crop mode on exactly one selected, unlocked image whose picture is available, from the selection toolbar, the context menu, and by double-clicking the image.
- **FR-005**: In crop mode the whole picture MUST be shown, the area outside the crop frame dimmed, and the crop frame MUST offer four corner handles, four edge handles and an inside drag area; the frame MUST stay inside the picture and no smaller than the minimum image size (055's minimum).
- **FR-006**: Holding Shift while dragging a corner handle MUST keep the crop frame's proportions.
- **FR-007**: Crop mode MUST be confirmable (Done button, Enter, click outside the image) and cancellable (Cancel button, Escape, or any interruption listed in Edge Cases); cancel MUST leave the image and the undo history unchanged.
- **FR-008**: Confirming a crop MUST keep the picture's on-canvas scale: the object's size becomes the cropped part at that scale and its position moves so the still-visible part does not move on the canvas.
- **FR-009**: A confirmed crop session MUST be exactly one undo step, however many drags it contained; reset crop MUST be one undo step; each flip action MUST be one undo step, including on a multi-selection.
- **FR-010**: Users MUST be able to reset the crop of a selected image (toolbar, context menu, crop mode); the action MUST be disabled when the image is not cropped; reset MUST keep the on-canvas scale and keep the previously visible part in place.
- **FR-011**: Users MUST be able to flip horizontal and flip vertical on all selected unlocked images at once from the selection toolbar and the context menu (no keyboard shortcut in this feature): if any of them is not flipped on that axis, all become flipped; otherwise all become unflipped. The control MUST show pressed only when every selected unlocked image is flipped on that axis. Other selected items MUST be untouched.
- **FR-012**: Flip MUST mirror the visible part in place: the object's position, size, caption, alt text and connectors MUST NOT change, and the same part of the picture MUST stay visible.
- **FR-013**: After a crop, resizing MUST keep the aspect ratio of the cropped part by default, with free resize on the modifier key as in 055.
- **FR-014**: Canvas, PNG export and SVG export MUST draw the same crop and flip; SVG export MUST stay self-contained and MUST embed the original picture (no new edited copy of the bytes is stored).
- **FR-015**: Crop and flip MUST be saved in the deck document and in the deck file, MUST round-trip losslessly, and MUST be omitted when absent so files from 055 open and re-save unchanged; the file schema validators MUST stay in agreement.
- **FR-016**: A crop value of the wrong type or outside 0–1 MUST be reported with its location like any other invalid field. A crop that runs past the picture edge MUST NOT stop the deck from opening: it is trimmed to the picture and reported once; if nothing is left the image is shown uncropped.
- **FR-017**: Crop, reset and flip MUST be refused on locked images (and images in locked groups) with the existing locked hint; Crop MUST be disabled on a "picture missing" placeholder.
- **FR-018**: Copy / paste and duplicate MUST keep crop and flip; multi-tab sync MUST carry them like any other image change.
- **FR-019**: All new controls (Crop, Reset crop, Flip horizontal, Flip vertical, Done, Cancel, crop handles) MUST have accessible names, visible focus and keyboard operation per DESIGN.md: crop mode MUST be operable without a pointer (move the focused handle or the frame with the arrow keys, larger steps with Shift), and entering, confirming and cancelling crop mode MUST be announced.
- **FR-020**: Crop and flip MUST NOT add any network request or load any picture from a network address; the no-third-party-requests check MUST keep passing.
- **FR-021**: Images without crop or flip MUST draw and export exactly as before this feature, and crop / flip MUST NOT regress canvas performance (benchmark before / after).

### Key Entities

- **Image object (extended from 055)**: gains an optional crop (visible rectangle relative to the whole picture) and optional flip horizontal / flip vertical flags.
- **Crop session**: a temporary UI state on one image (working crop frame, focused handle) that exists only while crop mode is open; it is not document data and becomes one document change on confirm.
- **Picture (unchanged from 055)**: stored bytes, shared and never edited.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user crops a pasted screenshot to one region and confirms in under 15 seconds without leaving the editor.
- **SC-002**: A user flips an image in one action (one click on the selection toolbar, or one context-menu item).
- **SC-003**: 100% of cropped and flipped images look identical on the canvas, in PNG export and in SVG export (same visible region, same orientation, same position and size).
- **SC-004**: A deck file with edited images, opened in a fresh browser profile, restores 100% of crop and flip values, and its stored pictures are byte-identical to the originals.
- **SC-005**: Every crop session, reset and flip is undone by exactly one undo; a cancelled crop session adds no undo step.
- **SC-006**: A deck file from 055 opens and re-saves byte-identically.
- **SC-007**: Crop mode can be completed with the keyboard alone.
- **SC-008**: Canvas benchmark shows no regression for decks with and without images.

## Assumptions

- Crop values are stored as fractions of the picture's natural size (0–1), which keeps them valid when the object is resized; the exact field names and the schema-version decision (additive to v1, as in 055) are settled in planning and recorded in an ADR or an addendum to ADR 0037.
- Free crop only (founder, 2026-10-05); no aspect-ratio presets. Shift keeps the current proportions.
- Double-click on an image opens crop mode (founder, 2026-10-05); it had no other meaning before. Caption editing stays in the inspector.
- Keyboard step sizes for moving handles (for example 1 screen pixel, 10 with Shift) follow the existing nudge behaviour for items.
- Crop mode is drawn on the canvas over the image (no separate dialog), following the selection toolbar and handle styles in DESIGN.md; no new design frame exists, so planning picks the closest existing tokens.
- The minimum crop size equals 055's minimum image size on canvas (32 px) at the current scale.
- No new runtime dependency is needed.
