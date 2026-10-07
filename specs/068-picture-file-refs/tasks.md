# Tasks: Pictures that point at a file next to the deck

**Input**: Design documents from `specs/068-picture-file-refs/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md) (3 clarifications), [research.md](research.md) (R1–R8), [data-model.md](data-model.md), [contracts/contracts.md](contracts/contracts.md), [quickstart.md](quickstart.md)

**Tests**: Required by the constitution (Principle VI). Unit tests for pure functions, Ajv/Zod parity for schema changes, model round-trip cases, and component tests by role or label. Tests are written first and must fail before the code that makes them pass. No new e2e tests.

**Paths**: `packages/schema/…`, `packages/model/…`, `packages/skill/…`, `apps/app/src/…`. Work in the worktree `../sododeck-068`. Read each package's `CLAUDE.md` before changing it (schema: never edit `src/generated/` by hand; run `pnpm schema:generate`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**:
  - US1: format accepts `path`
  - US2: web app opens such a deck
  - US3: reference survives export
  - US4: skill `picture` helper
  - US5: web app keeps embedding

---

## Phase 1: Setup

- [x] T001 In `../sododeck-068`, rebase on the latest `origin/main`, then run `pnpm install && pnpm --filter @sododeck/schema test && pnpm --filter @sododeck/model test` for a green start. If 066 has merged, note it for T030.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the shared path rule and the schema shape everything else validates against.

- [x] T002 Write failing tests in `packages/schema/test/picture-path.test.ts` for `checkPicturePath(path)` (research R2):
  - `null` for `assets/login.png`, `login.png`, `../../Attachments/x.png`, `a b/Ảnh chụp 1.png`;
  - `'empty'` for `''`; `'too-long'` for 1,025 characters; `'backslash'` for `a\b.png`; `'absolute'` for `/x.png`; `'colon'` for `C:/x.png`, `http://x/y.png`, `data:x`; `'empty-segment'` for `a//b.png` and `a/`; `'dot-segment'` for `./x.png` and `a/./b.png`; `'inner-parent'` for `a/../x.png`; `'no-file-name'` for `..` and `../..`; `'control-char'` for `a\u0001.png`.
  - Also assert that `PATH_VIOLATION_TEXT` has a non-empty sentence for every kind.
- [x] T003 Create `packages/schema/src/picture-path.ts` with `PathViolation`, `checkPicturePath` and `PATH_VIOLATION_TEXT` (contracts §2); export them from `packages/schema/src/index.ts`. Make T002 pass.
- [x] T004 Edit `packages/schema/schema/v1.json` `$defs/Asset`:
  - remove `data` from `required`;
  - add `path` right after `data`: `{ "description": "Where the picture file is, relative to the deck file's folder, with / between folders. Leading ../ may leave the folder; a host only reads files inside its workspace or vault. Use either data or path, never both.", "type": "string", "minLength": 1, "maxLength": 1024 }`;
  - update the `Asset` description to say "its bytes as base64 in `data`, or a `path` to the file".

  Then run `pnpm schema:generate` and commit the regenerated `packages/schema/src/generated/`.

**Checkpoint**: schema and Zod accept `path` (structurally); the rules come next.

---

## Phase 3: User Story 1 — A deck can point at a picture file (P1) 🎯 MVP

**Goal**: valid with `path` and no `data`; one clear problem for both or neither, or for a bad path; existing files unchanged.

**Independent test**: quickstart scenarios 1–5.

- [x] T005 [US1] Write failing fixtures in `packages/schema/test/fixtures.ts`:
  - invalid: an asset with both `data` and `path` (`{ path: 'assets.<id>', code: 'image-asset-source' }`), with neither (same code), and one per I9 kind (`{ path: 'assets.<id>.path', code: 'image-asset-path' }`);
  - valid (`validFixtures`): `assets/x.png`, `../../Attachments/x.png`, non-Latin with spaces, and a mixed deck (one embedded, one pointed-at).

  Base them on the existing image fixtures in that file.

- [x] T006 [US1] Add I8 and I9 to `packages/schema/src/semantic-rules.ts` (update the rule list comment at the top) and the codes `image-asset-source` (I8) and `image-asset-path` (I9) to `FORMAT_RULE_CODES` in `packages/schema/src/issue-codes.ts`.
  - I8 message: "A picture needs exactly one of "data" or "path"; this one has both." or "…has neither."
  - I9 message: "The picture path …" plus `PATH_VIOLATION_TEXT[kind]`.

  Make T005 pass, with Ajv/Zod parity green in `packages/schema/test/schema.test.ts`.

