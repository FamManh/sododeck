# Research: Pictures that point at a file next to the deck (068)

Evidence was read on `main` (`origin/main` at the time of the branch) from:

- `packages/schema/schema/v1.json` (`$defs/Asset`), `packages/schema/CLAUDE.md`, `src/semantic-rules.ts`, `src/issue-codes.ts`
- `packages/model/src/assets.ts`, `deck.ts`, `read.ts`, `fragment.ts`, `problem-entry.ts`, `problem-codes.ts`, `import-check.ts`
- `apps/app/src/editor/images/image-node.tsx`, `apps/app/src/editor/inspector/image-inspector.tsx`, `apps/app/src/editor/deck-to-flow.ts`, `apps/app/src/images/sniff-type.ts`, `ingest.ts`
- `packages/skill/CLAUDE.md`, `packages/skill/src/cli/main.ts`

## R1. Schema shape: `data` optional, `path` optional, "exactly one" as a format rule

- **Decision**: In `$defs/Asset`, remove `data` from `required` and add an optional `path` (string, `minLength: 1`, with a description), declared right after `data` (key order = file order). The "exactly one of `data` / `path`" rule and the path rules become new format rules in `semantic-rules.ts`:
  - **I8** `image-asset-source`: an entry has exactly one of `data` and `path`. The message says which case applies: both, or neither.
  - **I9** `image-asset-path`: the path is well formed. One issue per entry, with the first violated rule named (R2).

  Both get new codes in `FORMAT_RULE_CODES` and catalogue entries (title + fix) in the model's `problem-codes.ts`.

- **Rationale**: `packages/schema/CLAUDE.md` says the generators mishandle `oneOf` / `anyOf` presence rules and strip them, and rules they drop live in `semantic-rules.ts` (precedent: S10 "never both `offset` and `waypoints`", S14 "`default` or `defaultExpr`"). A format rule gives the one clear, coded problem per entry that US1 AS2–AS4 ask for. A generic `schema-union` would not.
- **Alternatives rejected**: (a) `oneOf` in v1.json: stripped by the generator, and Ajv users would get a union error instead of a plain message. (b) A path `pattern` in v1.json: one opaque regex message for six different mistakes. A `pattern` that only blocks backslashes and control characters could be added for Monaco hover help, but it is not needed; the rule lives in I9.

## R2. Path rules (FR-003, clarification 1)

