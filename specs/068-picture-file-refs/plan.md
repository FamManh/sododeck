# Implementation Plan: Pictures that point at a file next to the deck

**Branch**: `068-picture-file-refs` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/068-picture-file-refs/spec.md`

## Summary

Let a picture entry carry either embedded `data` or a relative `path`.

1. **Schema**: `data` becomes optional and `path` is added. The two new format rules are I8 (exactly one of `data` / `path`) and I9 (path rules: relative, `/` only, no `:`, leading `..` only). The path checker is a shared pure function in `@sododeck/schema`.
2. **Model**: `metaOf`, `readAssets`, `attachAssets` and `repairAssets` carry `path` and never turn a reference into embedded data. `LoadedDeck.fileRefs` lists pointed-at pictures, and `inspectDeckText` reports each one as a `picture-file-ref` warning.
3. **Web app**: an image whose picture is pointed at shows as missing with "Saved as a separate file" and the path, and the inspector shows a "Picture file" row. Nothing is read or fetched.
4. **Skill**: a new offline `picture` command prints a complete entry for an image file. Content sniffing and header size reading move into the model so the app and the skill share them.

An ADR records the format change. Details: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: Zod / Ajv via `@sododeck/schema` generators, Yjs via `@sododeck/model`, React + `lucide-react` in the app, esbuild for the skill bundle. No new dependency.

**Storage**: `.sododeck` files (format v1, additive change); Yjs `meta.assets` facts gain `path`. The blob store is unchanged.

**Testing**: Vitest in `schema` (Ajv/Zod parity, fixtures, coverage), `model` (round trip, attach/read, picture facts), `skill` (CLI, parity) and `app` (Testing Library for the image node, inspector and import list). No new e2e (the existing smoke suite and its no-third-party check must stay green).

**Target Platform**: Browser (web app), Node (skill scripts, tests).

**Project Type**: pnpm/turbo monorepo: `packages/schema`, `packages/model`, `packages/skill`, `apps/app`.

**Performance Goals**: No runtime cost for decks without `path`. The skill helper reads at most a 5 MiB file and parses the header in O(header).

**Constraints**: No network and no file access for pointed-at pictures in the web app. The generators mishandle `oneOf`, so rules go in `semantic-rules.ts`. Files without `path` stay byte-identical.

**Scale/Scope**: About 4 schema files, 6 model files, 4 app files, 3 skill files plus content, fixtures, an ADR and 3 `CLAUDE.md` updates. 5 user stories.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                    | Status | Notes                                                                                                                                                                                                                          |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Single source of truth                    | ✅     | `path` is a picture fact in `meta.assets` (Yjs). The image node reads it from the deck snapshot; there is no copy.                                                                                                             |
| II. Schema-owned format, lossless round-trip | ✅     | v1.json is edited and the generated code regenerated. Ajv/Zod parity and coverage are extended. Model round-trip cases for pointed-at, mixed and pasted pictures. Additive, no version bump (same as 055), recorded in an ADR. |
| III. Stable identity                         | ✅     | The picture id rule (SHA-256 of the bytes) is unchanged. `path` is never an id.                                                                                                                                                |
| IV. Local-first, private                     | ✅     | The web app never reads or fetches a pointed-at file (FR-012; the store lookup is skipped). The skill helper reads only the named files, offline. Hosts must keep reads inside their workspace or vault (FR-014, ADR).         |
| V. Performance off main thread               | ✅     | No heavy work. Header parsing is tiny and runs in the skill (Node) only.                                                                                                                                                       |
| VI. Strict types, tested behavior            | ✅     | Unit tests for `checkPicturePath`, the I8/I9 rules, picture facts, attach/read and the CLI. Component tests by role and label. No new e2e.                                                                                     |
| VII. Accessible by default                   | ✅     | The missing state's accessible name includes the reason and path. The inspector row is labelled text. No colour-only state.                                                                                                    |
| VIII. Simplicity, justified deps             | ✅     | No dependency. `sniffType` moves into the model so the app and the skill share it instead of duplicating it. ADR for the format change.                                                                                        |

**Post-design re-check**: ✅ unchanged after data-model and contracts. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/068-picture-file-refs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/contracts.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                 # Asset: data optional, + path
├── src/picture-path.ts            # new: checkPicturePath, PathViolation, PATH_VIOLATION_TEXT
├── src/semantic-rules.ts          # + I8, I9
├── src/issue-codes.ts             # + image-asset-source, image-asset-path
├── src/index.ts                   # exports
├── src/generated/                 # regenerated
├── examples/full.sododeck.json    # + one pointed-at picture (coverage)
└── test/fixtures.ts               # invalid + valid path fixtures

packages/model/
├── src/assets.ts                  # metaOf keeps path; attachAssets/repairAssets; PictureFileRef
├── src/read.ts                    # readAssets emits path, no data
├── src/deck.ts                    # LoadedDeck.fileRefs
├── src/import-check.ts            # picture-file-ref warnings
├── src/problem-entry.ts           # fileRefEntry
├── src/problem-codes.ts           # catalogue: image-asset-source, image-asset-path, picture-file-ref
├── src/picture-facts.ts           # new: sniffType (moved), pictureSize, pictureFileEntry
├── src/index.ts                   # exports
└── test/                          # assets, round-trip, import-check, picture-facts (+ tiny image fixtures)

apps/app/src/
├── images/sniff-type.ts           # removed; imports from @sododeck/model (tests moved)
├── editor/deck-to-flow.ts         # ImageNodeData.filePath
├── editor/images/image-node.tsx   # missing state reason + accessible name; skip store lookup
├── images/use-picture-url.ts      # no lookup when filePath is set
└── editor/inspector/image-inspector.tsx   # "Picture file" row

packages/skill/
├── src/cli/main.ts                # + picture command
├── scripts/build.ts               # + picture.mjs entry
├── content/ (SKILL.md / references/pictures.md)   # how to use it
└── test/                          # CLI + parity on 068 fixtures

docs/decisions/00NN-picture-file-refs.md   # ADR (next free number)
docs/backlog-3.md                          # 069/070 entries: host containment rule (FR-014)
```

**Structure Decision**: The change follows the dependency direction `app → model → schema` and `skill → model → schema`. The path rule lives in schema (lowest layer) so the format rule, the model and the skill share it. Header parsing and type sniffing live in the model (pure), so the skill does not re-implement checks (`packages/skill/CLAUDE.md`).

## Risks

- **066 lands first**: its `PreparedDeck` and apply corpus must carry `fileRefs` and a pointed-at case. This is a small follow-up task here, or a note for whoever rebases second.
- **Header parsing edge cases** (JPEG with EXIF before SOF, WebP VP8X, AVIF box nesting): covered by small fixture files per type. The helper refuses rather than guesses (`no-size`).
- **Older builds refuse new files**: accepted (the web app is always the latest build) and documented in the ADR.

## Complexity Tracking

No violations.