- [x] T007 [US1] Add one pointed-at picture (with an image using it) to `packages/schema/examples/full.sododeck.json` so `packages/schema/test/coverage.test.ts` sees `path`. Keep the existing embedded picture. Run `pnpm --filter @sododeck/schema test`.
- [x] T008 [P] [US1] Add catalogue entries `image-asset-source` and `image-asset-path` (title + fix) to `packages/model/src/problem-codes.ts`, next to `image-asset-missing`. Keep `packages/model/test/problem-codes.test.ts` green: it checks that every schema code has an entry.
- [x] T009 [US1] Write failing tests in `packages/model/test/assets.test.ts`:
  - `metaOf` keeps `path`;
  - `repairAssets` passes through an entry with `path` and no `data`, records its meta, and adds no problem;
  - `loadDeck` of the T005 valid fixtures succeeds and `LoadedDeck.fileRefs` lists `{ id, name, path }` sorted by id;
  - the both / neither fixtures are refused with the I8 code.
- [x] T010 [US1] Implement in `packages/model/src/assets.ts` (`PictureFileRef`, `metaOf`, `repairAssets` returning `fileRefs`) and `packages/model/src/deck.ts` (`LoadedDeck.fileRefs`, filled from `repairAssets`). If 066 has merged, also add `fileRefs` to `PreparedDeck`. Export `PictureFileRef` from `packages/model/src/index.ts`. Make T009 pass.
- [x] T011 [US1] Add model round-trip cases in `packages/model/test/round-trip.test.ts`: a pointed-at-only deck and a mixed deck, each loaded and serialized byte-identical to its input (canonical). Also check that every existing case is unchanged (SC-001).

**Checkpoint**: the format is done. Files with `path` validate everywhere, and the model loads and round-trips them.

---

## Phase 4: User Story 3 — The reference survives a round trip through the web app (P1)

