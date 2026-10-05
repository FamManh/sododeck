# Research: Image support (055)

Each entry: Decision, Rationale, Alternatives. Code facts come from a read-only review on 2026-10-05.

## R1. What stickies do and do not give us

**Decision**: Model `image` on the sticky for storage shape, size, resize, lock, connector end and
toolbar. Do **not** assume it for group membership or stacking.

**Findings**: a sticky has only `anchor` or `position` (no group); groups hold only nodes and groups
(`group-members.ts`); stickies render at a fixed `zIndex: 1` and are not reorderable; arrange works
on `nodes` only (`arrange-actions.ts`); stickies are not in copy/paste (`fragment.ts`).

**Rationale**: the founder's stacking and group requirements are new mechanisms (R2, R3).

## R2. Stacking order shared by cards and images

**Decision**: add an optional numeric `z` to `Node` and a required `z` to `Image`. The **effective
rank** of a card is `z` when present, else its index in `deck.nodes`; an image always has `z`. The
stack order is all cards and images sorted by effective rank (ties: cards by array order, then
images by array order). Arrange actions (bring/send, to front/back) compute the new order for the
whole sequence and write ranks.

- New image: rank = (largest effective rank) + 1, so it is on top.
- New card: no `z`; its index is the largest of all cards, which keeps it above every image whose `z`
  is below the old maximum. Because a new image takes max+1 and a new card takes index n, ranks must
  be comparable: arrange and add normalise so the effective rank of a new card is also max+1 (the
  add-card op writes `z` only when an image exists in the deck; decks without images are untouched).
- Arrange writes explicit integer ranks `0..n-1` to every card and image in the affected scope in one
  transaction (one undo step), and keeps `deck.nodes` order consistent with card ranks so older
  readers and consumers that use the array order still get a sensible order.
- Rendering: React Flow `zIndex` = rank for cards and images. Group frames stay at `-1`. Stickies stay
  at their fixed layer above. Edges are drawn below every card; an image whose rank is below the
  lowest card gets a negative `zIndex` so connectors cross over it (a background picture); an image
  above any card hides connectors behind it, as cards do.
- Export uses the same sorted sequence (`scene.ts` produces one list; `render-svg.ts` draws it).

**Rationale**: meets the "paste, then draw on top; draw, then paste above" behaviour without a stacking
field on every object type; decks without images keep today's array-order behaviour and bytes.

**Alternatives**: fixed image layer under cards (simple, rejected by founder); a global z on all
objects including groups and stickies (largest change, nothing asks for it); linked "above X"
pointers (break on delete).

## R3. Images in groups

**Decision**: `Image.group` (optional group id). `group-members.ts` returns images next to nodes;
moving a group moves its images; collapsing hides them (the existing collapsed-group edge routing
treats an image end like a hidden card); locking a group locks the images too (lock stays one flag per
item, set together, as in 054); group bounds include image boxes.

**Rationale**: one flag and one list; no new group data. **Alternative**: `anchor`-style free images
only (rejected: the founder wants membership).

## R4. Where the bytes live

**Decision**: Dexie, existing `sododeck-library` database, new `blobs` table in **version 3** with
primary key `[deckId+id]` and the `Blob` as value. `deckId` scoping makes duplicate/delete trivial
(copy rows, delete rows); duplicate pictures inside a deck share a row (id is the content hash).

**Rationale**: reuses the opened database, one transaction with `purgeDeleted`, `isQuotaError`
already maps quota failures. A second database would lose atomic purge.

**Alternatives**: OPFS (feature support varies, extra permissions and API surface); base64 in Yjs
(rejected, see Complexity Tracking); one global content-addressed table (cross-deck GC is harder and
buys little).

## R5. Decode, compress, hash

**Decision**: worker uses `createImageBitmap(blob)`; scale with `OffscreenCanvas` (high-quality
resize) to a long edge of **2048 px** when larger; encode with `convertToBlob`: PNG stays PNG, JPEG
stays JPEG (quality 0.85), WebP stays WebP (0.85), AVIF is re-encoded as WebP (browsers cannot
reliably encode AVIF). Keep the original when it is smaller than the result or when no scaling was
needed. A GIF is not decoded for animation: store the original bytes, show the browser's first frame.
Id = lowercase hex SHA-256 of the **stored** bytes via `crypto.subtle.digest` (so identical results
dedupe). Limits: 10 MB in, 5 MB stored. Feature detection with an inline main-thread fallback (same
module, `<canvas>`), as `import-client.ts` does for imports.

**Rationale**: zero dependency, off main thread, matches principle V.

