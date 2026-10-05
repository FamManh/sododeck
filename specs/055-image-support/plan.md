# Implementation Plan: Image support

**Branch**: `055-image-support` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/055-image-support/spec.md`

## Summary

Add an **image** canvas object. The deck keeps a small record per image (id, picture id, position,
size, group, stacking rank, alt text, caption, lock) and a small record per picture (type, bytes,
pixel size, file name). The picture bytes live in a new `blobs` table of the existing Dexie library
database, keyed by deck and content hash, never in the Yjs document. The `.sododeck.json` file gains
an optional root `images` array and an optional root `assets` map that embeds the bytes (base64), so
a deck stays one file. Pictures are validated, compressed and hashed in a Web Worker on import; SVG is
sanitised with an allow-list; export inlines pictures as `data:` URIs.

Two parts are **new mechanisms, not copies of stickies** (code review, research R1): a stacking order
shared by cards and images, and group membership for images. Both are additive.

## Technical Context

**Language/Version**: TypeScript strict (`noUncheckedIndexedAccess`), Node ≥ 24, pnpm monorepo

**Primary Dependencies**: existing only (React 19, `@xyflow/react`, Yjs, Dexie, Zustand, Zod/Ajv). No
new dependency: hashing is `crypto.subtle`, decoding and encoding are `createImageBitmap` +
`OffscreenCanvas`, SVG sanitising is a small allow-list over `DOMParser` (research R5, R6).

**Storage**: Yjs document (image + picture records) persisted as today; picture bytes in Dexie table
`blobs` (library database version 3); `.sododeck.json` v1 with additive optional `images` and
`assets`.

**Testing**: Vitest (pure functions, model round-trip, schema Ajv/Zod parity, Dexie with
`fake-indexeddb`), Testing Library for components, injected fake worker as in `layout-client.test.ts`.
No new e2e (AGENTS.md); the smoke suite must stay green.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox, Safari.

**Project Type**: monorepo web app (`packages/schema`, `packages/model`, `apps/app`, `packages/ui`).

**Performance Goals**: no regression at 500 nodes / 1,000 edges with no images; a deck with 50 images
pans and zooms at 60 fps (images decoded once, drawn from object URLs); a 5 MB import completes
(decode, compress, hash, store) in under 1.5 s off the main thread. `pnpm bench` before and after.

**Constraints**: no network with content, no new CDN; tokens only; keyboard access; every browser API
feature-detected in `apps/app/src/lib/features.ts`.

**Scale/Scope**: tens of images per deck, up to a few hundred; 100 MB of pictures per deck is the
soft-warning level.

## Constitution Check

_GATE: passed before Phase 0, re-checked after Phase 1._

| Principle                                    | Result                                                                                                                                                                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | **Deviation, justified** (see Complexity Tracking). Every record that describes the canvas is in Yjs. Only immutable, content-addressed picture bytes sit outside it. Zustand holds object URLs / decode state (UI-only).                    |
| II. Schema-owned format, lossless round-trip | Pass. Additive optional root keys, generated types and Zod regenerated, Ajv/Zod parity, round-trip incl. bytes. No version bump. All Yjs ↔ JSON stays in `packages/model`; bytes pass through a model API that takes and returns a byte map. |
| III. Stable identity                         | Pass. Image ids are generated; a picture id is the content hash, so it never depends on a title or file name; renames and moves never change either.                                                                                         |
| IV. Local-first, private                     | Pass. No network; pictures shown from `blob:`/`data:` only; SVG with outside references refused. Smoke check unchanged. Browser APIs feature-detected.                                                                                       |
| V. Performance off the main thread           | Pass. Decode, scale, encode and hash run in a worker (inline fallback only where workers are missing). Bench before and after.                                                                                                               |
| VI. Strict types and tested                  | Pass. Pure functions (`fitWithin`, `sniffType`, `sanitizeSvg`, `restack`, `assetId`) unit-tested; Dexie ops with `fake-indexeddb`; components by role and label.                                                                             |
| VII. Accessible                              | Pass. Alt text is the accessible name; Add entry, toolbar, error toasts keyboard-operable and announced; missing picture is shown by icon and text, not colour.                                                                              |
| VIII. Simplicity, dependencies               | Pass. No dependency. One ADR (0037). Not built: cropping/flip (057), images in cards, animated GIF, cross-deck picture sharing.                                                                                                              |

## Complexity Tracking

| Deviation                                                                   | Why needed                                                                                                                                                       | Simpler alternative rejected because                                                                                                                                                                          |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Picture bytes live outside the Yjs document (principle I, "no duplication") | Up to 5 MB per picture in a document that is replicated, diffed, undone and shown in the JSON panel would make every update, tab sync and snapshot slow or huge. | Base64 inside Yjs: breaks the 500 ms autosave and 100 ms flush targets, inflates update logs, and floods the JSON panel. The blob is immutable and addressed by hash, so it cannot diverge from the document. |
| A shared stacking rank for cards and images (new mechanism)                 | Founder asked for whiteboard-style interleaving.                                                                                                                 | Fixed layer for images: simpler but contradicts the founder's requirement (research R2).                                                                                                                      |

**Needs founder approval** before implementation: the principle I deviation above (constitution
requires written approval for deviations).

## Project Structure

### Documentation (this feature)

```text
specs/055-image-support/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── file-format.md   # root images + assets, semantic rules, limits
│   └── ui.md            # Add flyout, paste/drop, toolbar, inspector, errors, export
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                  # root images[] + assets{}; Image, AssetMeta/Asset defs; Node.z
├── src/generated/{types,zod}.ts    # pnpm schema:generate
├── src/semantic-rules.ts           # I1-I6: asset resolves, id clash, group ref, limits, type allow-list
├── examples/full.sododeck.json     # uses every new field (coverage test)
├── test/fixtures.ts                # valid + invalid fixtures
└── CLAUDE.md