(Done before US2 because it is a model change that US2's UI relies on for export.)

**Goal**: export, save, copy as a file and paste keep `path` and the facts, and never write `data`.

**Independent test**: quickstart scenarios 7–10.

- [x] T012 [US3] Write failing tests in `packages/model/test/assets.test.ts` (`describe('pointed-at pictures on write')`):
  - `readAssets` gives facts + `path` and no `data`;
  - `attachAssets(file)` and `attachAssets(file, bytesIncludingThatId)` both keep `path` and write no `data`;
  - `serializeDeck(doc)` after a load of the pointed-at fixture equals the input;
  - after `editor.remove('images', lastImageUsingIt)`, `serializeDeck` drops the entry.
- [x] T013 [US3] Implement in `packages/model/src/read.ts` (`readAssets`: emit `path` and omit `data` when the meta has `path`) and `packages/model/src/assets.ts` (`attachAssets`: meta with `path` → facts + `path`, before the bytes and `MISSING_DATA` branches; update the doc comment). Make T012 pass.
- [x] T014 [P] [US3] Write and make pass a test in `packages/model/test/image-clipboard.test.ts`: `toFragment` of a pointed-at image carries `path` in the envelope `assets`; `pasteFragment` into the same deck reuses the picture id; `serializeDeck` then has one entry with `path` and two images (US3 AS2). Fix `packages/model/src/fragment.ts` only if needed (it should already pass once `metaOf` keeps `path`).
- [x] T015 [US3] Add an app-level test in `apps/app/src/storage/` or the export module that uses `serializeDeck` (find the save/export call with `rg "serializeDeck" apps/app/src`): open the pointed-at fixture, move a card, export, and assert the asset entry is unchanged (US3 AS1, SC-003). If the app passes a picture byte map, assert `path` still wins.

**Checkpoint**: no web app path can destroy a reference.

---

## Phase 5: User Story 2 — The web app opens such a deck without failing (P1)

**Goal**: the deck opens; the image shows missing with "Saved as a separate file" and the path; the inspector shows the path; the import list has one warning per picture; no read, fetch or store lookup.

**Independent test**: quickstart scenarios 6 and 15.

- [x] T016 [P] [US2] Write failing tests in `packages/model/test/import-check.test.ts`: `inspectDeckText` of the pointed-at fixture returns `ok: true` with one entry per picture: code `picture-file-ref`, severity `warning`, path `/assets/<id>/path`, and the message `Picture "<name>" is saved as a separate file (<path>) and cannot be shown here.` (the id when there is no name). The entries are sorted with the others.
- [x] T017 [US2] Add `fileRefEntry(ref)` to `packages/model/src/problem-entry.ts`, the catalogue entry `picture-file-ref` (title "Picture saved as a separate file", fix "Open the deck in an editor that keeps it in its folder, or put the picture's base64 in "data" instead of "path".") to `packages/model/src/problem-codes.ts`, and use it in `packages/model/src/import-check.ts` (`...loaded.fileRefs.map(fileRefEntry)`). Make T016 pass.
- [x] T018 [US2] Add `filePath?: string` to the image node data in `apps/app/src/editor/deck-to-flow.ts` (next to `fileName`, ~:339), set from `deck.assets?.[image.asset]?.path` (~:1197). Add a case to `apps/app/src/editor/deck-to-flow.test.ts`.
- [x] T019 [US2] Write failing component tests in `apps/app/src/editor/images/image-node.test.tsx`:
  - an image whose `filePath` is set shows "Picture missing", "Saved as a separate file" and the path;
  - its accessible name is "Picture missing, saved as a separate file: <path>" (or the existing name pattern plus that reason);
  - the picture store or URL hook is not called for it (spy on the store port used by `use-picture-url.ts`).
- [x] T020 [US2] Implement in `apps/app/src/editor/images/image-node.tsx`: treat `filePath !== undefined` as missing, render the two extra caption lines in the existing missing block (tokens only, `truncate`, full path in `title`), and extend `imageName(data, missing)`. In `apps/app/src/images/use-picture-url.ts`, skip the lookup when given no id or when the caller passes `skip`, and pass that from the image node. Make T019 pass.
- [x] T021 [P] [US2] Write and make pass tests in `apps/app/src/editor/inspector/image-inspector.test.tsx`: for a pointed-at image there is a read-only row labelled "Picture file" showing the path, and the help text "This app can't read files next to the deck. Open the deck in an editor that keeps it in its folder, or replace the picture." Implement the row in `apps/app/src/editor/inspector/image-inspector.tsx`, following its existing row layout.
- [x] T022 [US2] Check the import UI shows the `picture-file-ref` warning. Find the import problem list component with `rg "picture-damaged|ProblemEntry" apps/app/src -l` and add a test case with the pointed-at fixture that expects the warning text (US2 AS3). No code change is expected beyond the model.

**Checkpoint**: P1 stories are done.

---

## Phase 6: User Story 4 — An AI agent points at an existing image (P2)

**Goal**: `node picture.mjs <image> --deck <deck>` prints a complete entry, and refuses bad files with a clear reason.

**Independent test**: quickstart scenarios 11–12.

- [x] T023 [P] [US4] Move `apps/app/src/images/sniff-type.ts` and its test to `packages/model/src/picture-facts.ts` and `packages/model/test/picture-facts.test.ts`, returning `AssetType`. Export `sniffType` from `packages/model/src/index.ts`. Update `apps/app/src/images/ingest.ts` (and any other importer: `rg "sniff-type" apps/app/src`) to import from `@sododeck/model`, then delete the app files. If the app's `ImageType` and the schema's `AssetType` differ, map them at the import site. Keep the app tests green.
- [x] T024 [US4] Write failing tests in `packages/model/test/picture-facts.test.ts` for `pictureSize(bytes, type)`:
  - use tiny fixtures committed under `packages/model/test/fixtures/pictures/` (one per type: PNG, JPEG with an EXIF segment before SOF, GIF, WebP lossy VP8, lossless VP8L and extended VP8X, AVIF, SVG with width/height, SVG with viewBox only, SVG with neither) with known sizes;
  - a truncated PNG returns `null`.
- [x] T025 [US4] Implement `pictureSize` in `packages/model/src/picture-facts.ts` (research R6 header rules; SVG: px `width` / `height`, else `viewBox`, else 300 × 150). No DOM, no new dependency. Make T024 pass.
- [x] T026 [US4] Write failing tests, then implement `pictureFileEntry(bytes, name, path)` in `packages/model/src/picture-facts.ts` (contracts §3: `bad-type` via `sniffType`, `too-large` over `MAX_ASSET_BYTES`, `no-size`, a `PathViolation` via `checkPicturePath`; ok → `assetId(bytes)` + entry). A deck built with the entry validates through `loadDeck`. Export it from `packages/model/src/index.ts`.
- [x] T027 [US4] Write failing tests in `packages/skill/test/cli.test.ts` for the `picture` command, using the T024 fixtures copied into a temp folder:
  - exit 0 and the JSON entry with `path` relative to `--deck`'s folder, including a `../` case;
  - exit 1 with one stderr line for a BMP, a file over 5 MiB (generated in the test) and an image placed so the relative path would contain an inner `..` (if `path.relative` can produce one; else a violation from a crafted path);
  - exit 2 for missing arguments;
  - nothing on stdout on failure.
- [x] T028 [US4] Add `picture` to `COMMANDS`, `USAGE`, `parseArgs` and `run` in `packages/skill/src/cli/main.ts`. Read the image with `fs`, compute the path with `node:path` `relative(dirname(deck), image)` converted to `/`, and call `pictureFileEntry`. Add the `picture.mjs` entry in `packages/skill/scripts/build.ts`. Make T027 pass, and keep `packages/skill/test/build.test.ts` green (no network modules, byte-identical bundle).
- [x] T029 [US4] Document it: add `packages/skill/content/references/pictures.md` (when to point at a file vs embed, run `picture`, paste the entry under `assets`, add an image whose `asset` is the id; leading `../` only for a shared attachment folder). Link it from the router in `packages/skill/content/SKILL.md`, and list the command in `packages/skill/content/references/scripts.md`. Run the skill build and tests.

**Checkpoint**: agents can point at images without computing facts.

---

## Phase 7: User Story 5 — Pictures added in the web app keep embedding (P2)

**Goal**: confirm no web app path writes `path`.

**Independent test**: quickstart scenario 13.

- [x] T030 [US5] Add a test in `apps/app/src/images/add-images.test.ts`: after adding a picture and serializing the deck, the new entry has `data` and no `path` (US5 AS1). No code change is expected. If 066 has merged, also add the pointed-at fixture to its apply round-trip corpus (`packages/model/test/apply-file-roundtrip.test.ts`) and carry `fileRefs` in `applyFile`'s result.

---

## Phase 8: Polish & cross-cutting

- [x] T031 [P] Write the ADR `docs/decisions/00NN-picture-file-refs.md` (next free number after a fresh `git fetch`). It records:
  - the decision H2 and clarifications 1–3;
  - `data` optional + `path`, the I8 / I9 rules, why not `oneOf`;
  - no version bump, and that older builds refuse such files;
  - the host containment rule (FR-014);
  - the SVG id = hash of the file on disk;
  - the skill helper.
- [x] T032 [P] Update `packages/schema/CLAUDE.md` (068 entry: `path`, I8, I9, `checkPicturePath`), `packages/model/CLAUDE.md` (`fileRefs`, `picture-file-ref`, `picture-facts.ts`, the `attachAssets` rule) and `packages/skill/CLAUDE.md` (the `picture` command).
- [x] T033 [P] Update `docs/backlog-3.md`: mark 068 specified with links, and add to the 069 and 070 in-scope lists "refuse picture paths that resolve outside the workspace / vault (068 FR-014)".
- [x] T034 Measure SC-005 in a model test, `packages/model/test/assets.test.ts`: a deck with one generated 200 KB PNG, serialized embedded vs pointed-at, must be at least 90 % smaller.
- [x] T035 Run the definition of done from the repo root: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` (the no-third-party-requests check covers SC-006). Fix anything red. Confirm there is no `.only` / `.skip`.
- [ ] T036 Walk `quickstart.md` scenarios 1–15 against test names. Take a screenshot of the missing-picture state and the inspector row for the PR (UI work: definition of done).
- [ ] T037 Commit in small Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(app): …`, `feat(skill): …`, `docs: …`; no AI attribution trailer, per AGENTS.md). Push and open a PR to `main` with a summary, screenshots, assumptions and the next step (069).