**Alternatives**: a compression library (extra bundle, no gain); WASM codecs (size, build). JPEG/WebP
quality and the 2048 cap are starting values; tune with the benchmark task.

## R6. SVG safety

**Decision**: an SVG is only ever shown through `<img>` or as a `data:` image inside the export SVG
(both are script-inert and cannot fetch sub-resources). Defence in depth: on import parse with
`DOMParser` (main thread; a worker has no DOM), allow-list elements and attributes, refuse documents
with `script`, `foreignObject`, event-handler attributes, `use`/`image`/`href` to non-fragment
targets, `@import` or `url(http…)` in styles, entity declarations; serialise the cleaned tree and
store that. Pure and testable (`sanitize-svg.ts`).

**Rationale**: no dependency; the allow-list is small; also keeps the "no third-party requests" check
safe. **Alternatives**: DOMPurify (only a transitive dependency of Monaco today; adding it is a
runtime dependency needing approval); render-to-PNG on import (loses vector quality, but a possible
fallback for SVGs that cannot be cleaned).

## R7. File format

**Decision**: additive, no version bump (ADR 0002 §6, 0022): optional root `images` array, optional
root `assets` map, optional `Node.z`. The Yjs document stores `AssetMeta` (type, bytes, pixel size,
file name) per picture in `meta`; the file's `assets[id]` adds `data` (base64). The model API:
`toJSON` returns the file **with `data` supplied by a caller-provided byte map** (`serializeDeck(doc,
bytes)`), and `fromJSON(file)` returns the document plus the decoded byte map; the app writes bytes to
the blob store before the document is saved. Semantic rules reject a missing or mismatched asset, a
type outside the allow-list, a hash that does not match the bytes (optional check, off by default for
speed, on in import tests) and over-limit sizes. An older build refuses a file with unknown keys
(`additionalProperties: false`, same accepted trade-off as 053).

**Alternatives**: a separate sidecar file (breaks "one file"); a `version` 2 (nothing is removed).

## R8. Orphan cleanup and undo

**Decision**: sweep on **deck open**: delete the deck's `blobs` rows that no image in the loaded
document references. The undo stack is empty at open, so nothing can still be restored, which meets
FR-011 without tracking history. Deleting the deck removes all its rows in `purgeDeleted`.

**Alternatives**: delete on image delete (breaks undo); timers (fragile).

## R9. Multi-tab

**Decision**: write the blob **before** the Yjs add, in the same tab. A peer tab learns of the image
through the existing Yjs channel; the shared IndexedDB already has the row. `use-picture-url` retries
once on focus and after 1 s if a row is missing, then shows the missing placeholder. No change to the
channel protocol.

## R10. Paste, drop, picker

**Decision**: extend `use-clipboard-events.ts`: when the target is not a text field and
`clipboardData.files` holds `image/*`, run the image path; text and deck-fragment paste stay as is
(an image on the clipboard wins when both exist, because page screenshots carry both). Canvas drop:
accept `Files` in `onDragOver`/`onDrop` next to the existing custom MIME types, under the same
view-only guard. Add flyout: an Image tile opening a hidden `<input type="file" multiple accept>`;
`accept` lists the six types. Multiple files lay out in a row from the insertion point; one undo step.
Clipboard menu paste (`readText` path) is unchanged; reading images via `navigator.clipboard.read` is
a TODO(M5) since the keyboard paste event covers the need.

## R11. Export

**Decision**: `buildScene` gains a `SceneImage` (box, picture id, alt) in the shared stack order;
`use-export-result` becomes async to read blobs and inline them as base64 `data:` URIs
(`rasterize.ts` loads the SVG as an `<img>`, where only `data:` sub-resources load, so `blob:` URLs
cannot be used, same reason fonts are inlined). A missing picture draws the same placeholder as the
canvas. `json-export` with "without notes" keeps assets (pictures are not notes); the bench
`scene.perf` ceiling gets an image case.

## R12. Search, outline, inspector, copy/paste

**Decision**: images appear in search (alt, caption, file name) and the outline; the inspector shows
alt, caption, read-only file info; copy/paste carries image records within a deck (the picture id
stays valid because the blob is deck-scoped). Pasting a fragment into another deck yields "picture
missing" placeholders. TODO(M5): carry bytes in cross-deck paste.

## R13. Limits and constants

2048 px long edge, 10 MB in, 5 MB stored, 100 MB soft total per deck (a toast, not a block), minimum
on-canvas size 32 px, default on-canvas size = natural size capped to 40% of the visible canvas width
and 480 px. All named constants in `geometry.ts` / `images/limits.ts`.
