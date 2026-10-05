# Feature Specification: Image support

**Feature Branch**: `055-image-support`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "055 from docs/backlog.md: image support. Upload images, and paste them with Ctrl+V. Founder decisions (2026-10-05): an image is its own canvas object (not inside cards); the deck keeps only a small reference to each image while the picture bytes are stored separately in the browser; the deck file embeds the pictures so a deck stays one file; pictures are compressed on import (long edge capped, like other diagram tools) so decks stay light; PNG, JPEG, WebP, GIF, SVG and AVIF accepted; 10 MB hard limit on the file given, 5 MB on what is stored, each with a clear error; images must also appear in the existing PNG / SVG export."

**Sources**: `docs/backlog.md` §055; `specs/053-sticky-notes-and-connectors/` (sticky as a canvas object: resize, lock, connect, toolbar); `apps/app/src/editor/export/` (PNG / SVG export); `specs/001-json-schema-v1/`, `specs/002-yjs-model/` (file format, round-trip); AGENTS.md architecture rules 1, 2, 3, 5, 6; constitution v1.0.0.

## Scope

**In scope**

- **Image object**: a new kind of canvas object that shows a picture. It can be moved, resized (aspect ratio kept by default), locked, deleted, copied / pasted, and connected to other items with connectors, like a sticky.
- **Ways to add**: choose a file from the Add flyout (file picker); paste an image from the clipboard with Ctrl/⌘+V; drop an image file onto the canvas.
- **Accepted files**: PNG, JPEG, WebP, GIF, SVG and AVIF, up to 10 MB each as given. Anything else, or anything larger, is refused with a clear message that says why; nothing is added.
- **Compression on import**: raster pictures (PNG, JPEG, WebP, AVIF) whose long edge is above 2048 px are scaled down to 2048 px and re-encoded; a picture is stored in its original form when that is already smaller. The result must be 5 MB or less, otherwise the file is refused. A GIF is stored as given and shown as a still first frame (no animation). An SVG is cleaned of scripts and outside references and stored as text.
- **Local storage**: pictures live in the browser with the deck (local-first), outside the deck's shared document, which holds only a small reference (id, size, position, optional alt text and caption).
- **One file**: saving a deck to a `.sododeck.json` file embeds its pictures; opening such a file restores them. Round-trip is lossless.
- **Export**: the existing PNG and SVG export draws images in place.
- **Alt text**: each image has an optional description used as accessible name.

**Out of scope**

- Images inside cards, tables or rules (a later feature if wanted).
- Animated GIF playback, HEIC and other formats not listed above.
- Editing: crop, flip, rotate, filters, annotation (tracked as feature 057, `docs/backlog.md`).
- Remote image URLs (an image is never fetched from the network; see FR-014).
- Export formats that do not exist yet (PDF, Mermaid), file extension change and Mermaid import (056), sharing, sync.

## Clarifications

### Session 2026-10-05

- Q: Is an image its own canvas object or part of a card? → A: Its own canvas object; not usable inside cards in this feature.
- Q: Where do the picture bytes live? → A: In a separate browser store keyed by a stable id; the deck document keeps only the reference; the deck file embeds the bytes.
- Q: Resize or re-encode on import? → A: Yes (revised 2026-10-05, replaces the earlier "keep original bytes"). Compress like other diagram tools: long edge capped at 2048 px, original kept when already smaller; 10 MB limit on the file given, 5 MB on the stored result, clear errors above them.
- Q: Which layer does an image sit on? → A: Interleaved with cards, like a whiteboard: a new image goes on top of everything drawn so far; a card added after an image sits above it; "Bring forward / Send backward" moves an image or a card past the other; groups keep their frame behind their content. (Corrected 2026-10-05 after code review: stickies are not ordered today, they always sit above cards, so interleaving is new work for cards and images; stickies stay as they are.)
- Q: Can an image belong to a group? → A: Yes. It moves with the group, is hidden when the group is collapsed, and is locked or unlocked with the group. (Corrected after code review: stickies do not belong to groups today; only cards and sub-groups do, so group membership for images is new work.)
- Q: Which formats? → A: PNG, JPEG, WebP, GIF, SVG, AVIF (revised from PNG / JPEG / WebP). Crop and flip move to feature 057.
- Q: Does export support images now? → A: Yes, in the existing PNG / SVG export.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Paste an image onto the canvas (Priority: P1)

A user copies a screenshot or a picture anywhere and presses Ctrl/⌘+V on the canvas. The picture appears at the centre of the visible canvas (or under the pointer if it is over the canvas), selected and ready to move.

