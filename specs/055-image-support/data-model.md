# Data model: Image support (055)

## Document (Yjs, converted by `packages/model` only)

### Image (new collection `images`, ordered like other collections by `$order`)

| Field      | Type               | Notes                                                                        |
| ---------- | ------------------ | ---------------------------------------------------------------------------- |
| `id`       | string, `img_…`    | Stable, generated; never from the file name.                                 |
| `asset`    | string (64 hex)    | Picture id = SHA-256 of the stored bytes. Resolves in `meta.assets`.         |
| `position` | `{x, y}`           | Canvas coordinates; relative to the group when `group` is set, as for cards. |
| `size`     | `{w, h}`           | On-canvas size; minimum 32 px; aspect ratio kept by default.                 |
| `z`        | number             | Stacking rank shared with cards (research R2).                               |
| `group`    | group id, optional | Membership (research R3).                                                    |
| `alt`      | string, optional   | Accessible name; plain text.                                                 |
| `caption`  | string, optional   | Plain text shown under the picture when set.                                 |
| `locked`   | `true`, optional   | Same flag as other lockable items.                                           |

Key order is fixed (appended in the order above) so round-trip is byte-stable (ADR 0020 style).

### Node (existing) gains

`z`: number, optional. Absent means "rank = index in `nodes`". Written by arrange actions and by
add-card only when the deck holds images.

### AssetMeta (new, `meta.assets`, map keyed by picture id)

| Field             | Type                                                                                          | Notes                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `type`            | `image/png` \| `image/jpeg` \| `image/webp` \| `image/gif` \| `image/svg+xml` \| `image/avif` | Detected from content.                                      |
| `bytes`           | integer ≤ 5 242 880                                                                           | Stored size.                                                |
| `width`, `height` | integer ≥ 1                                                                                   | Natural pixel size (SVG: viewBox/size or 300×150 fallback). |
| `name`            | string                                                                                        | Original file name, display only.                           |

Lazy like other `meta` keys: a deck with no images has no `meta.assets` and no `images` rows.

## Outside the document

### Blob store (Dexie `blobs`, library DB version 3)

`{ deckId, id, blob: Blob }`, primary key `[deckId+id]`. Immutable: a row is written once (or ignored
when present) and removed only by the open-time sweep or deck purge.

### UI-only (Zustand / hooks)

Selection gains `images: string[]`; object-URL cache keyed by `[deckId+id]`; add-error list; a
"saving pictures" flag. None of it is document data.

## File (`.sododeck.json`) additions

- Root `images`: array of Image, optional.
- Root `assets`: object, key = picture id, value = AssetMeta + `data` (base64, no data-URL prefix). Optional;
  required to contain every id used by `images` (rule I1).
- `Node.z` optional.

## Relationships and rules

- `Image.asset` → `assets[id]` (file) / `meta.assets[id]` (doc) + blob row (store).
- `Image.group` → `Group.id`. Deleting the group removes or ungroups its members as cards do.
- Edge `from`/`to` may name an image id (like a sticky, ADR 0036); id clash order: node, group, sticky, image.
- Deleting an image removes its connectors (cascade), leaves `meta.assets` entry in place until the
  open-time sweep removes unreferenced assets and blobs.
- Integrity: image with missing asset meta → problem "picture missing" (not a load error); missing
  blob row → placeholder, no document change.

## State transitions (picture availability, per image on screen)

`loading` → `ready` | `missing` (no row after one retry) | `error` (cannot decode).
`missing` → `ready` when the row appears (another tab, catch-up).
