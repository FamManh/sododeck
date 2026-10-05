# 0037. Image support: separate picture store, embedded in the file, shared stacking

- **Status:** Accepted (founder approved the principle I deviation, 2026-10-05)
- **Date:** 2026-10-05
- **Feature:** `specs/055-image-support` (research R1-R13)
- **Builds on:** 0002 (file format), 0022 (schema roadmap), 0031, 0036 (connector ends), constitution I, II, IV

## Context

Founder request: upload and paste images onto the canvas, keep them in the deck and the file, show
them in exports, compress them like other whiteboard tools, interleave them with cards, let them
belong to groups.

## Decision

- **An image is a canvas object** with its own collection `images`, a connector end like a sticky.
- **Bytes outside Yjs.** The document holds `images` and `meta.assets` (type, bytes, pixel size, name).
  Picture bytes are rows of a new Dexie table `blobs` keyed `[deckId+id]`, id = SHA-256 of the stored
  bytes. Rows are immutable, so they cannot drift from the document.
- **One file.** `.sododeck.json` gains optional root `images` and `assets` (base64). Additive, no
  `version` bump. `packages/model` stays the only Yjs ↔ JSON converter; it takes and returns a byte
  map, and the app moves bytes to and from the store.
- **Import pipeline in a worker:** sniff by content, 10 MB in, SVG sanitised by allow-list, raster
  scaled to 2048 px and re-encoded when that is smaller, 5 MB stored, hash, store, then add the object.
- **Shared stacking.** Optional `Node.z` plus `Image.z`; effective rank = `z` or array index; arrange
  actions write ranks. Edges stay below cards, so a background image sits under connectors.
- **Group membership** for images via `Image.group`.
- **Cleanup on deck open**, not on delete, so undo always works.
- **No new dependency.** Platform APIs: `crypto.subtle`, `createImageBitmap`, `OffscreenCanvas`, `DOMParser`.

## Alternatives considered

- **Base64 inside Yjs:** breaks autosave, tab sync and JSON panel budgets.
- **OPFS or a separate database:** more API surface, no atomic purge.
- **Fixed image layer:** contradicts the interleaving requirement.
- **A DOMPurify dependency:** new runtime dependency for a small allow-list.
- **Version bump:** nothing is removed or renamed.

## Consequences

- Constitution I is deviated from for immutable bytes only; recorded in `plan.md` Complexity Tracking.
- An older build refuses a file that has `images`/`assets`/`Node.z` (strict schema), the same trade-off as 0036.
- Cross-deck paste of images shows placeholders until bytes travel with fragments (TODO(M5)).
- Export becomes async (blob reads) and must inline `data:` URIs.
- Decks without images: no new keys, no new bytes.

## Addendum: crop and flip (057, 2026-10-05)

Spec: `specs/057-image-editing/` (research R1–R12, contracts `file-format.md` and `ui.md`).

- **Fields.** `Image` gains optional `crop` (`$defs/Crop`: `x`, `y`, `width`, `height`, fractions of
  the picture's natural size, in its own **unflipped** coordinates), `flipX: true` and `flipY: true`
  (`const: true`, unflipping removes the key, as `locked`). Appended after `locked`. Additive, no
  `version` bump; a 055 file re-saves byte-identically. A crop equal to the whole picture is never
  written; values are rounded to 6 decimals. `size` and `position` stay the box of the visible part.
- **Why fractions in unflipped coordinates.** Independent of the on-canvas size, of the stored copy
  (the 2048 px downscale) and of the SVG fallback size; flip is then a pure mirror of the visible
  part, and crop and flip change independently.
- **One geometry.** `pictureLayout` / `visibleRegion` in `@sododeck/model` give what to draw; the
  canvas node and the SVG export both use them. The SVG export writes an unedited picture exactly as
  before and an edited one as a nested `<svg viewBox="<visible region in natural px>">` holding the
  whole original picture, mirrored by a `transform`. A nested `<svg>` clips to its viewport, so no
  `clipPath` ids. PNG rasterises the same SVG. The stored bytes are never edited or copied.
- **One write per crop session.** Crop mode is UI state (`cropSession` in the UI store); confirm
  calls `setImageCrop`, which writes `crop`, `size` and `position` in one transaction (one undo
  step), keeping the picture's on-canvas scale (`cropFrame`). Cancel and interruptions write nothing.
- **Soft trim (C2).** Per-field ranges are schema rules; a crop that runs past the picture edge
  (`x + width > 1`) is trimmed on load and reported once in the open-time problem report (062, code `crop-trimmed`,
  a warning), so the deck opens.

Rejected: crop in natural or canvas pixels (breaks on compression or resize); one `flip` enum or a
transform matrix (harder toggles, invites rotate); CSS `object-view-box` (not in every target
browser, export would still need the maths); `clipPath` export (unique ids per export); a baked
cropped copy (new bytes, slower, loses SVG pictures); live writes during the crop drag (a remote tab
would see the frame flicker); refusing a file with an overflowing crop.