packages/model/
├── src/layout.ts, deck.ts, read.ts, write.ts, key-order.ts, validate.ts  # `images` collection, meta.assets
├── src/ops/images.ts               # addImage(s), moveImage, setImageSize, setImageText, setImageGroup
├── src/ops/stacking.ts             # restack(): shared rank for nodes + images; bring/send ops
├── src/stack-order.ts              # pure: stackOrder(deck) → ordered ids (nodes + images)
├── src/assets.ts                   # splitAssets / attachAssets, assetId(bytes), AssetMeta helpers
├── src/geometry.ts                 # IMAGE_MIN_SIZE, imageBox, defaultImageSize(natural, viewport)
├── src/group-members.ts            # members include images
├── src/endpoint.ts, ops/refs.ts, integrity.ts, load-checks.ts, ops/cascade.ts  # image as connector end; deletes
├── src/ops/node-lock.ts            # LockCollection gains 'images'; group lock cascades
├── src/fragment.ts, ops/paste.ts   # images in copy/paste within a deck (refs only)
├── src/search/                     # alt, caption, file name
├── src/editor.ts                   # undo roots include `images`
└── test/                           # round-trip with bytes, stacking, group, cascade, integrity, lock

apps/app/src/
├── storage/library-db.ts           # version(3): blobs table [deckId+id]; purge on deck purge
├── storage/blob-store.ts           # put/get/has/listIds/delete, quota error mapping (Dexie)
├── storage/blob-gc.ts              # sweep unreferenced blobs on deck open
├── storage/library-ops.ts          # importFile / exportDeck / duplicate carry assets
├── images/ingest.ts                # pure pipeline: sniff → size check → (sanitise | compress) → hash → AssetMeta
├── images/image-worker.ts + image-client.ts   # decode/scale/encode/hash off main thread; inline fallback
├── images/sniff-type.ts, fit-within.ts, sanitize-svg.ts
├── images/use-picture-url.ts       # blob → object URL cache, revoke on unmount, retry when missing
├── images/add-images.ts            # files → ingest → one undo step; errors → toast list
├── editor/images/image-node.tsx    # canvas node: picture, resize, handles, placeholder, lock glyph
├── editor/images/image-toolbar.tsx, inspector/image-inspector.tsx
├── editor/editing/use-clipboard-events.ts, use-canvas-handlers.ts   # image paste, file drop
├── editor/palette.tsx              # Image tile + hidden file input
├── editor/deck-to-flow.ts, visible-graph.ts, canvas.tsx, routing/*, connection-rules.ts  # image node, ends, zIndex from stack rank
├── editor/actions/arrange-actions.ts, arrange-order.ts   # operate on the shared stacking order
├── editor/export/scene.ts, render-svg.ts, use-export-result.ts, rasterize.ts  # images, async blob inlining
├── lib/features.ts                 # supportsCreateImageBitmap, supportsOffscreenCanvas, supportsCryptoSubtle
├── state/ui-store.ts               # Selection.images; add-error toast state
└── bench/generate-deck.ts          # bench images (synthetic tiny PNGs)
docs/decisions/0037-image-support.md
DESIGN.md                           # Image object, placeholder, Add tile
```

**Structure Decision**: existing layout. Format in `schema`, Yjs ↔ JSON and rules in `model`, storage,
worker, rendering and interaction in `apps/app`. No new package.

## Phase 0 and Phase 1 outputs

- Phase 0: [research.md](research.md), all unknowns resolved.
- Phase 1: [data-model.md](data-model.md), [contracts/file-format.md](contracts/file-format.md),
  [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md), ADR 0037.

## Delivery order (for tasks)

1. **Format and model** (tests first): schema `images` / `assets` / `Node.z`, `AssetMeta` in meta,
   image ops, stacking order, group membership, lock, cascade, integrity, round-trip with bytes.
2. **Storage and ingest**: `blobs` table, blob store, GC, file import/export carrying assets, worker
   pipeline (sniff, size, SVG sanitise, compress, hash), feature detection.
3. **Canvas**: image node, picture URL hook, placeholder, resize, handles and connector ends, stacking
   z-index, group move/collapse.
4. **Input**: Add tile + file picker, paste, drop, multi-add as one undo step, error list.
5. **Arrange and consumers**: shared Bring/Send actions, inspector, toolbar, search, outline,
   delete confirmation.
6. **Export**: scene, SVG data URIs, PNG rasterise, async inlining, tests.
7. **Docs and gate**: DESIGN.md, package `CLAUDE.md`s, backlog status, bench before / after, lint,
   typecheck, test, build, e2e.

Slices 1 to 4 deliver US1, US2, US4; slice 5 delivers US3; slice 6 delivers US5. The stacking change
(slice 1 and 5) can ship first on its own if needed.

## Post-design Constitution Check

Re-checked after Phase 1: unchanged. Watch items: principle I deviation needs the founder's written
approval; bench numbers for decks without images must show no regression after `Node.z` and the
shared stack order land.
