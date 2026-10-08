# Tasks: Shared Vault Decks

**Input**: `specs/071-shared-vault-decks/` — [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md) (R1–R9, S1–S3), [data-model.md](data-model.md), [contracts/vscode-note-host.md](contracts/vscode-note-host.md), [quickstart.md](quickstart.md)

**Gate**: 069 (`apps/vscode`) and 070 (`apps/obsidian`, Markdown form in `@sododeck/model`) are merged on `main`.

**Tests**: required (constitution VI): unit tests for every pure module, host behavior against the existing fakes. No new e2e (smoke suite must stay green).

**Paths**: work in the worktree `../sododeck-071` (branch `071-shared-vault-decks`). Paths are relative to the repo root.

**Read first**: `apps/vscode/CLAUDE.md`, `apps/obsidian/CLAUDE.md`, `specs/070-obsidian-plugin/contracts/markdown-form.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 shared plain file · US2 copy `.sododeck.json` · US3 open a note in VS Code · US4 saving keeps user text · US5 pictures in notes

---

## Phase 1: Setup

- [ ] T001 In `../sododeck-071`, rebase on the latest `origin/main`; confirm `fromMarkdown`, `toMarkdown`, `isDeckMarkdown`, `inspectDeckText`, `emptyDeckText` are exported by `packages/model/src/index.ts` and `apps/obsidian/src/file-codec.ts` exists; run `pnpm install && pnpm --filter sododeck test && pnpm --filter @sododeck/obsidian test` and note the baseline counts in the PR.
- [ ] T002 [P] Add shared note fixtures for VS Code tests in `apps/vscode/test/note-fixtures.ts`: an empty-deck note, a note with a paragraph after the generated region, a note with a title edited in the readable part, a note with a `[[link]]` picture line, an unmarked Markdown file, a marker-but-broken note (build them with `toMarkdown` from `apps/vscode/test/deck-fixtures.ts` decks).

---

## Phase 2: Foundational (blocks US3–US5)

**Purpose**: the file codec and the document that holds both file text and deck text. Nothing here is user-visible alone.

- [ ] T003 [P] Write failing tests `apps/vscode/test/file-codec.test.ts`: `kindOf` (`.md` suffix → markdown, else plain); `decode` plain passes text through and maps empty to `emptyDeckText()`; `decode` markdown returns the deck text or `problems` for an unmarked/broken note; `encode` plain returns the deck text byte for byte; `encode` markdown with `previous` keeps text outside the generated region.
- [ ] T004 Create `apps/vscode/src/file-codec.ts` (same shape as `apps/obsidian/src/file-codec.ts`: `FileKind`, `Problem`, `Decoded`, `kindOf`, `decode`, `encode`; only `@sododeck/model` imports). Make T003 pass.
- [ ] T005 [P] Extend `apps/vscode/test/deck-document.test.ts` (new cases) for notes: `fileText`/`savedDeckText`, `dirty` compares deck text, a disk text that changes only user text refreshes `fileText` and reports "nothing new", an unreadable note is never dirty, `markSaved` stores file text.
- [ ] T006 Update `apps/vscode/src/deck-document.ts` per [data-model.md](data-model.md): add `kind`, `fileText`, `savedDeckText`, `problems`; `fromDisk(loc, fileText)` and `fromBackup` decode through `file-codec`; `applyDisk(fileText)` returns whether the deck text changed; plain files behave exactly as before (existing tests stay green).

**Checkpoint**: `pnpm --filter sododeck test` green; no behavior change for `.sododeck`.

---

## Phase 3: User Story 1 — One folder, two tools (P1) 🎯 MVP

**Goal**: users know `.sododeck` is the shared form; a doc says how to use one folder in both tools.

**Independent Test**: read the five docs; run quickstart step 1.

- [x] T007 [P] [US1] Create `docs/shared-folder.md`: one folder as vault and workspace; `.sododeck` opens in both; what `.sododeck.md` adds in Obsidian (search by card text, backlinks, links that follow moves) and that VS Code opens it too; how to bring in a `.sododeck.json` (rename or the copy command); picture rules per form; what happens on a simultaneous edit (the file wins). English; no other diagram tools named.
- [x] T008 [P] [US1] Update `apps/vscode/README.md` (shared-folder section, command table renamed to **New Sododeck**, new commands, note support, untrusted-workspace behavior) and `apps/vscode/CHANGELOG.md` (next version entry).
- [x] T009 [P] [US1] Update `apps/obsidian/README.md` (shared-folder section, the copy command) and check its command names say **New Sododeck**.
- [x] T010 [P] [US1] In `apps/app/src/editor/deck-inspector-storage.tsx` add one short help line under the export buttons: `.sododeck` opens in Obsidian and VS Code; `.sododeck.md` adds search and links in Obsidian. Add/extend `apps/app/src/editor/deck-inspector-storage.test.tsx` to assert the text by role/label.
- [x] T011 [US1] Update `docs/backlog-3.md` § 071 (status: in progress; link to the spec) and the "Later" bullet about `.sododeck.md` in other hosts; add a pointer from `AGENTS.md` repo map only if the file layout line needs it.

**Checkpoint**: SC-006 can be checked by reading the READMEs.

---

## Phase 4: User Story 2 — Bring a `.sododeck.json` in (P1)

**Goal**: one command copies a `.sododeck.json` to a `.sododeck`, never overwriting, original untouched.

**Independent Test**: quickstart step 2 in both hosts.

- [ ] T012 [P] [US2] Write failing tests in `apps/vscode/test/commands.test.ts` for `copyAsSododeck(ports, source)`: valid deck → `<name>.sododeck` written with identical text and original unchanged; existing target → `<name> 1.sododeck`; invalid content → no file and a "not a Sododeck deck" warning; write failure → warning with the reason.
- [ ] T013 [US2] Implement `copyAsSododeck` in `apps/vscode/src/commands.ts` (validate with `inspectDeckText`; never overwrite; write via `writeDeckFile`; open the new file). Make T012 pass.
- [ ] T014 [US2] Wire it in `apps/vscode/package.json` (command `sododeck.copyAsSododeck`, title "Copy as .sododeck", explorer context menu `when: resourceFilename =~ /\.sododeck\.json$/`) and `apps/vscode/src/extension.ts`.
- [x] T015 [P] [US2] Write failing tests in `apps/obsidian/test/commands.test.ts` for `copyAsSododeck(vault, path)` with the same cases (use `fake-vault.ts`).
- [x] T016 [US2] Implement `copyAsSododeck` and `deckJsonFiles(vault)` in `apps/obsidian/src/commands.ts` (pure). Make T015 pass.
- [x] T017 [US2] In `apps/obsidian/src/main.ts` add the palette command "Copy .sododeck.json as .sododeck" with a suggest modal over `deckJsonFiles`, opening the new file; list the new `obsidian` import in `apps/obsidian/CLAUDE.md` boundaries if a new glue file is added. Spike S3 (mobile picker) recorded in `research.md` after a manual check.

**Checkpoint**: US2 complete in both hosts.

---

## Phase 5: User Story 3 — Open a Sododeck note in VS Code (P1)

**Goal**: a marked `*.sododeck.md` opens as the canvas; anything else stays text.

**Independent Test**: quickstart step 3.

- [ ] T018 [P] [US3] Write failing tests `apps/vscode/test/note-swap.test.ts`: `shouldSwapToCanvas({ fileName, hasMarker, chosenText })` — true only for `*.sododeck.md` with marker and not chosen as text; false for other names, no marker, a partial marker, `.markdown`, `.sododeck.json`.
- [ ] T019 [US3] Create `apps/vscode/src/note-swap.ts` (pure) per [data-model.md](data-model.md). Make T018 pass.
- [ ] T020 [P] [US3] Extend `apps/vscode/test/save.test.ts` / `revert-backup.test.ts` style cases in a new `apps/vscode/test/note-open.test.ts`: `openDocument` of a note decodes to deck text; a hot-exit backup restores dirty against disk; an undecodable note yields `problems`, is not dirty, and `saveDocument` writes nothing.
- [ ] T021 [US3] Update `apps/vscode/src/document-ops.ts`: `openDocument` reads file text and builds the document through the codec (backup holds encoded file text); `revertDocument` decodes; `backupDocument` writes the encoded file text; plain behavior unchanged.
- [ ] T022 [US3] Update `apps/vscode/src/host-session.ts` only if needed to open an undecodable note: no `init`; `apps/vscode/src/deck-editor-provider.ts` shows `messagePage` with the plain reasons and calls `ports.ui.offerOpenAsText` (FR-012). Test in `apps/vscode/test/note-open.test.ts`.
- [ ] T023 [US3] Contribute the editor for notes in `apps/vscode/package.json`: selector `*.sododeck.md`, `priority: "option"`, same view type; make the existing "Open as text" command record the file in a chosen-text set (`apps/vscode/src/extension.ts`).
- [ ] T024 [US3] Implement the swap glue in `apps/vscode/src/vscode-ports.ts` and `apps/vscode/src/extension.ts`: on a text editor opening a `*.sododeck.md`, read the text, call `shouldSwapToCanvas`, and `vscode.openWith` the canvas (closing the text tab). Run spike S1 in real VS Code; record flicker/results in `research.md`; if unacceptable, fall back to option-only and document "Reopen Editor With…" in the README.

**Checkpoint**: an unmarked `.md` stays text; a note opens as canvas; unreadable note shows a reason.

---

## Phase 6: User Story 4 — Saving keeps what the user wrote (P1)

**Goal**: save regenerates the readable part and keeps the user's own text; outside text edits and Obsidian writes reach the canvas.

**Independent Test**: quickstart step 4.

- [ ] T025 [P] [US4] Write failing tests in `apps/vscode/test/note-save.test.ts`: save of an edited note keeps a paragraph after the generated region byte for byte and the result passes `isDeckMarkdown`; a clean note writes nothing on close; a file written by `toMarkdown` in the Obsidian test fixtures decodes in VS Code and back (FR-017).
- [ ] T026 [US4] Update `saveDocument` in `apps/vscode/src/document-ops.ts` to write `encode(kind, doc.text, doc.fileText)` and `markSaved` with both texts. Make T025 pass.
- [ ] T027 [P] [US4] Write failing tests `apps/vscode/test/note-disk-sync.test.ts`: a title edited as text in the note reaches the canvas as an `external-change` with deck text; a user paragraph added on disk sends nothing but a later save keeps it; our own write is not echoed; unsaved edits replaced → `REPLACED_NOTICE`.
- [ ] T028 [US4] Update `apps/vscode/src/disk-sync.ts` to decode the read text, call the document's `applyDisk(fileText)`, and send `sendExternalChange(deckText)` only when the deck text changed. Make T027 pass; plain tests stay green.
- [ ] T029 [P] [US4] Write failing tests in `apps/vscode/test/save-as.test.ts` (new cases): Save As to `*.sododeck.md` converts a plain deck; Save As to `*.sododeck` converts a note; pictures copy as before.
- [ ] T030 [US4] Update `apps/vscode/src/save-as.ts`: pick the destination kind from its name and encode with no `previous`. Make T029 pass.
- [ ] T031 [US4] Add the cross-host round-trip test `apps/vscode/test/note-roundtrip.test.ts` over `note-fixtures.ts` (open → edit → save → reopen; every character outside the generated region unchanged — SC-002).

**Checkpoint**: US1–US4 complete; the P1 scope is done.

---

## Phase 7: User Story 5 — Pictures in notes (P2)

**Goal**: pictures added in VS Code show in Obsidian and the reverse.

**Independent Test**: quickstart step 5.

- [ ] T032 [P] [US5] Add `findByPathEnd(loc, rel): Promise<Loc[]>` to `FilePort` in `apps/vscode/src/ports.ts`, with a fake in `apps/vscode/test/fakes.ts` and the real implementation (`vscode.workspace.findFiles` over the workspace folders, matching a path ending) in `apps/vscode/src/vscode-ports.ts`.
- [ ] T033 [P] [US5] Write failing tests in `apps/vscode/test/picture-host.test.ts` (new cases, note only): relative path found → served; relative missing, one path-ending match → served after guard and hash check; two matches → `picture-missing` naming the ambiguity; none → missing; match outside the workspace → refused; hash mismatch → missing "file changed"; a plain `.sododeck` keeps the relative-only behavior.
- [ ] T034 [US5] Implement the lookup order in `apps/vscode/src/picture-host.ts` (kind comes from the document; pass it into `PictureHost`). Make T033 pass.
- [ ] T035 [P] [US5] Write failing tests `apps/vscode/test/note-pictures.test.ts`: with storage `file`, trusted, a note gets `<name>.assets/<file>` and, after save, a `- [[<name>.assets/<file>]] %%<id>%%` line; with `embed` or untrusted no link and no file; a path with `[`, `|` or `#` gets no link; a missing file shows missing with a reason.
- [ ] T036 [US5] Make T035 pass (expected to need no model change since `toMarkdown` already writes the link list; if a gap appears, record it in `research.md` as a finding for 070, do not build it here). Update `apps/vscode/CLAUDE.md` for the new boundaries (codec, note swap, link lookup).
- [ ] T037 [US5] Spike S2 in real Obsidian and VS Code (quickstart step 5): confirm Obsidian resolves a `<name>.assets/<file>` link from a note in another folder and keeps it on a move; record results in `research.md`.

---

## Phase 8: Polish & cross-cutting

- [ ] T038 Rename the default command to **New Sododeck** in `apps/vscode/package.json`, `apps/vscode/src/commands.ts` (doc comment), `apps/vscode/README.md`; add `sododeck.newNote` (**New Sododeck note**, creates `.sododeck.md` from `toMarkdown(emptyDeckText())`, never overwrites, same dialog flow) with tests in `apps/vscode/test/commands.test.ts`, and the explorer folder menu entries (FR-013). Search docs/specs for "New Sododeck deck" and update the live docs (`apps/vscode/*`, `docs/backlog-3.md`); leave finished specs 069/070 as history.
- [ ] T039 [P] Write `docs/decisions/0053-shared-vault-decks.md` (ADR): codec at the file edge, `option` priority plus swap, path-ending lookup for note pictures, why the codec is duplicated per host.
- [ ] T040 [P] Extend `apps/vscode/scripts/check-bundle.ts` expectations only if the swap or `findFiles` glue trips it (no network API may be added); run `pnpm --filter sododeck build`.
- [ ] T041 Run the whole definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; fix anything red; confirm no `any`, no `!`, no skipped tests.
- [ ] T042 Manual pass of [quickstart.md](quickstart.md) on desktop VS Code and Obsidian (desktop + phone for steps 1, 2, 5); record outcomes and the spike results; screenshots for the PR (note as canvas in VS Code, shared folder in both).
- [ ] T043 Open the PR with: what changed, what was skipped (no new e2e; no link rewriting in VS Code; no skill support), what is uncertain (S1–S3). No AI attribution lines in commits or the PR body (project rule in `AGENTS.md`).

---

## Dependencies & execution order

- Phase 1 → Phase 2 → everything else. Phase 3 (docs) and Phase 4 (copy commands) need only Phase 1 and can run in parallel with Phase 2.
- US3 needs T004, T006. US4 needs US3 (T021). US5 needs US4 (the document carries `kind`) and T032.
- T038 touches `package.json` and `commands.ts` also edited in T014/T023; do it last or rebase carefully.
- `apps/app` (T010) is independent of both hosts.

## Parallel examples

- After T001: T002, T003, T007, T008, T009, T010, T012, T015 together.
- Within US4: T025, T027, T029 (tests) in parallel, then T026, T028, T030.
- Within US5: T032, T033, T035 in parallel.

## Implementation strategy

- **MVP (stop and demo)**: Phases 1–3 plus Phase 4 — docs plus the copy commands: the shared plain file is documented and older decks can join. No VS Code runtime change.
- **Core (P1 complete)**: add Phases 2, 5, 6 — notes open and save safely in VS Code.
- **Full**: Phase 7 (pictures), then Phase 8.
- Commit small and conventional (`docs(specs): …`, `feat(vscode): …`, `feat(obsidian): …`, `docs: …`).
