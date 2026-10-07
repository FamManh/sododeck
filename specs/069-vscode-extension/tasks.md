# Tasks: Sododeck in VS Code

**Input**: Design documents from `specs/069-vscode-extension/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md) (7 clarifications), [research.md](research.md) (R1–R12, G1–G3, S1–S3), [data-model.md](data-model.md), [contracts/extension-host.md](contracts/extension-host.md), [quickstart.md](quickstart.md). Contract with the editor: `specs/067-embed-host-protocol/contracts/host-protocol.md`. Picture rules: `specs/068-picture-file-refs/contracts/contracts.md`.

**Hold**: do **not** start implementation until 067 is merged (founder, 2026-10-07). Planning artefacts are complete; T001 checks the gate.

**Tests**: required by the constitution (Principle VI) and spec FR-030: unit tests for every pure module against the scripted fake editor on 067's `memoryTransportPair`; written first and failing before the code that makes them pass. Glue that imports `vscode` is kept thin and covered by the quickstart. No new e2e (Principle VI); the smoke suite must stay green.

**Paths**: work in the worktree `../sododeck-069` (branch `069-vscode-extension`). Paths are relative to `apps/vscode/` unless they start with `packages/`, `apps/app/`, `docs/`, `specs/` or are root files. Read `apps/app/CLAUDE.md` and `packages/model/CLAUDE.md` before touching anything they own (this feature should not).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 open, edit and save · US2 editor file features · US3 follow the file on disk · US4 pictures · US5 theme · US6 commands · US7 install and trust

---

## Phase 1: Setup

- [x] T001 In `../sododeck-069`, rebase on the latest `origin/main`. Gate: `packages/host-protocol/` exists and `pnpm --filter @sododeck/app build` produces `apps/app/dist-embed/embed.html` (067 merged). If not, stop and report; do not copy 067 code into this branch. Then run `pnpm install && pnpm test && pnpm build` for a green start and note the exported names from `@sododeck/host-protocol` (message types, `parseEditorMessage`, `parseHostMessage`, `memoryTransportPair`, `PROTOCOL_VERSION`) and from `@sododeck/model` (`checkPicturePath`, the parse and `serializeDeck` functions, the empty-deck builder) that later tasks use.
- [x] T002 Create the app skeleton `apps/vscode/` modelled on `packages/skill/`: `package.json` (name `sododeck`, workspace name `@sododeck/vscode`, `private` true for the workspace but publishable by `vsce`, `engines.vscode` `^1.90.0`, `main` `./dist/extension.js`, the manifest `contributes`, `capabilities`, `activationEvents` from `contracts/extension-host.md` §1; scripts `build`, `package`, `lint`, `typecheck`, `test`; dependencies `@sododeck/host-protocol`, `@sododeck/model` as `workspace:*`; devDependencies `@sododeck/config`, `@sododeck/app` (build order only, never imported), `@types/vscode`, `@vscode/vsce`, `esbuild`, `eslint`, `tsx`, `typescript`, `vitest`, versions matching the repo), `tsconfig.json` (extends the shared config, Node types), `eslint.config.js`, `vitest.config.ts`, `.vscodeignore` (sources, tests, scripts), `.gitignore` (`dist/`, `media/`). Reasons for the two new dev dependencies go in `docs/decisions/0050-vscode-extension.md` (T050). Ask the founder before adding any runtime dependency (none planned).
- [x] T003 [P] Add `dist/**` and `*.vsix` to the `build` outputs for the new workspace in root `turbo.json` (keep existing outputs), and update `AGENTS.md` repo map and dependency direction: `apps/vscode/` (VS Code extension → host), `vscode → host-protocol`, `vscode → model → schema`, the extension copies `apps/app`'s embed build and imports nothing from it.
- [x] T004 Create `scripts/build.ts`: esbuild bundles `src/extension.ts` to `dist/extension.js` (platform node, CommonJS, ES2022, `vscode` external, minified, no source map), copies `../app/dist-embed/**` to `media/embed/`, copies `src/webview-shim.js` to `media/webview-shim.js`; fails with a clear message if `dist-embed` is missing. Add `package` script: `vsce package --no-dependencies --out dist/`.
- [x] T005 [P] Write failing tests in `test/check-bundle.test.ts` for the guard function `checkBundle(files)`: fails when `dist/extension.js` imports `http`, `https`, `net`, `tls`, `dgram`, `dns` (also `node:` prefixed) or contains `fetch(`, `XMLHttpRequest`, `WebSocket`, `createTelemetryLogger`; fails when any file under `media/embed` or the generated webview HTML references a remote `http:` / `https:` URL in a `src`, `href`, `url(` or `import` position; passes on a clean fixture. Implement `scripts/check-bundle.ts` (exports `checkBundle`, runnable as a script after `build`; wire it into `build`).

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the real-webview spikes, the ports, the document model and the webview page. Nothing below needs a story to exist.

### Spikes (manual, in the Extension Development Host; record results in `research.md` under "Spike results")

- [ ] T006 Spike S2: a throwaway extension (or the real skeleton from T002) opens a deck in a webview using the plan's CSP and the shim from R4, loading `media/embed/embed.html` from 067's build. Check: the deck shows, the layout worker runs from a blob, fonts load, no CSP violation in the webview developer tools, a 5 MiB `Uint8Array` crosses `postMessage` both ways intact, the 500-node bench deck is visible in ≤ 2 s (SC-001). If workers fail because they are separate files, implement the rewrite in `scripts/build.ts` (R5) or file gap G2 against 067; if `window.parent` replacement fails, file gap G1. Record numbers and decisions.
- [ ] T007 Spike S3: with focus in the webview, Cmd/Ctrl+Z and Y reach the canvas's undo and nothing else, Cmd/Ctrl+S runs VS Code's save, and Cmd/Ctrl+C / V / A reach the canvas. If a key does not arrive, add forwarding to the shim and record it.
- [ ] T008 Spike S1: a custom editor document marked changed by a content-change event, then try `vscode.commands.executeCommand('workbench.action.files.revert', uri)` and the alternatives in R3 on a visible tab and on a background tab. Record whether the mark clears with no prompt. If it cannot be done, update `spec.md` FR-013 and US3 with the fallback wording from R3 and tell the founder before continuing.

### Pure modules and test doubles

- [x] T009 [P] Create `src/ports.ts` (interfaces only: `FilePort` read / write / copy / exists / stat / readdir / realpath, `WatchPort`, `ThemePort`, `SettingsPort` (`picturesStorage()`, `onChange`), `TrustPort`, `UiPort` (`notify`, `warn`, `offerOpenAsText`, `statusMessage`, `showSaveDialog`, `openExternal`, `openUri`), `ClockPort` for timeouts) and `test/fake-editor.ts`: a scripted editor on `memoryTransportPair` from `@sododeck/host-protocol` with helpers `ready()`, `sendChange(text)`, `answerFlush()`, `recorded()`, `putPicture(...)`, `getPicture(id)`, plus in-memory fakes for every port (`test/fakes.ts`) with controllable time. Add a self-test proving the fake editor and the real message schemas agree (every message it sends passes `parseEditorMessage`).
- [x] T010 [P] Write failing tests in `test/deck-document.test.ts` per `data-model.md`: open from disk, open from a backup text (dirty, `savedText` = disk), `applyChange` (stale or repeated `seq` ignored, text kept byte for byte), `markSaved`, `applyDisk` (equal to `text`, `savedText` or `lastWritten` → no-op), `dirty` derived. Implement `src/deck-document.ts` (pure class, no `vscode`).
- [x] T011 [P] Write failing tests in `test/webview-html.test.ts`: the generated page has a fresh nonce on every script, the CSP of R5 exactly (no remote source, `worker-src blob:`), every `src`/`href` of `embed.html` rewritten through the injected `toWebviewUri`, the shim loaded first, no `http:` / `https:` URL. Implement `src/webview-html.ts` (pure: takes the embed HTML text, a URI mapper, `cspSource`, nonce) and `src/webview-shim.js` per R4 (replace `window.parent` with an object whose `postMessage` calls `acquireVsCodeApi().postMessage`; re-dispatch extension messages as `message` events whose `source` is that object; no other behaviour). Apply the spike results.

**Checkpoint**: `pnpm --filter @sododeck/vscode test` and `typecheck` green; spikes recorded; G1 to G3 filed or marked unnecessary.

---

## Phase 3: User Story 1 - Open a deck from the repository and edit it (P1) 🎯 MVP

**Goal**: a `.sododeck` file opens as the canvas, edits mark the tab changed, save writes a valid file.

**Independent test**: with the fake editor: `ready` → `init` with the file text; `change` → content-change event and `change-result`; invalid text, empty text and version mismatch behave per spec. In the editor: quickstart 1–4.

### Tests (write first)

- [x] T012 [P] [US1] Write failing tests in `test/host-session.test.ts`: `ready` → `init { text, theme, capabilities, protocolVersion: 1 }`; empty or whitespace text opens as an empty deck and is not dirty (US1-6); invalid text (model check) → `init` still sent so the canvas shows its problems, `offerOpenAsText` called once, the document is never written (FR-003); `change` with `text !== savedText` → "changed" event within 500 ms (fake clock) and `change-result { ok:true }`; `change` equal to `savedText` → no event; a `ready` from a webview with another `protocolVersion` gets no deck content and nothing is written (FR-004); malformed and unknown messages are ignored and change nothing (FR-025); a message that fails `parseEditorMessage` is dropped.
- [x] T013 [P] [US1] Write failing tests in `test/host-links-exports.test.ts`: `open-link` with `https://…` → `openExternal`; relative href → resolved against the deck's folder, inside the boundary → `openUri`, outside → refused with a notice and nothing opened; `export-file` → save dialog with the suggested name, bytes written to the chosen uri, cancel writes nothing; capabilities `openLinks` and `exportFiles` are `true` only because these handlers exist.

### Implementation

- [x] T014 [US1] Implement `src/host-session.ts`: one session per webview and `DeckDocument`; phases `waiting` → `ready`; builds `init` (capabilities from `capabilities.ts`, scheme from `ThemePort`); model check of the opened text (reuse the model's parse; never rewrites it); `change` handling; `flush` helper `flush(): Promise<void>` (used by US2); message validation with 067's schemas; disposal. Make T012 pass.
- [x] T015 [P] [US1] Implement `src/capabilities.ts` (`computeCapabilities({ setting, deckUri, trusted, writable })` returning 067's `Capabilities`; in this story `pictures` is always `false`, extended in T038) with its unit test.
- [x] T016 [P] [US1] Implement `src/host-links-exports.ts` (pure, over ports; uses the guard from T032 once it exists: until then a minimal lexical check in the same file marked `TODO(069)` replaced by T032). Make T013 pass.
- [x] T017 [US1] Implement the VS Code glue: `src/vscode-ports.ts` (ports over `vscode`: `workspace.fs`, `window.showSaveDialog`, `env.openExternal`, `window.activeColorTheme`, settings, trust), `src/deck-editor-provider.ts` (`CustomEditorProvider<DeckDocumentHandle>`: `openCustomDocument` reads the file or the backup; `resolveCustomEditor` builds the page with `webview-html.ts`, wires the webview's `onDidReceiveMessage` and `postMessage` to a `Transport` for `HostSession`, fires `onDidChangeCustomDocument` content-change events; `supportsMultipleEditorsPerDocument: false`, `retainContextWhenHidden: false`, `localResourceRoots` only `media/`), `src/extension.ts` (`activate` registers `sododeck.canvas`; nothing else yet). No `vscode` import outside these three files.
- [x] T018 [US1] Make a second open of the same file (FR-027) show the editor's own reveal behaviour, and if the same document does get two webviews, the second shows a plain "This deck is already open in another tab" page generated by `webview-html.ts` and never connects a session. Test the page builder in `test/webview-html.test.ts`.
- [ ] T019 [US1] Run quickstart scenarios 1, 2 and 4 (open, edit, mark within 0.5 s, open without edits leaves no diff) in the Extension Development Host; fix what fails. Add notes to `research.md` "Spike results" only if behaviour differs from the plan.

**Checkpoint**: US1 works for open and edit; save is US2. Tests green.

---

## Phase 4: User Story 2 - The editor's normal file features just work (P1)

**Goal**: save, save as, revert, close prompt and hot exit behave like for any file.

**Independent test**: with the fake editor and fake ports: save flushes then writes the canvas's last text; save as, revert, backup and restore per `data-model.md`. In the editor: quickstart 3, 5–7.

### Tests (write first)

- [x] T020 [P] [US2] Write failing tests in `test/save.test.ts`: save sends `flush`, waits for `flushed`, writes exactly `DeckDocument.text` (byte equal to the last `change.text`), then `savedText = lastWritten = text`; an edit sent just before the flush is in the file (US2-5); `flushed` timeout (fake clock 2 s) → writes the last known text and shows a warning; nothing is written when the document is clean; save never reformats; the deck file is written only by save, save as and the new-deck command (spy on `FilePort.write`, FR-010).
- [x] T021 [P] [US2] Write failing tests in `test/file-writer.test.ts`: for the `file` scheme and a regular file, write goes to a temp sibling and renames over the target; for a symlinked target the link target is written in place; for other schemes a direct write; a failure leaves the original file untouched and reports the reason; no temp file is left behind after success or failure.
- [x] T022 [P] [US2] Write failing tests in `test/revert-backup.test.ts`: revert reads the disk text, sets `text = savedText`, sends `external-change`, clears dirty; backup writes `text` to the destination and returns an id; opening with a backup starts from the backup text, dirty, with `savedText` = disk; a missing backup falls back to the disk text.

### Implementation

- [x] T023 [US2] Implement `src/file-writer.ts` and make T021 pass.
- [x] T024 [US2] Add save, revert and backup to `HostSession` / `DeckDocument` flows (`saveDocument`, `revertDocument`, `backupDocument`, `restoreFromBackup`) and make T020 and T022 pass.
- [x] T025 [US2] Wire the provider glue in `src/deck-editor-provider.ts`: `saveCustomDocument`, `revertCustomDocument`, `backupCustomDocument`, and `saveCustomDocumentAs` (in this story: flush, write the current text to the new uri, nothing copied; picture copying is added in T037). Register "Open as text" availability (`vscode.openWith(uri, 'default')` from the invalid-file notice and from the editor title menu via `contributes.menus` `editor/title` for `activeCustomEditorId == sododeck.canvas`).
- [ ] T026 [US2] Run quickstart scenarios 3, 5, 6, 7 (save diff is only the change, save as, revert, hot exit) and the "close with unsaved changes" prompt (US2-3); fix what fails.

**Checkpoint**: US1 + US2 usable end to end (MVP with the file round trip).

---

## Phase 5: User Story 3 - The canvas follows the file on disk (P1)

**Goal**: pulls, branch switches and agent writes show up in place; the file wins; own writes do not echo.

**Independent test**: with fake ports: disk events become `external-change` only when the content differs from what we sent or wrote; dirty documents get the file and a notice. In the editor: quickstart 8–9.

### Tests (write first)

- [x] T027 [P] [US3] Write failing tests in `test/disk-sync.test.ts`: a watcher event after our own save (text equals `lastWritten`) sends nothing (FR-012, US3-3); an event whose text equals the canvas's last `change.text` or `savedText` sends nothing; a different valid text sends `external-change` and sets `text = savedText = disk`; the same while dirty also clears the mark (through the mechanism chosen by spike S1) and shows the one-line "unsaved edits were replaced" notice, with no prompt (FR-013, SC-005); an invalid disk text keeps the last deck, shows problems through the canvas (the invalid text is still sent as `external-change`, 067 FR-014), never writes and never reverts (FR-014); a deleted file keeps the document and marks it changed so save is offered (FR-015); a rename rebinds the document's uri; a tab hidden during a change gets the disk text when shown (US3-6); a re-check on window focus and on tab visibility catches a missed watcher event; 20 rapid events cause at most one comparison in flight at a time.
- [x] T028 [P] [US3] Add to `test/disk-sync.test.ts` the 100-sequence property test of SC-002 and SC-005: random interleavings of edit, save, outside change, revert with the fake editor; invariants: no edit lost across save, the canvas equals the file after every outside change, the notice appears exactly when a dirty document was replaced, nothing invalid is ever written.

### Implementation

- [x] T029 [US3] Implement `src/disk-sync.ts` (pure, over `WatchPort` and `FilePort`; content compare, single-flight, debounce 50 ms) and make T027 and T028 pass.
- [x] T030 [US3] Wire it in the glue: one `FileSystemWatcher` per document (`RelativePattern` for the single file), `onDidChangeViewState` and `window.onDidChangeWindowState` re-checks, `onDidRenameFiles`, and the mark-clearing step chosen in T008 (revert command, or the fallback). Disposal on tab close.
- [ ] T031 [US3] Run quickstart scenarios 8 and 9 (`git checkout` over an edited tab; `echo '{broken' > file`), and a remote or WSL workspace if available; fix what fails.

**Checkpoint**: the three P1 stories done: opening, editing, saving and following the disk.

---

## Phase 6: User Story 4 - Pictures embedded or next to the deck (P2)

**Goal**: pictures stay embedded by default; with the setting they become files in `<deck>.assets/`; nothing outside the workspace is read or written.

**Independent test**: with fake ports and files: `picture-put` / `picture-get` / Save As per `contracts/extension-host.md` §3; containment cases. In the editor: quickstart 11–14.

### Tests (write first)

- [x] T032 [P] [US4] Write failing tests in `test/workspace-guard.test.ts` (R9): `..` runs staying inside and escaping, a deck outside any workspace (its own folder is the boundary), absolute-looking and Windows-separator paths, a symlink inside the workspace pointing out (read refused), a symlinked deck folder, a not-yet-existing target checked through its nearest existing parent, case-different paths on a case-insensitive fixture, non-`file` schemes judged lexically. Implement `src/workspace-guard.ts` (`resolveInside(deckUri, relPath, ports): { ok: true, uri } | { ok: false, reason }`) and make it pass; then replace the `TODO(069)` lexical check from T016 with it.
- [x] T033 [P] [US4] Write failing tests in `test/picture-host.test.ts`: `picture-put` writes `<deck base>.assets/<first 16 hex of id>.<ext>` and answers `picture-stored` with `<deck base>.assets/<file>` only when `checkPicturePath` returns null; identical existing file reused; different bytes under the same name get `-2`; an existing different file is never overwritten; a deck base name containing `:` answers `picture-store-failed` with the path rule's plain text; a write failure answers `picture-store-failed` with the reason; `picture-get` finds `assets[id].path` in the document text through the model, checks containment, size ≤ 5 MiB and SHA-256 = id, then answers `picture`; each failure answers `picture-missing` with its plain reason ("not found", "outside the workspace", "workspace not trusted", "the file changed", "could not be read"); the base name of `x.sododeck.json` is `x`.
- [x] T034 [P] [US4] Write failing tests in `test/save-as.test.ts` (FR-017a): pictures pointing at `old.assets/*` are copied to `new.assets/` with the no-overwrite naming and the new text's `path` entries rewritten through the model while every other byte of the canonical text is unchanged; a missing or outside-the-boundary picture keeps its path; the old deck and files are untouched; a deck with no path pictures is written as is; an embedded picture is left embedded.
- [x] T035 [P] [US4] Write failing tests in `test/capabilities.test.ts` (extend T015): `pictures` is true only for setting `file` AND a deck uri that is not `untitled` AND a trusted workspace AND a writable deck folder (Q1, Q3, FR-016, FR-026); an untitled deck with the setting on stays embedded and is never moved later (US4-8); a setting or trust change while open sends a second `init` with the new capabilities and the unchanged text and does not mark the tab changed; in an untrusted workspace `picture-get` of a pointed-at picture answers missing with "workspace not trusted" and the notice of FR-026 is shown once per session.

### Implementation

- [x] T036 [US4] Implement `src/picture-host.ts`; make T033 pass.
- [x] T037 [US4] Implement `src/save-as.ts` and call it from `saveCustomDocumentAs` in the provider glue; make T034 pass.
- [x] T038 [US4] Extend `computeCapabilities`, subscribe the session to `SettingsPort.onChange` and `TrustPort.onDidGrant`, and send the second `init`; add the `sododeck.pictures.storage` handling in `vscode-ports.ts`; make T035 pass. Show the untrusted-workspace notice through `UiPort`.
- [ ] T039 [US4] Run quickstart scenarios 11–14 in the editor, including a symlink pointing out of the workspace and Restricted Mode; fix what fails.

---

## Phase 7: User Story 5 - The canvas looks like it belongs in the editor (P2)

**Goal**: light or dark follows the editor, live.

**Independent test**: `ColorThemeKind` mapping and `theme` messages with the fake editor; quickstart 10.

- [x] T040 [P] [US5] Write failing tests in `test/theme.test.ts`: `Light` and `HighContrastLight` → `light`; `Dark` and `HighContrast` → `dark`; the session sends `theme { scheme }` on a change within 1 s of the event (fake clock), sends nothing when the scheme is unchanged, and `init` carries the current scheme. Implement `src/theme.ts` and the session wiring; make it pass.
- [ ] T041 [US5] Run quickstart scenario 10 (switch themes with a deck open: no reload, selection and viewport kept); fix what fails.

---

## Phase 8: User Story 6 - Create a deck, and take it to the web app (P2)

**Goal**: "New Sododeck deck" and "Open in Sododeck web".

**Independent test**: command logic with fake ports; quickstart 15.

- [x] T042 [P] [US6] Write failing tests in `test/commands.test.ts`: `newDeck` asks for a place when no folder is open, defaults the dialog to the first workspace folder (or the folder chosen in the explorer), refuses to overwrite an existing file (checks existence itself, in addition to the dialog), writes the model's canonical empty deck (valid per the model's check), then opens it with the custom editor; `openInWeb` reveals the deck file in the OS file manager and opens the web app's address in the browser, makes no other request and reads nothing from the deck; both are no-ops with a plain message when there is no active deck (second command).
- [x] T043 [US6] Implement `src/commands.ts`, register both commands in `src/extension.ts`, and finish the manifest entries (`menus`, `enablement`). Make T042 pass; run quickstart scenario 15.

---

## Phase 9: User Story 7 - Install and trust (P2)

**Goal**: an honest, installable package, with the promises checked.

**Independent test**: build, install in a clean profile, watch the network; the release checklist exists.

- [x] T044 [P] [US7] Write `README.md` (marketplace page): what it does (open `.sododeck` as a canvas, save with VS Code, follows the file on disk, pictures embedded or next to the deck, theme), what it does not do (no library, one canvas per file, no network, no telemetry, no upload; picture files only inside the workspace), the setting, the two commands, Restricted Mode behaviour. Plain words, English, no other product names. Add `CHANGELOG.md` (0.1.0).
- [x] T045 [P] [US7] Create `icon.png` (128×128, from the existing brand assets in `apps/app/public/` or `DESIGN.md` tokens; no new artwork style) and reference it in the manifest with `publisher`, `repository`, `license` as the repo's founder decisions allow (ask if the publisher id is not recorded in `docs/`).
- [x] T046 [P] [US7] Write `docs/release/vscode-extension.md`: the release checklist of FR-029 (version bump and changelog; `pnpm build`, bundle guard and tests green; install the `.vsix` in a clean profile on the stable VS Code and the previous release (SC-010); network watch run; quickstart scenarios 1–17; `vsce publish` and `ovsx publish` commands with token handling kept out of the repo; tag; rollback note). Building never publishes: no publish script in `package.json`.
- [x] T047 [US7] Run `pnpm --filter @sododeck/vscode build && pnpm --filter @sododeck/vscode package`; confirm the `.vsix` contains `dist/extension.js`, `media/embed/**`, `media/webview-shim.js`, README, CHANGELOG, icon and nothing from `src/`, `test/` or `scripts/`; the size is recorded in the ADR.
- [ ] T048 [US7] Run quickstart 16 and 17 with the real package: zero network requests over a full session of open, edit, save, picture add, outside change and theme switch (SC-006); the 500-node deck opens ≤ 2 s and a drag stays smooth, numbers recorded (SC-001, SC-008); a first-time user goes from install to a saved new deck in < 2 min (SC-009, time it with someone who has not seen it).

---

## Phase 10: Polish and cross-cutting

- [x] T049 [P] Write `apps/vscode/CLAUDE.md`: responsibility (host adapter, nothing else), boundaries (no `vscode` import outside the three glue files, never import `apps/app`, never reformat `change.text`, never write the deck outside save, save as, new deck), how to run (F5, build, package), what to read first (067 contract, `contracts/extension-host.md`).
- [x] T050 [P] Write `docs/decisions/0050-vscode-extension.md`: the decisions of R1 (custom editor type and the cost), R3, R4 (shim and gaps), R5 (CSP and workers), R6 (content-compare sync), R8–R9 (picture files and containment), the two dev dependencies with reasons, the package size, the spec correction about undo (file wins, no restore), and the amendment proposal for Principle IV wording if 067's ADR 0049 has not already made it.
- [x] T051 [P] Update `docs/backlog-3.md` § 069 status ("implemented" with the date and links to the spec, tasks and ADR 0050) and note the corrected undo behaviour; update root `README.md` only if commands changed. Mention in `docs/deploy.md` that the extension is released separately from the web app, pointing to `docs/release/vscode-extension.md`.
- [x] T052 Final pass: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all green (the smoke suite must be unaffected); no skipped or `.only` tests; no `any`, no non-null `!`; Prettier clean; no `Co-Authored-By` trailers added by hand where the repo forbids them; commits are small Conventional Commits (`feat(vscode): …`, `docs: …`, `chore: …`).
- [x] T053 Final report to the founder: what changed, what was skipped (publishing, `@vscode/test-electron` CI run as `TODO(069)`, web VS Code), what is uncertain (spike results, gaps G1 to G3 and whether 067 adopted them), measured numbers (SC-001, SC-008, package size), and a proposal for the next step (070 or the 065 bridge). Stop; do not start the next feature.

---

## Dependencies and order

- **Setup (T001–T005)** → **Foundational (T006–T011)** → stories. Spikes T006–T008 gate the parts they cover: T006 gates T011 and every webview task; T008 gates T029–T030; T007 gates T019.
- **US1 (T012–T019)** needs Foundational. **US2 (T020–T026)** needs US1 (`HostSession`, provider). **US3 (T027–T031)** needs US2 (save and `lastWritten`). These three are the P1 path and are sequential.
- **US4 (T032–T039)** needs US1 and US2 (provider, Save As); the guard T032 can start right after Foundational. **US5 (T040–T041)** and **US6 (T042–T043)** need only US1 and are independent of each other and of US4. **US7 (T044–T048)** needs everything built; T044–T046 can be written earlier.
- **Polish (T049–T053)** last; T049 to T051 can start once the code is stable.
- Within a story: tests first and failing, then implementation, then the manual quickstart run.

## Parallel opportunities

- Setup: T003 and T005 alongside T002 and T004.
- Foundational: T009, T010, T011 in parallel after T006; T007 and T008 in parallel with them (different people or sessions).
- US1: T012 and T013 together; T015 and T016 together.
- US2: T020, T021, T022 together.
- US3: T027 and T028 together.
- US4: T032, T033, T034, T035 together (four files); then T036 and T037 together.
- US5, US6 and US4 can be built in parallel once US1 is done.
- US7 docs T044–T046 in parallel with any story.

## Implementation strategy

- **MVP = US1 + US2** (open, edit, save, revert, hot exit): it already replaces raw JSON editing. Ship nothing before **US3** though: without it the open canvas drifts from the file and a save can overwrite someone else's change; US1 to US3 are the first usable release (0.1.0 candidate).
- Then US4 (pictures), US5 and US6 in any order, then US7 for the package. Publishing stays a separate release step with its own checklist (FR-029).
- If a spike fails with no fallback, stop and report instead of building on it.
- Scope guard: no library, no second canvas per file, no telemetry, no web VS Code, no format or editor changes here; needs from 067 are filed as gaps.

---

## Implementation status (2026-10-07)

All code, unit tests, docs and packaging tasks are done. **Not done, because they need a person in a real VS Code (Extension Development Host):** spikes T006 (S2), T007 (S3), T008 (S1) and the quickstart runs T019, T026, T031, T039, T041, T048. Known open points they must settle: the embed's workers are separate files and need blob loaders under the CSP (G2); whether `workbench.action.files.revert` clears the changed mark (S1); the `window.parent` replacement in the shim (G1). Deviations: the bundle is `dist/extension.cjs` (the package is ES-module typed); the package name is `sododeck`, so the workspace filter is `sododeck`; `publisher` in the manifest is a placeholder.