**Why this priority**: It is the fastest path and what the founder asked for first.

**Independent Test**: Copy an image to the clipboard, focus the canvas, paste: an image object appears, survives a reload, and ⌘Z removes it in one step.

**Acceptance Scenarios**:

1. **Given** an image in the clipboard and the canvas focused, **When** the user pastes, **Then** one image object is added, selected, at a readable size (natural size, capped so it fits the visible canvas).
2. **Given** a text field is focused (inspector, rename, code panel), **When** the user pastes an image, **Then** nothing is added to the canvas and the field behaves normally.
3. **Given** the clipboard holds both text and an image, **When** the user pastes on the canvas, **Then** the image is added (a screenshot copied from a page carries both).
4. **Given** the clipboard holds only text or deck items, **When** the user pastes, **Then** existing paste behaviour is unchanged.
5. **Given** the image was added, **When** the user presses ⌘Z, **Then** the image disappears, and ⌘⇧Z brings it back with its picture.
6. **Given** a pasted image larger than 10 MB or of an unsupported type, **When** pasted, **Then** a message says which rule failed and nothing is added.

---

### User Story 2 - Upload an image from a file (Priority: P1)

A user chooses "Image" in the Add flyout, picks one or more files, and each appears on the canvas. Dropping files onto the canvas does the same.