- **Decision**: A valid `path`:
  1. is non-empty and at most 1,024 characters;
  2. uses `/` only (no `\`);
  3. does not start with `/` and has no `:` (this blocks drive letters `C:`, schemes `http:` / `file:` / `data:`, and Windows streams);
  4. splits on `/` into segments, none of which is empty (no `//`, no trailing `/`) or `.`;
  5. has `..` segments only as a leading run (`../../Attachments/x.png` is valid, `assets/../x.png` is not);
  6. has a last segment (the file name) that is not `..`;
  7. has no control characters (U+0000–U+001F, U+007F).

  Letters outside ASCII and spaces are kept as written (spec edge cases).

- **Rationale**: The rules cover every case in US1 AS4 and clarification 1. Leading-only `..` keeps a canonical form, so two spellings of the same place cannot exist, and lets a host check containment with one normalisation. Banning `:` everywhere is stricter than strictly needed, but it is simple and closes every scheme and drive-letter form at once.
- **Host rule (FR-014)**: recorded in the ADR and in the 069/070 backlog entries. Resolve against the deck's folder and refuse if the result is outside the workspace or vault. The format cannot check this.

## R3. Model: carrying `path` through document, read, write and clipboard (FR-009, FR-011)

- **Decision**:
  - `AssetMeta` (`Omit<Asset, 'data'>`) gains `path?` automatically from the generated type. `metaOf` copies `path` when present, so it is stored in `meta.assets[id]` like the other facts.
  - `readAssets` emits `{ ...facts, path }` with **no** `data` for a pointed-at picture, and `{ ...facts, data: '' }` for an embedded one (unchanged).
  - `attachAssets`: a picture whose meta has `path` is written as its facts + `path`, never with `data`, even when the byte map has bytes for it (a host may hold the bytes it read; the file keeps the reference).
  - `repairAssets`: an entry with a valid `path` and no `data` is passed through, its meta recorded, and it is reported in the new `LoadedDeck.fileRefs` (R4), not in `problems`. An entry with both or neither is left for validation (I8) to refuse.
  - `toFragment` / `pasteFragment` already copy `metaOf(stored)` facts, so `path` travels with them once `metaOf` keeps it. Pasting into the same deck reuses the entry (US3 AS2).
  - The 066 apply path (if merged first) merges asset metas key by key, so `path` is kept. A pointed-at case is added to its round-trip corpus.
- **Rationale**: The model is the only place that converts the format. Every app surface (export, save, copy-as-file, clipboard) already goes through `serializeDeck` / `attachAssets` / fragments, so fixing these few functions covers FR-009 everywhere.
- **Today's bug this prevents**: `attachAssets` writes a picture with no bytes and `data: ''` as `MISSING_DATA` (a broken embedded picture). Without R3, a pointed-at picture would be turned into a broken picture on its first export.

## R4. Reporting pointed-at pictures (FR-007, FR-008, clarification 3)

- **Decision**: `LoadedDeck` (and 066's `PreparedDeck`, if merged) gains `fileRefs: PictureFileRef[]` (`{ id, name, path }`, sorted by id). `inspectDeckText` adds one `ProblemEntry` per ref: code `picture-file-ref`, severity `warning`, path `/assets/<id>/path`, message `Picture "<name>" is saved as a separate file (<path>) and cannot be shown here.`, with a catalogue fix: open the deck in an editor that keeps it in its folder, or embed the picture.
- **Rationale**: The founder chose warning (clarification 3), and the 062 error/warning-only rule stays. A separate code from `picture-damaged` keeps "damaged" meaning damaged. The skill's `validate` / `lint` use `inspectDeckText`, so they show the same warning (not an error: US2 AS4).
- **Alternative rejected**: A new `AssetProblemReason` `'separate-file'` inside `problems`. That would mix a deliberate format choice with damage and change the message prefix "is damaged".

## R5. Web app display (FR-007, FR-012)

- **Decision**: `deck-to-flow.ts` already reads `deck.assets[image.asset]` facts for each image. It adds `filePath?: string` to the image node data. `image-node.tsx`'s missing state shows, under "Picture missing", the line `Saved as a separate file` and the path (truncated with the full path in `title` and in the accessible name). `image-inspector.tsx` shows a read-only "Picture file" row with the path and the sentence "This app can't read files next to the deck. Open the deck in an editor that keeps it in its folder, or replace the picture." The picture store lookup is skipped for a pointed-at picture: its bytes are never in the blob store, and there is no fetch.
- **Rationale**: This reuses the existing missing-picture look (DESIGN.md tokens, `ImageOff` icon) and the inspector layout. Skipping the store lookup makes SC-006 (zero requests, zero prompts) structural.
- **Wording**: "Saved as a separate file" / "Picture file". It is plain, has no jargon, and matches the clarified reason text. DESIGN.md has no rule for this message; the missing state's caption style is reused.

## R6. Skill helper: `picture` command (FR-015, clarification 2)

- **Decision**: A new skill CLI command `picture <image-file> --deck <deck-file>` (bundled into `scripts/sododeck.mjs` like the others, plus an entry file `picture.mjs`). It reads the image, checks the type by content and the 5 MiB limit, computes the SHA-256 id, the width and height, the name (base name) and the path (relative from the deck's folder, `/`-separated, validated with the I9 rule), and prints the entry as JSON: `{ "<id>": { type, bytes, width, height, name, path } }`. Exit codes follow the existing CLI (0 ok, 1 refused with a message, 2 usage). It does not edit the deck.
- **Pure parts in the model** (the skill must not re-implement checks):
  - Move `sniffType` from `apps/app/src/images/sniff-type.ts` to `packages/model/src/picture-facts.ts`. The app imports it from `@sododeck/model`; its tests move with it.
  - Add `pictureSize(bytes, type)`: natural size from the file header. PNG uses IHDR; JPEG uses the first SOF marker; GIF uses the logical screen; WebP uses VP8 / VP8L / VP8X; AVIF uses the `ispe` box; SVG uses `width` / `height` in px, else the `viewBox`, else 300 × 150 (the schema's stated SVG rule). It returns `null` when the size cannot be read, and the helper refuses then.
  - The path rule itself (R2) lives in `@sododeck/schema` as an exported pure function `checkPicturePath(path)` (`src/picture-path.ts`). It is used by I9 in `semantic-rules.ts`, and the helper reaches it through the model, so all three share one implementation (schema cannot import model, so it cannot live in the model).
  - Add `pictureEntry(bytes, name, path)`: assembles the entry using `assetId`.
- **Rationale**: Pure, offline, no new dependency. Header parsing is a few dozen lines per format and testable with tiny fixture files. An SVG's id is the hash of the file as stored on disk: hosts hash the file they read, and the app's sanitising applies only to pictures it ingests itself.
- **Not done**: no re-encoding or downscaling of large files (the app does that on ingest). The helper refuses files over the limit instead.

## R7. Compatibility and version

- **Decision**: There is no `version` bump and no schema URL change (additive alternative, same as 055). An older build refuses a file with `path` at validation, with a `schema-required` problem on `data`. The ADR records this. Every existing file is unchanged (`data` still accepted and still written).
- **Fixture work**:
  - `examples/full.sododeck.json` gains one pointed-at picture (coverage test: every field used).
  - Invalid fixtures: both present, neither present, and one per I9 violation.
  - Valid fixtures: leading `..`, sub-folder, spaces and non-Latin letters.
  - Model round-trip cases: pointed-at only, mixed, pasted.

## R8. Tests that already guard the boundaries

- Ajv/Zod parity (`packages/schema/test/schema.test.ts`) runs over the new fixtures (SC-004). The skill's `validate` goes through `inspectDeckText`, so a skill test on the same fixtures closes the three-way parity.
- No-network: the app's e2e no-third-party check is unchanged. The skill test already asserts the bundle has no network modules.
