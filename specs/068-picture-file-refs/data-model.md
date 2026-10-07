# Data model: Pictures that point at a file next to the deck (068)

## File format: `assets[id]` (`$defs/Asset`, v1, no version bump)

| Key      | Type                | Required | Change       | Notes                                                     |
| -------- | ------------------- | -------- | ------------ | --------------------------------------------------------- |
| `type`   | `AssetType`         | yes      | —            | png, jpeg, webp, gif, svg+xml, avif                       |
| `bytes`  | integer 1…5,242,880 | yes      | —            | Size of the stored bytes (embedded) or of the file (path) |
| `width`  | integer ≥ 1         | yes      | —            | Natural width                                             |
| `height` | integer ≥ 1         | yes      | —            | Natural height                                            |
| `name`   | string              | yes      | —            | Original file name, display only                          |
| `data`   | base64 string       | **no**   | was required | Embedded bytes. Exactly one of `data` / `path` (I8)       |
| `path`   | string, 1…1,024     | no       | **new**      | Relative to the deck file's folder; rules I9              |

Key order in files: `type, bytes, width, height, name, data, path`. Only one of the last two is ever written.

The **id** (the `assets` key) is unchanged: the lowercase SHA-256 of the bytes. For `path`, this is the hash of the file's bytes as stored on disk.

### Format rules (in `semantic-rules.ts`, codes in `issue-codes.ts`)

| Rule | Code                 | Checks                                                      | Problem path        |
| ---- | -------------------- | ----------------------------------------------------------- | ------------------- |
| I8   | `image-asset-source` | exactly one of `data`, `path`                               | `/assets/<id>`      |
| I9   | `image-asset-path`   | `checkPicturePath(path)` returns no violation (research R2) | `/assets/<id>/path` |

`checkPicturePath(path): PathViolation | null` (`@sododeck/schema`, pure). The violation kinds are `empty`, `too-long`, `backslash`, `absolute`, `colon`, `empty-segment`, `dot-segment`, `inner-parent`, `no-file-name` and `control-char`. Each kind has its own message sentence.

## Document (`meta.assets[id]`, Yjs `Y.Map`)

The facts are the same as today, plus `path` when the picture is pointed at. The document never holds bytes, so for a pointed-at picture nothing else changes.

## Model runtime types

| Type                            | Change                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `AssetMeta`                     | gains `path?` (from the generated `Asset`); `metaOf` copies it                                                            |
| `PictureFileRef` (new)          | `{ id: AssetId; name: string; path: string }`                                                                             |
| `LoadedDeck`                    | gains `fileRefs: PictureFileRef[]` (sorted by id)                                                                         |
| `PreparedDeck` (066, if merged) | gains `fileRefs` the same way                                                                                             |
| `ProblemEntry` code (new)       | `picture-file-ref`, severity `warning`, path `/assets/<id>/path`                                                          |
| Catalogue (new entries)         | `image-asset-source`, `image-asset-path`, `picture-file-ref`                                                              |
| Picture facts (new, pure)       | `sniffType(bytes)` (moved from the app), `pictureSize(bytes, type)`, `pictureFileEntry(bytes, name, path)` (contracts §3) |

## Write rules (`attachAssets`, `readAssets`)

| Stored meta has | Bytes in map | Written entry                                        |
| --------------- | ------------ | ---------------------------------------------------- |
| `path`          | any          | facts + `path` (never `data`)                        |
| no `path`       | yes          | facts + `data` (base64), `bytes` = length (today)    |
| no `path`       | no           | facts + `data` as carried, or `MISSING_DATA` (today) |

`readAssets` (the document → file shape) gives facts + `path` for a pointed-at picture, and facts + `data: ''` otherwise (today).

## Web app image node data (`deck-to-flow.ts`)

`ImageNodeData` gains `filePath?: string` (from the asset facts). When it is set, the image is always `missing` and the picture store is not asked for it.

## States of a pointed-at picture

```text
file with path ──load──▶ meta.assets[id] = facts + path ; fileRefs += {id,name,path} ; warning entry
   web app:   shown missing ("Saved as a separate file" + path); never read, never fetched
   export / save / copy / paste ──▶ facts + path unchanged (no data)
   last image using it removed ──▶ entry dropped on write (rule I2, unchanged)
   host (069/070): reads <deck folder>/<path> if inside workspace/vault → bytes for display
```
