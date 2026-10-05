# Tasks: Image support (055)

**Inputs**:

- [plan.md](plan.md), [spec.md](spec.md). Founder decisions (2026-10-05): image is its own canvas object; bytes outside Yjs in a Dexie `blobs` table; compress on import (2048 px, 10 MB in, 5 MB stored); PNG, JPEG, WebP, GIF, SVG, AVIF; shared stacking with cards; images can join groups; images appear in PNG / SVG export; crop and flip are feature 057.
- [research.md](research.md) (R1–R13), [data-model.md](data-model.md), [contracts/file-format.md](contracts/file-format.md), [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md), ADR [0037](../../docs/decisions/0037-image-support.md).
- Precedents to copy: 053 / ADR 0036 (a sticky as connector end, additive optional fields, lock flag), 054 (group lock cascade), `db/import/import-client.ts` (worker client with inline fallback), `storage/library-db.ts` (Dexie versions).

**Tests**: required (constitution VI). Write each group's tests first and watch them fail. No new e2e; the smoke suite must stay green.

**Gate before Phase 2**: the founder must approve the constitution principle I deviation (picture bytes outside Yjs) recorded in plan.md Complexity Tracking. Do not start Phase 2 without it.

**Organization**: one phase per user story in priority order (US1, US2, US4 are P1; US3, US5 are P2). All stories build on Phase 2. US5 can ship separately after US1 to US4; the stacking part of US3 can ship before the rest.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1 to US5 from spec.md.

## Path Conventions

- App: `apps/app/src/` (editor in `apps/app/src/editor/`, storage in `apps/app/src/storage/`, new `apps/app/src/images/`)
- Model: `packages/model/src/`, tests in `packages/model/test/`
- Schema: `packages/schema/schema/v1.json`, tests in `packages/schema/test/`
- Test pictures: tiny valid files (a few hundred bytes) generated in `apps/app/src/images/test-pictures.ts`; no large binaries are committed.

---

## Phase 1: Setup