---

## Dependencies & execution order

- **Setup (T001)** → **Foundational (T002–T004)** → stories.
- **US1 (T005–T011)** needs Foundational. It is the MVP and the base of all others. T008 [P] runs alongside T005–T007.
- **US3 (T012–T015)** needs US1 (T010).
- **US2 (T016–T022)**:
  - T016–T017 need US1 (model `fileRefs`).
  - T018–T022 need T017 for the import list; T018–T021 need only `path` in the facts (US1).
  - It can run in parallel with US3 (different files), except that both touch `packages/model/src/assets.ts`, so do T013 and T010 one after another.
- **US4 (T023–T029)**:
  - T023–T026 need only Foundational (`checkPicturePath`) and can start right after T003, in parallel with US1–US3.
  - T027–T029 need T026.
- **US5 (T030)** after US3.
- **Polish (T031–T037)** after all stories; T031–T033 [P].

```text
T001 → T002 → T003 → T004 → US1 (T005…T011) ┬→ US3 (T012…T015) → US5 (T030) ┐
                    └→ US4 model (T023…T026) │                               ├→ Polish
                                             └→ US2 (T016…T022) ─────────────┤
                       US4 skill (T027…T029) ────────────────────────────────┘
```

## Parallel examples

- **After T003**: one agent does US1 (schema rules, fixtures, model load). Another does US4's model part (T023–T026: sniff move, header sizes, entry builder). These are different files.
- **After US1**: US3 (model write path) and US2's app tasks T018–T021 (deck-to-flow, image node, inspector) in parallel. Then T016–T017 and T022.
- **Polish**: the ADR, the three `CLAUDE.md` files and the backlog in parallel.

## Implementation strategy

1. **MVP = Phases 1–3 (US1)**: the format accepts `path` with clear problems. This alone unblocks 069 / 070 design.
2. **US3 next**: closes the data-loss risk (export turning a reference into a broken picture). Do not ship US1 to users without it.
3. **US2**: the web app shows the reason (P1, completes the user-facing story).
4. **US4**: the skill helper for agents. **US5**: confirmation test.
5. Polish: ADR, docs, full definition of done, screenshots, PR.