**Why this priority**: Paste is not always possible (files on disk, other devices' downloads).

**Independent Test**: Pick two valid PNG files: two image objects appear side by side without overlapping, both selected; one ⌘Z removes both.

**Acceptance Scenarios**:

1. **Given** the Add flyout, **When** the user looks at it, **Then** an Image entry is present, reachable by keyboard.
2. **Given** the file picker, **When** the user chooses PNG, JPEG, WebP, GIF, SVG or AVIF files, **Then** only those types are selectable by default and each chosen file becomes an image object.
3. **Given** several files at once, **When** added, **Then** they are placed in a tidy row/grid from the insertion point and all are added in one undo step.
4. **Given** a file is dropped on the canvas, **When** dropped, **Then** the image is placed under the drop point.
5. **Given** a mix of valid and invalid files, **When** added, **Then** valid ones are added, and the message lists each refused file with its reason.
6. **Given** a drag that carries a file onto a locked or read-only area, **When** dropped, **Then** nothing is added and the usual locked hint shows.

---

### User Story 3 - Work with an image like any other item (Priority: P2)

A user moves, resizes, locks, deletes and connects an image, and describes it with alt text and an optional caption.

**Why this priority**: An image that cannot be arranged or linked is a pasted screenshot, not part of the diagram.

**Independent Test**: Resize a pasted image by a corner: its proportions hold; draw a connector from the image to a card; lock the image: it refuses move and resize.

**Acceptance Scenarios**:

1. **Given** a selected image, **When** the user drags a corner handle, **Then** it resizes keeping aspect ratio; holding the modifier key resizes freely; a minimum size applies.
2. **Given** an image, **When** the user drags from its connection handle to another item (or from another item to it), **Then** a connector is created, as with a sticky.
   3a. **Given** an image inside a group, **When** the group is moved, collapsed or locked, **Then** the image moves, hides or locks with it.
3. **Given** an image, **When** locked, **Then** it refuses move, resize and delete as other locked items do.
4. **Given** an image selected, **When** the user opens its inspector or toolbar, **Then** alt text and caption can be edited, and the original file name, type and size are shown read-only.
5. **Given** an image with alt text, **When** a screen reader reaches it, **Then** the alt text is its name; without alt text its name is "Image" plus the file name.
6. **Given** an image is deleted, **When** no other image uses the same picture, **Then** its stored bytes are removed after the undo history can no longer bring it back (see FR-011).
7. **Given** several images, **When** copied and pasted inside the deck, **Then** the copies reference the same stored picture (no duplicate bytes).

---

### User Story 4 - Save, reload and share the deck with images (Priority: P1)

A user's images survive closing the tab, reopening the deck, and exporting then importing a `.sododeck.json` file on another machine.

**Why this priority**: Losing pictures on reload or on file transfer would make the feature unusable.

**Independent Test**: Add images, export the file, import it into a fresh browser profile: every image is back with the same size, position and picture.

**Acceptance Scenarios**:

1. **Given** a deck with images, **When** the page is reloaded, **Then** the images show the same pictures, with no flash of broken images beyond a brief placeholder.
2. **Given** a deck with images, **When** exported to a `.sododeck.json` file, **Then** the file alone contains everything needed; opening it restores the images exactly.
3. **Given** an exported file imported twice, **When** the second import happens, **Then** identical pictures are not stored twice.
4. **Given** a deck file from before this feature (no images), **When** opened, **Then** it opens unchanged and re-saves without an image section.
5. **Given** a file whose image section is damaged or missing a picture, **When** opened, **Then** the deck still opens, the affected image shows a clear "picture missing" placeholder with its size and caption kept, and the user is told once.
6. **Given** a file that declares a picture that is over 5 MB or not one of the accepted types, **When** opened, **Then** that picture is treated as missing, never rendered.
7. **Given** a deck with images, **When** its JSON panel is open, **Then** it shows the references only, never raw picture data, and stays responsive.

---

### User Story 5 - Images appear in exports (Priority: P2)

A user exports the canvas to PNG or SVG and the images are drawn where they are on the canvas, below connectors and labels that sit on top of them.

**Why this priority**: An export that drops images would not match the canvas.

**Independent Test**: Export a deck with two images to PNG and to SVG; both show the images in place, in the same layering as the canvas.

**Acceptance Scenarios**:

1. **Given** a deck with images, **When** exported to PNG, **Then** each image is drawn at its position and size.
2. **Given** a deck with images, **When** exported to SVG, **Then** the file is self-contained (pictures embedded; nothing refers to an outside address).
3. **Given** a "picture missing" image, **When** exported, **Then** the same placeholder is drawn.
4. **Given** an export of a selection or a view, **When** done, **Then** only the images in scope are included.

---

### Edge Cases

- Pasting the same image many times: each paste is a new object; stored bytes are shared when identical.
- A very large picture (for example a tall screenshot): it is compressed per FR-005 and the object is shown at a capped on-canvas size.
- Animated GIF: only the first frame is shown; the message on add says so once.
- SVG with scripts or external links: refused, or cleaned if only harmless parts are removed.
- AVIF not decodable by the browser: refused with a clear message (feature-detected).
- Corrupt file with a correct extension or type: refused with "could not read this image"; nothing added.
- Browser storage full or unavailable: the user is told the image could not be saved and the object is not added (never an image that vanishes on reload without warning).
- Deck deleted from the library: its pictures are removed too.
- Two tabs open on one deck: images added in one appear in the other.
- Zoomed far out: images stay cheap to draw; zoomed in they stay sharp up to their natural size.
- Opening a deck file with hundreds of images: opens without freezing the interface (decoding runs off the main thread).
- Undo of a delete after a reload: the picture is still available while the deck can still undo; after cleanup it is gone only when nothing references it.
- The browser lacks a needed capability (for example clipboard image read): the feature falls back to what works (file picker, drop) and says so.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The deck MUST support an **image** object with: stable id, position, size, optional alt text, optional caption, lock flag, and a reference to its picture; it MUST take part in selection, move, resize, lock, delete, copy / paste, undo / redo and connectors like a sticky.
- **FR-020**: Images and cards MUST share one stacking order. A new image is placed above everything already drawn; a card added later sits above an earlier image; "Bring forward", "Send backward", "To front" and "To back" move an image or a card past images and cards alike; the order is saved with the deck and identical in the canvas and in PNG / SVG export. Group frames stay behind their content; stickies keep their present place above cards and images. A connector is drawn below cards, so it is also below any image that sits above a card, and above an image that sits below every card (a background picture).
- **FR-021**: An image MUST be able to belong to a group exactly as a card can: it moves with the group, is hidden while the group is collapsed (connectors to it follow the group edge as for hidden cards), and is locked or unlocked together with the group; a group's bounds include its images.
- **FR-002**: Users MUST be able to add images by file picker (Add flyout), by pasting from the clipboard on the canvas, and by dropping files on the canvas.
- **FR-003**: Accepted types MUST be PNG, JPEG, WebP, GIF, SVG and AVIF, identified by content, not only by file name; every other type MUST be refused with a message naming the problem.
- **FR-004**: A file over 10 MB, or a picture still over 5 MB after compression, MUST be refused with a message that states the limit and the size; nothing is stored.
- **FR-005**: Raster pictures (PNG, JPEG, WebP, AVIF) with a long edge above 2048 px MUST be scaled down to 2048 px and re-encoded on import; the original MUST be kept instead when it is already smaller than the result; transparency MUST be preserved; a GIF MUST be stored unchanged and shown as a still frame; compression MUST NOT change the object's on-canvas aspect ratio.
- **FR-019**: An SVG MUST be sanitised on import (no scripts, event handlers, embedded documents, or references to outside addresses) before it is stored or drawn; an SVG that cannot be made safe MUST be refused with a message. A stored or embedded SVG MUST be shown only as an image, never inserted into the page as live markup.
- **FR-006**: The deck document MUST hold only the reference to a picture (picture id, type, byte size, natural pixel size, original name); picture bytes MUST be kept in a separate browser store keyed by picture id and MUST NOT be part of the shared document, the JSON panel or undo history.
- **FR-007**: Identical pictures (after compression) MUST be stored once per deck (content-based id), however many image objects use them.
- **FR-008**: Saving a deck file MUST embed every referenced picture; opening a file MUST restore them; a deck without images MUST produce a file with no image section; a file from before this feature MUST open unchanged.
- **FR-009**: The round trip document → file → document MUST be lossless for image objects and their pictures, and the file format change MUST keep the file schema validators in agreement.
- **FR-010**: A missing, damaged or disallowed picture MUST show a visible "picture missing" placeholder, keep the object's size, position, caption and connectors, and MUST NOT stop the deck from opening.
- **FR-011**: Stored pictures no longer referenced by any image object MUST be removed from the browser store, but not while the deck's undo history could still restore a reference.
- **FR-012**: Adding one or several images MUST be one undo step; a failed add MUST leave no partial state.
- **FR-013**: PNG and SVG export MUST draw images at their canvas position and size and in the same stacking as the canvas; SVG export MUST be self-contained.
- **FR-014**: Image content MUST never be sent over the network and no image MUST be loaded from a network address; pictures are shown only from local bytes. The no-third-party-requests check MUST keep passing.
- **FR-015**: Browser capabilities used (clipboard images, drag and drop, file picker, persistent storage) MUST be feature-detected, with a working fallback and a short message when one is unavailable.
- **FR-016**: Decoding, hashing and embedding large pictures MUST NOT block the interface (heavy work off the main thread).
- **FR-017**: All new controls (Add entry, alt text, caption, placeholder, error messages) MUST have accessible names, keyboard operation and visible focus per DESIGN.md; errors MUST be announced.
- **FR-018**: Image support MUST NOT regress canvas performance for decks without images, and MUST be measured (benchmark before / after) for decks with images.

### Key Entities

- **Image object**: a canvas item (id, position, size, alt text, caption, locked, picture reference).
- **Picture**: the stored bytes with an id derived from content, media type, byte size, natural pixel size and original file name; shared by any number of image objects in a deck.
- **Picture store**: the browser-side holder of picture bytes, scoped to a deck, outside the shared document.
- **Deck file image section**: the part of a `.sododeck.json` file that embeds picture bytes, keyed by picture id.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user adds an image by paste in one keystroke and sees it on the canvas in under 1 second for a 2 MB picture.
- **SC-002**: A deck with 20 images (about 1 MB each) reopens after a reload with all pictures visible in under 3 seconds and without freezing input.
- **SC-003**: A file exported with images and imported into a fresh browser profile restores 100% of image objects and pictures (byte-identical).
- **SC-004**: 100% of refused files (wrong type, over the size limits, unreadable, unsafe SVG) produce a message that names the file and the reason; none leaves partial state.
- **SC-005**: The JSON panel and the deck document stay free of picture bytes: a deck of 20 MB of pictures shows no more than a few hundred bytes of JSON per image.
- **SC-006**: Every image in a deck appears in both PNG and SVG exports, and a deck without images exports byte-identically to before this change.
- **SC-007**: The smoke suite's no-third-party-requests check passes with a deck that holds images.
- **SC-008**: Canvas benchmark for a deck without images shows no regression versus the baseline.

## Assumptions

- "Image" objects are a new object kind in the file format; this needs a schema version decision recorded in an ADR (additive change to v1 versus new minor), settled in planning.
- 2048 px, 10 MB and 5 MB are starting values chosen to match common diagram tools; planning may adjust them with the benchmark.
- Compression runs off the main thread; the exact encoder and quality are planning details.
- Default on-canvas size is the natural size capped to a fraction of the visible canvas; the exact cap is a planning detail.
- Alt text and caption are plain text; no rich text.
- Embedding in the deck file is base64 text inside the JSON; file size grows by about a third of the picture bytes, which is accepted for a single-file deck.
- Pasting from the clipboard reads images the browser exposes to the paste event; no extra permission prompt is expected.
- Dropped files are handled only on the canvas, not in side panels.
- The picture store is per deck and is deleted with the deck; no cross-deck sharing in this feature.
- A soft warning when a deck's pictures exceed a large total (for example 100 MB) is a planning detail, not a requirement.
- Reference screenshots, if any, stay local and git-ignored as in 053.