- [x] T001 Confirm branch `055-image-support` and a green baseline: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`. On `main`'s code (before any change) run `pnpm bench` and save the output as `specs/055-image-support/bench-before.md` (500 nodes / 1,000 edges numbers).
- [x] T002 Commit the spec folder (spec, plan, research, data-model, contracts, quickstart, tasks, checklists), `docs/decisions/0037-image-support.md` (status Proposed) and the `docs/backlog.md` changes (055 decisions, new 057) as `docs: image support spec, plan and tasks (055)`.

---

## Phase 2: Foundational (format, model, stacking, storage, ingest)

**Purpose**: everything every story needs: the file format, the `images` collection, the shared stacking order, group membership, the picture store and the import pipeline as pure, tested modules. No UI yet.

### Format

- [x] T003 [P] Add fixtures to `packages/schema/test/fixtures.ts`: a valid deck with one image of each of the six types and its `assets`; valid `Node.z`; invalid cases: image without `asset`, `asset` not 64 hex, `size.w: 8`, `z: "1"`, `locked: false`, `assets` entry with an unlisted `type`, `bytes` above 5 242 880, `data` not base64, `width: 0`, edge end naming a missing image, image `group` naming a missing group, image id equal to a node id. Watch the invalid ones fail to be refused.
- [x] T004 Edit `packages/schema/schema/v1.json` per contracts/file-format.md: root optional `images` (array of `Image`) and `assets` (object keyed by 64-hex id, value `Asset` = AssetMeta + `data`); `Image` fields in the order of data-model.md; `Node.z` optional number appended last; `Edge.from` / `to` descriptions name "node, group, sticky or image". Every property keeps a `description`. Run `pnpm schema:generate`.
- [x] T005 Add semantic rules I1 to I7 in `packages/schema/src/semantic-rules.ts` (asset resolves, allow-list, bytes equal decoded length and ≤ 5 242 880, id clash order node / group / sticky / image, group ref, size minimum, hash match behind an option the import path turns on). Update `packages/schema/examples/full.sododeck.json` so every new field is used (the coverage test requires it), `packages/schema/src/index.ts` (`emptySododeckFile` unchanged: optional keys stay absent) and `packages/schema/CLAUDE.md`. Run `pnpm --filter @sododeck/schema test`.

### Model: images collection, assets, round trip

- [ ] T006 [P] Write model tests first in `packages/model/test/images.test.ts` and `round-trip.test.ts`: `addImages` adds N objects in one undo step with ids `img_…`, top rank, and writes `meta.assets` once per picture id; a deck without images writes no `images` rows and no `meta.assets` and re-exports byte-identical; JSON → doc → JSON with bytes is byte-identical for each of the six types; `moveImage`, `setImageSize` (clamped to 32 px), `setImageText` (alt, caption) are one step each; unknown optional data is kept.
- [ ] T007 Implement the collection in `packages/model/src/layout.ts` (`COLLECTIONS` gains `images`), `deck.ts`, `read.ts`, `write.ts`, `key-order.ts`, `validate.ts`, `ids.ts` (`img` prefix), `ops/collections.ts`, new `ops/images.ts`, `geometry.ts` (`IMAGE_MIN_SIZE`, `imageBox`, `defaultImageSize`) and export from `index.ts`. Add `images` to the undo roots in `editor.ts`. T006 passes except assets.
- [ ] T008 [P] Write `packages/model/test/assets.test.ts` first: `assetId(bytes)` is lowercase hex SHA-256 and stable; `serializeDeck(doc, bytes)` fills `assets[id].data` from the byte map and omits unreferenced pictures; `fromJSON(file)` returns the document plus a decoded byte map and strips `data` from the document; a missing or mismatched asset (hash, length, type) yields a "picture missing" problem and does not throw; an unreferenced `assets` entry is dropped on the next save.
- [ ] T009 Implement `packages/model/src/assets.ts` (`assetId`, `AssetMeta` helpers, `splitAssets`, `attachAssets`), the `meta.assets` read / write (lazy, only when images exist) and the model API change `serializeDeck(doc, bytes)` / `fromJSON(file) → {doc, bytes}` in `deck.ts` and `snapshot.ts`, keeping existing callers working through an optional argument. T008 is green.

### Model: stacking, groups, ends, lock, cascade

- [ ] T010 [P] Write `packages/model/test/stack-order.test.ts` first: `stackOrder(deck)` sorts cards and images by effective rank (`z` else array index; ties: cards then images); a deck without images keeps array order; a new image takes max + 1; a card added after an image gets a rank above it (the add-card op writes `z` only when images exist); `bringForward`, `sendBackward`, `bringToFront`, `sendToBack` over mixed selections write contiguous integer ranks in one undo step and keep `deck.nodes` order consistent with card ranks; deleting a card or image renormalises nothing it does not need to; ranks of images in a collapsed or locked group still reorder (lock refuses, see T014).
- [ ] T011 Implement `packages/model/src/stack-order.ts` (pure) and `packages/model/src/ops/stacking.ts` (`restack`, the four arrange ops over `nodes` and `images`, rank-aware `addNode`), wire `z` through `read.ts` / `write.ts` / `key-order.ts` for nodes, expose via `editor.ts` and `index.ts`. T010 is green; the existing arrange tests stay green.
- [ ] T012 [P] Write model tests first in `packages/model/test/group-members.test.ts`, `integrity.test.ts`, `cascade.test.ts`: an image with `group` is a member (moving the group moves it, bounds include it, collapsing hides it); `setImageGroup` / ungroup is one step; an edge with an image end passes `validate`; a missing image end is `missing-reference`; id clash order node, group, sticky, image is reported; deleting an image removes its connectors (preview lists them); deleting a group ungroups or removes its images as for cards.
- [ ] T013 Implement images in `packages/model/src/group-members.ts`, `endpoint.ts` (a fourth collection, keep the `WeakMap` cache), `ops/refs.ts`, `integrity.ts`, `load-checks.ts`, `ops/cascade.ts`, `ops/images.ts` (`setImageGroup`), `problems.ts` (image with missing asset meta or missing group). T012 is green.
- [ ] T014 [P] Write `packages/model/test/node-lock.test.ts` cases first: lock over `images`; locked images refuse move, resize, delete, regroup, restack; locking a group locks its images, unlocking unlocks them; one undo step.
- [ ] T015 Generalise `setLocked` (`LockCollection` gains `images`) and the group lock cascade in `packages/model/src/ops/node-lock.ts`; make image ops and `ops/stacking.ts` refuse locked targets. T014 is green.
- [ ] T016 [P] Write search and text tests first in `packages/model/test/search.test.ts`: images are found by alt text, caption and file name (`SearchKind` gains `image`). Implement in `packages/model/src/search/index.ts`, `search/search.ts`, `text-fields.ts`.
- [ ] T017 [P] Write fragment tests first in `packages/model/test/fragment.test.ts` and `paste.test.ts`: copy of images (with cards) within a deck pastes new ids, keeps `asset` ids and group relations, offsets position, stacks on top; pasting into another deck keeps the records and the picture is reported missing. Implement in `packages/model/src/fragment.ts` and `ops/paste.ts`.

### Storage: blob store

- [x] T018 [P] Write `apps/app/src/storage/blob-store.test.ts` first with `fake-indexeddb`: `putBlob` writes once and ignores a duplicate, `getBlob`, `hasBlob`, `listBlobIds(deckId)`, `deleteBlobs(deckId, ids)`, `deleteDeckBlobs(deckId)`; a quota error maps to the existing quota error type; two decks keep separate rows for the same id; the library DB upgrade from version 2 keeps decks and updates intact.
- [x] T019 Implement `LibraryDb` version 3 in `apps/app/src/storage/library-db.ts` (`blobs: '[deckId+id]'`), `apps/app/src/storage/blob-store.ts`, and make `purgeDeleted` delete a purged deck's blobs in the same transaction. T018 is green.
- [x] T020 [P] Write `apps/app/src/storage/blob-gc.test.ts` first: `sweepBlobs(deckId, referencedIds)` deletes unreferenced rows only, keeps referenced ones, is idempotent, and never touches another deck. Implement `apps/app/src/storage/blob-gc.ts` and call it once when a deck is opened (after load, before editing).
- [ ] T021 Make `apps/app/src/storage/library-ops.ts` (`importFile`, `exportDeck`, `duplicate`) carry assets: import writes decoded bytes to the blob store before the document is saved; export reads referenced bytes and passes the byte map to `serializeDeck`; duplicate copies the blob rows to the new deck id. Update `library-worker-protocol.ts` and `library.worker.ts`; add tests in `library-ops.test.ts` for round trip, duplicate, and an import with a missing asset.

### Ingest pipeline (pure + worker)

- [x] T022 [P] Write `apps/app/src/images/sniff-type.test.ts` first: detect PNG, JPEG, WebP, GIF, AVIF, SVG from content bytes regardless of name or declared type; refuse others (HEIC, BMP, PDF, text); a PNG named `.jpg` is detected as PNG. Implement `apps/app/src/images/sniff-type.ts`.
- [x] T023 [P] Write `apps/app/src/images/fit-within.test.ts` first and implement `fit-within.ts` (scale to a long edge of 2048 keeping aspect, never upscale) and `choose-smaller` (keep the original when the result is not smaller). Add `apps/app/src/images/limits.ts` with the named constants (2048, 10 MB, 5 MB, 100 MB soft, 32 px).
- [x] T024 [P] Write `apps/app/src/images/sanitize-svg.test.ts` first: allowed shapes, text, gradients, `style` without `url(http…)` pass and are re-serialised; `script`, `foreignObject`, `on*` attributes, `javascript:` and external `href` / `xlink:href`, `<use>` to another document, `@import`, entity declarations, `<image>` with an external or `data:` html target are refused with a reason; fragment-only `href="#id"` is allowed; output has no external reference. Implement `apps/app/src/images/sanitize-svg.ts` (allow-list over `DOMParser`, main thread).
- [x] T025 [P] Write `apps/app/src/images/ingest.test.ts` first with injected `decode`, `encode`, `digest` ports: wrong type, over 10 MB, unreadable, unsafe SVG, still over 5 MB after compression each return a typed refusal with the file name and reason; a large raster is scaled and re-encoded; a small one is stored unchanged; AVIF input re-encodes to WebP when scaled and stays as is otherwise; GIF is stored unchanged with `animated` noted; identical inputs give identical ids; metadata has natural width and height. Implement `apps/app/src/images/ingest.ts` (pure pipeline over ports) and the typed `IngestResult`.
- [x] T026 Add feature detection to `apps/app/src/lib/features.ts` (`supportsCreateImageBitmap`, `supportsOffscreenCanvas`, `supportsCryptoSubtle`, `supportsAvifDecode` via a tiny probe) with tests in `features.test.ts`.
- [x] T027 Implement the worker and client: `apps/app/src/images/image-worker.ts` (decode with `createImageBitmap`, scale and encode with `OffscreenCanvas`, SHA-256 with `crypto.subtle`), `apps/app/src/images/image-client.ts` (same `{id, request}` protocol and lifecycle as `db/import/import-client.ts`, injectable `makeWorker`, inline main-thread canvas fallback). Test the client with a fake worker in `image-client.test.ts` (success, worker error rejects pending, cancel drops late replies, fallback path).

**Checkpoint**: `pnpm test` green for schema, model and the new app modules; `pnpm typecheck` green.

---

## Phase 3: User Story 1 - Paste an image onto the canvas (P1)

**Goal**: ⌘/Ctrl+V adds a picture as an image object; it survives reload; undo works.

**Independent Test**: copy a screenshot, paste on the canvas: one image appears selected, reload keeps it, ⌘Z removes it and ⌘⇧Z restores it with its picture.

- [ ] T028 [P] [US1] Write `apps/app/src/images/use-picture-url.test.tsx` first: returns `loading` then `ready` with an object URL for a stored blob; retries once after 1 s and on window focus when the row is missing, then `missing`; revokes the URL on unmount; shares one URL per `[deckId+id]`. Implement `apps/app/src/images/use-picture-url.ts`.
- [ ] T029 [P] [US1] Write `apps/app/src/images/add-images.test.ts` first: files go through `ingest`, valid ones are written to the blob store **before** the model add, all accepted files are added in one undo step at the given point or the visible centre, refused files produce the message list from contracts/ui.md, a blob write failure (quota) adds nothing and reports it, no partial state. Implement `apps/app/src/images/add-images.ts` and the error / success toast state in `apps/app/src/state/ui-store.ts` (also `Selection.images`, `EMPTY_SELECTION`, pruning on delete).
- [ ] T030 [US1] Write `apps/app/src/editor/images/image-node.test.tsx` first (roles and labels): shows the picture with the alt text as its accessible name; falls back to "Image: <file name>"; shows the "Picture missing" placeholder with file name and caption; shows a lock glyph when locked. Implement `apps/app/src/editor/images/image-node.tsx` (picture, placeholder, caption, handles container) and register it: `IMAGE_NODE_PREFIX`, `toImageNodes` with a per-object cache in `apps/app/src/editor/deck-to-flow.ts`, `nodeTypes` in `canvas.tsx`, deletable set, minimap colour in `minimap-colors.ts`.
- [ ] T031 [US1] Render images in the shared stacking order: React Flow `zIndex` from `stackOrder` (negative for an image below every card so connectors cross over it) in `apps/app/src/editor/deck-to-flow.ts`; test in `deck-to-flow.test.ts`: image above a card, image below every card, card added after an image, a deck without images unchanged (same node objects, same order).
- [ ] T032 [US1] Write tests first in `apps/app/src/editor/editing/use-clipboard-events.test.tsx`: paste with an image file on the canvas calls `addImages` at the pointer or centre; ignored when the target is a text field, dialog or overlay; image wins when text is also present; text-only and fragment paste unchanged; view-only and flow modes refuse; a non-image file on the clipboard is ignored. Implement in `apps/app/src/editor/editing/use-clipboard-events.ts` (and `editing/clipboard-ops.ts`).
- [ ] T033 [US1] Selection and basics for images: delete and arrow-move in `use-canvas-shortcuts.ts`, selection and drag-end in `use-canvas-handlers.ts`, `lock.ts`, `describe-removal.ts`, `confirm-delete-dialog.tsx`; component test that ⌘Z after a paste removes the image and ⌘⇧Z brings it back showing its picture.

**Checkpoint**: US1 works end to end in `pnpm dev` (manual quickstart step 2).

---

## Phase 4: User Story 2 - Upload from a file or drop (P1)

**Goal**: Add flyout Image tile and canvas drop add one or many images as one undo step.

**Independent Test**: pick two PNGs: two objects in a row, both selected, one ⌘Z removes both; a `.txt` produces a refusal.

- [ ] T034 [P] [US2] Write `apps/app/src/editor/palette.test.tsx` cases first: an Image tile is present, keyboard reachable with the name "Image", activating it opens a file input with `multiple` and `accept` listing the six types; disabled with a reason in view-only and flow modes. Implement the tile and hidden `<input type="file">` in `apps/app/src/editor/palette.tsx` (pattern of `shell/deck-menu.tsx:95`).
- [ ] T035 [P] [US2] Write `apps/app/src/images/layout-row.test.ts` first and implement `layout-row.ts`: N images placed in a row with a 16 px gap from the insertion point, wrapping at the visible width, never overlapping; use it in `add-images.ts`.
- [ ] T036 [US2] Write tests first in `apps/app/src/editor/use-canvas-handlers.test.tsx` and implement canvas drop of files: `onDragOver` accepts `Files` next to the existing custom MIME types, `onDrop` calls `addImages` at the drop point under the same view-only guard; locked or read-only area shows the usual hint and adds nothing; the library page file drop is unaffected.
- [ ] T037 [US2] Mixed batches: valid files are added, each refused file is listed with its reason; the toast list is announced politely (`role="status"`); test in `add-images.test.ts` and a component test for the toast.

**Checkpoint**: quickstart steps 3 to 5 pass manually.

---

## Phase 5: User Story 4 - Save, reload and share with images (P1)

**Goal**: images survive reload, file export and import, damaged files and several tabs.

**Independent Test**: add images, export, import into a fresh profile: every image returns with the same position, size and picture, byte-identical.

- [ ] T038 [US4] Wire open-time work in the deck load path (`apps/app/src/storage/deck-persistence.ts` and its caller): after the document loads, run `sweepBlobs` with the ids referenced by `images`; show nothing if there are none. Test: reload keeps referenced blobs and removes orphans.
- [ ] T039 [P] [US4] Write `apps/app/src/library/use-import-files.test.ts` cases first: a file with `assets` imports and shows its images; a file with one missing or hash-mismatched asset opens with a "Picture missing" placeholder and one notice; an over-5 MB or disallowed-type asset is treated as missing; a pre-055 file opens unchanged and re-exports without `images` / `assets`; importing the same file twice stores no duplicate blob rows. Map new import messages in `use-import-files.ts`.
- [ ] T040 [P] [US4] Update `apps/app/src/editor/export/json-export.ts` and `deck-menu.tsx` export so the JSON file embeds assets ("without notes" keeps pictures); test byte-identical re-export and that a deck with 20 MB of pictures keeps the JSON panel free of picture data.
- [ ] T041 [US4] JSON panel and viewer: `json-viewer.tsx` / `json-panel-view.ts` show image records and `meta.assets` entries without `data`; test that no base64 appears and the panel stays responsive (a few hundred bytes per image).
- [ ] T042 [US4] Multi-tab: with two decks views on one deck in tests (fake channel), an image added in tab A appears in tab B because the blob is written before the Yjs add; if the row is late the placeholder resolves after the retry. Test in `use-picture-url.test.tsx`.
- [ ] T043 [US4] Quota and soft limit: a quota error on write reports "Could not save the picture" and adds nothing; a deck whose pictures exceed 100 MB shows the one-per-session warning; tests with a stubbed blob store.

**Checkpoint**: quickstart steps 8 and 12 pass; `pnpm test` green.

---

## Phase 6: User Story 3 - Work with an image like any other item (P2)

**Goal**: resize, connect, lock, group, restack, describe.

**Independent Test**: resize by a corner (ratio holds), connect to a card, put it in a group and move / collapse / lock the group, Bring forward over a card.

- [ ] T044 [P] [US3] Write `apps/app/src/editor/editing/image-resize.test.ts` first and implement `image-resize.ts` (corner handles, aspect ratio kept, modifier for free resize, 32 px minimum, one undo step per gesture); use it in `image-node.tsx` (pattern of `editing/sticky-resize.ts`).
- [ ] T045 [US3] Connector ends: write tests first in `routing/endpoint-target.test.ts` and `connection-rules.test.ts`; implement `kind: 'image'` in `routing/endpoint-target.ts`, `connection-rules.ts`, `visible-graph.ts` (image representative, hidden image hides its edges, collapsed group edge routing), `use-canvas-handlers.ts` (`image:` flow ids), `focus-set.ts`, `view-filter.ts`.
- [ ] T046 [P] [US3] Group membership in the app: dragging an image into or out of a group sets `group` (`editing/` drag-end), group move / collapse / lock include images; tests in `deck-to-flow.test.ts` and `editing/*.test.ts` (3a of the spec).
- [ ] T047 [P] [US3] Write `apps/app/src/editor/actions/arrange-actions.test.ts` cases first and update `arrange-actions.ts`, `arrange-order.ts` so Bring forward, Send backward, To front, To back act on cards and images over the shared stack order; shortcuts unchanged; disabled for locked items; one undo step.
- [ ] T048 [P] [US3] Image toolbar and inspector: `apps/app/src/editor/images/image-toolbar.tsx` (alt text, caption, bring / send, lock, delete), `inspector/image-inspector.tsx` (alt, caption, read-only file name, type, stored size, pixel size), `inspector.tsx` dispatch, `quick-edit/toolbar-variant.ts`; component tests by role and label; no "Replace picture".
- [ ] T049 [P] [US3] Outline, search results and delete confirmation: `outline.ts`, `notes-outline.tsx` (or a new images list), `command-palette/palette-results.ts`, `open-result.ts`, `describe-removal.ts`; tests that an image is listed, found by alt and caption, and that deleting names its connectors.
- [ ] T050 [US3] Copy / paste of images inside a deck in `editing/clipboard-ops.ts` using the fragment from T017; test: copies share the same blob, are placed on top, keep group relations.
- [ ] T051 [US3] Accessibility pass for the image node and toolbar: keyboard-only move, resize with arrow keys + modifier, focus ring, announced lock and missing states (role / label tests).

**Checkpoint**: quickstart steps 6 and 7 pass manually.

---

## Phase 7: User Story 5 - Images in exports (P2)

**Goal**: PNG and SVG exports draw images in place and in the same order as the canvas.

**Independent Test**: export a deck with two images to PNG and SVG; both show them in order; the SVG alone still shows them.

- [ ] T052 [P] [US5] Write `apps/app/src/editor/export/scene.test.ts` cases first and implement `SceneImage` in `scene.ts`: box, picture id, alt, placeholder flag; one ordered list of cards and images from `stackOrder`; images join the connector end rects; selection and view exports include only images in scope; a deck without images produces the same scene as before.
- [ ] T053 [US5] Write `render-svg.test.ts` cases first and implement image drawing in `render-svg.ts`: `<image href="data:…">` with `preserveAspectRatio`, drawn in stack order (groups, collapsed, edges, ports, then cards and images interleaved, stickies last) with the image-below-every-card case drawn before the edges; missing picture draws the placeholder; no external reference in the output; a deck without images renders byte-identical to before (snapshot).
- [ ] T054 [US5] Make `use-export-result.ts` and `rasterize.ts` async-safe: read referenced blobs from the store, inline as base64 `data:` URIs, then rasterise (only `data:` sub-resources load when an SVG is drawn as an `<img>`); tests with a stubbed store, including a missing blob; `export-dialog.test.tsx` shows a busy state while pictures load.
- [ ] T055 [P] [US5] Extend `scene.perf.test.ts` and `apps/app/bench/*` (`bench/generate-deck.ts` gains `images: n` with tiny synthetic PNGs): the 250 ms jsdom ceiling stays, add a 50-image case; record real numbers in Phase 8.

**Checkpoint**: quickstart steps 9 and 10 pass.

---

## Phase 8: Polish and cross-cutting

- [ ] T056 [P] Update `DESIGN.md` (Image object, missing placeholder, Add tile, toast list), `apps/app/CLAUDE.md`, `packages/model/CLAUDE.md`, `packages/schema/CLAUDE.md` (boundaries and APIs: byte map, `images`, stacking), and `README` only if commands changed.
- [ ] T057 [P] Finalise `docs/decisions/0037-image-support.md` (status Accepted once the founder approved the principle I deviation) and mark 055 implemented in `docs/backlog.md`.
- [ ] T058 Run `pnpm bench` after the change and save `specs/055-image-support/bench-after.md`; compare with `bench-before.md`: decks without images must show no regression; record a 50-image pan / zoom check. Report both sets of numbers.
- [ ] T059 Run the full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; confirm the no-third-party-requests check passes (DevTools shows no request for pictures); fix anything that fails; no skipped or `.only` tests.
- [ ] T060 Run the quickstart end to end, record results in `specs/055-image-support/quickstart-results.md`, take screenshots into `specs/055-image-support/screenshots/` (paste, missing placeholder, stacking, export), and mark what was not verified.
- [ ] T061 Final report: what changed, what was skipped (cross-deck paste bytes TODO(M5), clipboard-menu image paste TODO(M5), crop and flip are 057), what is uncertain (compression quality and caps, AVIF decode support per browser), versions and decisions made, and a proposal for the next step. Stop; do not start 056 or 057.

---

## Dependencies and order

- Phase 1 → Phase 2 → stories. Phase 2 blocks everything.
- Inside Phase 2: T003 → T004 → T005 (format); T006 → T007 → T008 → T009 (images, assets); T010 → T011 (stacking, needs T007); T012 → T013 (needs T007); T014 → T015 (needs T013); T016, T017 after T007; T018 → T019 → T020 → T021 (needs T009); T022 to T025 independent pure modules, T025 after T022 to T024; T026 → T027 (needs T025).
- US1 needs Phase 2. US2 needs US1 (T029, T030). US4 needs US1 and T021. US3 needs US1 and T011, T013, T015. US5 needs US1 and T011.
- US1 + US2 + US4 are the MVP (P1). US3 and US5 are independent of each other.

## Parallel examples

- Phase 2 pure modules: T022, T023, T024 together; then T025.
- After T009: T010, T012 and T018 in parallel (different packages and files).
- US3: T044, T046, T047, T048, T049 are in different files and can run together once T045 is merged.

## Implementation strategy

1. MVP: Phases 1 to 5 (paste, upload, save / reload / file). Stop and validate with quickstart steps 1 to 5, 8, 12.
2. Then US3 (stacking and editing), then US5 (export).
3. Commit small and conventional after each task group (`feat(schema): …`, `feat(model): …`, `feat(app): …`, `test: …`); no AI attribution lines in commit messages (AGENTS.md).
