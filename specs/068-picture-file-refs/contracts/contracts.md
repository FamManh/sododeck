# Contracts: 068 pictures that point at a file

## 1. File format (public, `https://sododeck.com/schema/v1.json`)

A picture entry with a path:

```json
"assets": {
  "3f9c…64 hex…": {
    "type": "image/png",
    "bytes": 48213,
    "width": 1280,
    "height": 720,
    "name": "login.png",
    "path": "assets/login.png"
  }
}
```

- An entry has exactly one of `data` (base64) and `path` (rule I8, `image-asset-source`).
- `path` follows rule I9 (`image-asset-path`): relative to the deck file's folder, `/` separators, non-empty, at most 1,024 characters. It must not contain `\`, a leading `/`, any `:`, an empty or `.` segment, a `..` after a folder name, or control characters. Leading `..` segments are allowed.
- Hosts that read the file MUST resolve it against the deck's folder and refuse a result outside their workspace or vault (FR-014).
- No version bump. A build without this feature refuses such a file.

## 2. `@sododeck/schema` additions

```ts
export type PathViolation =
  | 'empty'
  | 'too-long'
  | 'backslash'
  | 'absolute'
  | 'colon'
  | 'empty-segment'
  | 'dot-segment'
  | 'inner-parent'
  | 'no-file-name'
  | 'control-char';

/** The first rule `path` breaks, or null when it is a valid picture path (068 R2). Pure. */
export function checkPicturePath(path: string): PathViolation | null;

/** A sentence for each violation, used by I9's message and the skill helper. */
export const PATH_VIOLATION_TEXT: Record<PathViolation, string>;
```

New `FORMAT_RULE_CODES`: `image-asset-source` (I8) and `image-asset-path` (I9).

## 3. `@sododeck/model` additions and changes

```ts
export interface PictureFileRef { id: AssetId; name: string; path: string }

// LoadedDeck gains:
fileRefs: PictureFileRef[];          // sorted by id

/** Type sniffed from content (moved from the app), natural size from the header. */
export function sniffType(bytes: Uint8Array): AssetType | null;
export function pictureSize(bytes: Uint8Array, type: AssetType): { width: number; height: number } | null;

/** A complete pointed-at entry, or the reason it cannot be made. Pure, worker- and Node-safe. */
export function pictureFileEntry(
  bytes: Uint8Array, name: string, path: string,
): { ok: true; id: AssetId; entry: Asset } | { ok: false; reason: 'bad-type' | 'too-large' | 'no-size' | PathViolation };
```

Changed behaviour:

- `metaOf` keeps `path`.
- `readAssets` emits `path` and no `data` for a pointed-at picture.
- `attachAssets` / `serializeDeck` never write `data` for a picture whose meta has `path`.
- `inspectDeckText` adds one `picture-file-ref` warning entry per pointed-at picture.
- Every existing output for decks without `path` is byte-identical.

## 4. Skill CLI: `picture`

```text
node picture.mjs <image-file> --deck <deck-file>
```

- Output (stdout, JSON): `{ "<id>": { "type", "bytes", "width", "height", "name", "path" } }`. `path` is relative from the deck file's folder.
- Exit codes:
  - `0`: entry printed.
  - `1`: refused. One line on stderr: the type is not allowed, over 5 MiB, the size cannot be read, or the path breaks a rule (with `PATH_VIOLATION_TEXT`). Nothing is printed on stdout.
  - `2`: usage error.
- Reads only the two named paths (the deck file need not exist yet: only its folder is used). No network. Does not edit the deck.
- `SKILL.md` / a reference gains a short "Pictures" section: run `picture`, paste the entry under `assets`, add an image whose `asset` is the id.

## 5. Web app UI

| Where                           | Shows                                                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image on canvas (missing state) | `ImageOff` icon, "Picture missing", then "Saved as a separate file" and the path (one line, truncated). Full path in the accessible name ("Picture missing, saved as a separate file: assets/login.png"). |
| Image inspector                 | A read-only row "Picture file" with the path, and the help text "This app can't read files next to the deck. Open the deck in an editor that keeps it in its folder, or replace the picture."             |
| Import problem list             | Warning `picture-file-ref`: `Picture "login.png" is saved as a separate file (assets/login.png) and cannot be shown here.`                                                                                |

No request, file prompt or store lookup is made for a pointed-at picture.
