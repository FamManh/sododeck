# Tasks: Embed the editor in a host program

**Input**: Design documents from `specs/067-embed-host-protocol/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md) (5 clarifications), [research.md](research.md) (R1–R15), [data-model.md](data-model.md), [contracts/host-protocol.md](contracts/host-protocol.md), [contracts/app-embed.md](contracts/app-embed.md), [quickstart.md](quickstart.md)

**Tests**: Required by the constitution (Principle VI) and FR-025: unit tests for pure code, component tests (roles and labels) for each story against the fake host, a round-trip case for the model op. Tests are written first and fail before the code that makes them pass. **No new e2e tests**; the smoke suite must stay green.

**Paths**: work in the worktree `../sododeck-067` (branch `067-embed-host-protocol`). Read `apps/app/CLAUDE.md`, `packages/model/CLAUDE.md` and `packages/ui/CLAUDE.md` before changing those packages. App paths below are relative to `apps/app/` unless they start with `packages/`, `docs/` or the repo root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 open in a host, US2 edits flow back, US3 outside changes, US4 pictures (needs 068), US5 abilities and version, US6 fake host

---

## Phase 1: Setup

- [x] T001 In `../sododeck-067`, rebase on the latest `origin/main`, run `pnpm install && pnpm --filter @sododeck/app test && pnpm --filter @sododeck/app build` for a green start; note the current `dist/` chunk list for later comparison (FR-022).
- [x] T002 Create the package skeleton `packages/host-protocol/` modelled on `packages/schema/`: `package.json` (`@sododeck/host-protocol`, `private`, `type: module`, `exports: { ".": "./src/index.ts" }`, scripts `lint` / `typecheck` / `test`, dependency `zod` with the same range as `packages/schema/package.json`, dev deps `@sododeck/config`, `eslint`, `typescript`, `vitest`), `tsconfig.json`, `eslint.config.js`, `vitest.config.ts` (jsdom environment for the window transports), empty `src/index.ts`. Add `"@sododeck/host-protocol": "workspace:*"` to `apps/app/package.json` dependencies; run `pnpm install`; `pnpm --filter @sododeck/host-protocol typecheck` passes.
- [x] T003 [P] Add `dist-embed/**` to the `build` task `outputs` in the root `turbo.json`, and `dist-embed` to `apps/app/.gitignore` (or the root `.gitignore` where `dist` is listed) and to the app's ESLint ignores in `apps/app/eslint.config.js`.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the protocol package (messages, transports, fake host) and an app refactor with **no behaviour change** that makes the editor shell storage-free. Web tests stay green after every task.

### Protocol package

- [x] T004 [P] Write failing tests in `packages/host-protocol/test/messages.test.ts`: every message type of `contracts/host-protocol.md` parses with `parseHostMessage` / `parseEditorMessage` from a valid example; unknown `type`, wrong field types, picture `id` not 64 lowercase hex, `seq` negative, `requestId` empty → `null`; unknown extra keys are stripped; `capabilities` with missing keys → `false`, extra keys dropped; `theme: 'sepia'` parses (read as light by the app); `bytes` must be a `Uint8Array`; `reason` longer than 300 characters is truncated.
- [x] T005 Implement `packages/host-protocol/src/messages.ts`: `PROTOCOL_VERSION = 1`, `Capabilities`, every message type, `editorMessageSchema` / `hostMessageSchema` as Zod discriminated unions on `type`, `parseEditorMessage` / `parseHostMessage` (`safeParse` → value or `null`). Export from `src/index.ts`. Make T004 pass.
- [x] T006 [P] Write failing tests in `packages/host-protocol/test/transports.test.ts`: `memoryTransportPair()` delivers asynchronously and as a copy (mutating the sent object after `send` does not change what arrives), `listen` returns an unlisten that stops delivery; `parentWindowTransport(win)` (jsdom, a fake parent with `postMessage` spy and dispatched `MessageEvent`s) ignores messages whose `source` is not the parent and invalid messages (one `console.warn` each), posts `ready` with target `'*'`, and after receiving a valid `init` from origin `https://host.test` posts every later message with target `https://host.test` only; `frameTransport(frame, origin)` accepts only `source === frame.contentWindow` and posts with `origin`.
- [x] T007 Implement `packages/host-protocol/src/transports.ts`: `Transport<Out, In>`, `memoryTransportPair` (`structuredClone` + `queueMicrotask`), `parentWindowTransport` (R3: source check, parse, origin pinned at the first valid `init`, sends nothing but `ready` before it — any other message before `init` is dropped with a `console.warn`), `frameTransport`. Export from `src/index.ts`. Make T006 pass.
- [x] T008 [P] Write failing tests in `packages/host-protocol/test/fake-host.test.ts` for `createFakeHost(transport, options)`: records `log` entries `{ dir: 'in' | 'out', message, at }`; on `ready` sends `init` from `options.text`, `theme`, `capabilities`, `protocolVersion` (default 1); answers each `change` with `change-result ok` (or `ok: false, reason` once after `refuseNextChange(reason)`; or no answer when `options.answerChanges === false`); `flush()` resolves when `flushed` with its `requestId` arrives; `sendExternal(text)`, `setTheme(scheme)`; pictures: `options.pictures` map answers `picture-get` with `picture` or `picture-missing`, `picture-put` with `picture-stored { path: 'assets/<name>' }` or `picture-store-failed` when `options.refusePictures`; `lastText()` returns the latest `change.text`.
- [x] T009 Implement `packages/host-protocol/src/fake-host.ts` and export it. Make T008 pass.
- [x] T010 [P] Write `packages/host-protocol/README.md` from `specs/067-embed-host-protocol/contracts/host-protocol.md` (normative text, examples for a minimal host) and `packages/host-protocol/CLAUDE.md` (responsibility, API, boundaries: no React, no Yjs, no `@sododeck/model`; zod only; messages carry file text).

### App refactor (no behaviour change)

- [x] T011 Create `src/editor/deck-services.ts`: `DeckServices` (`openLibrary(): void`, `duplicateDeck(): Promise<void>`, `importAsNewDeck(...)` with the exact signatures the current import dialogs and deck menu use) and `DeckServicesContext` (default `null`) + `useDeckServices()`. Move the library-backed implementation into `src/routes/web-deck-services.ts` (imports `storage/library-client`, `storage/library-db-instance`, `storage/library-ops`).
- [x] T012 Change `src/editor/shell/deck-menu.tsx`, `src/editor/import/import-dialog.tsx` and `src/editor/import/mermaid-import-dialog.tsx` to use `useDeckServices()` instead of importing storage; when it is `null`, the items "Open library", "Duplicate", and every "import as a new deck" path are not rendered. Update their existing tests to provide the context (web behaviour unchanged); add one test per file that with `null` those items are absent (by role/name).
- [x] T013 Create `src/editor/embed-host-context.ts`: `EmbedHostContext` (default: web behaviour) with `useOpenLink(): ((href: string) => void) | null` (default: `lib/links.ts` `openLink`) and `useSaveFile(): ((name: string, blob: Blob) => void) | null` (default: `storage/download.ts` `downloadBlob`). Use `useOpenLink` in `src/editor/card-fields-block.tsx` and `src/editor/fields/links-field.tsx` (replace `target="_blank"` anchors by a button/link that calls it; `null` → text plus the existing copy action, no open action) and `useSaveFile` in `src/editor/export/export-dialog.tsx` and the deck menu's download (`null` → those actions not rendered; clipboard copies stay). Tests: with the default context, existing tests stay green; with `null`, the open and download actions are absent.
- [x] T014 Extract `EditorShell`, `EditorChrome` and `CanvasScreen` from `src/routes/editor-page.tsx` into `src/editor/editor-shell.tsx` with props `{ doc, save: SaveControls, pictures: PictureStore, services: DeckServices | null, host?: EmbedHostValue, extras?: ReactNode, deckKey: string | null }` (contracts/app-embed.md); it must import nothing from `src/storage/` except `origins` and `save-status`. `editor-page.tsx` keeps `deckLoader` data handling, `useSaveControlsFor`, `sweepBlobs`, `DeckDeletedDialog` (as `extras`) and provides `web-deck-services`. `src/routes/editor-page.test.tsx` stays green unchanged.
- [x] T015 [P] In `src/editor/save-context.ts` add `'host'` to `SaveMode`. In the top bar / shell chrome save indicator component, render nothing when `mode === 'host'`; ⌘S calls `save.flush()` as today. Hide the theme toggle when `mode === 'host'`. Component test: host mode shows no "Saved"/"Saving" text and no theme toggle.
- [x] T016 [P] In `src/theme/theme-store.ts` add `setThemeFromHost(scheme: unknown)`: `'dark'` → dark, anything else → light; applies the class and updates the store; never touches `localStorage`. Unit test with a `localStorage` spy.
- [x] T017 [P] Create `src/embed/host-origin.ts` (`hostOrigin`, frozen `{ provider: 'sododeck-host' }`) and make `isOwnUpdate` in `src/storage/origins.ts` return false for it; extend `storage/origins` tests.
- [x] T018 [P] In `src/lib/features.ts`, make `supportsWorkers()` also return false when a test construction of a module worker throws (cache the result), per R14; unit test with a throwing `Worker` stub.

**Checkpoint**: `pnpm --filter @sododeck/app test && pnpm --filter @sododeck/app build` green; the web app behaves exactly as before.

---

## Phase 3: User Story 1 - Open a deck file in a host (P1) 🎯 MVP

**Goal**: a host loads the embed, sends a file, theme and abilities; the editor shows the deck, nothing else.

**Independent test**: render `EmbedApp` with a memory transport and the fake host: `ready` then `init`, the canvas shows the sample; no library, home, new/open/import-file controls; dark theme applies and switches.

- [x] T019 [P] [US1] Write failing component tests in `src/embed/embed-app.test.tsx` (memory transport + `createFakeHost`): (1) the editor sends `ready { protocolVersion: 1 }` on mount; after `init` with a sample deck text, the deck's component titles are visible on the canvas; (2) `theme: 'dark'` sets the dark class, a later `theme { scheme: 'light' }` removes it without remounting the canvas; (3) no control named "Open library", "New deck", "Open deck", "Import deck file", "Duplicate"; (4) `init` with `text: ''` shows an empty deck and the first edit (via the editor API) produces a `change` whose text validates with `@sododeck/model` `inspectDeckText`; (5) `init` with an invalid deck shows an alert listing the problem (e.g. the dangling reference) and no canvas, and no `change` is ever sent; (6) no `init` within 10 s (fake timers) → status "The program hosting this editor did not send a deck"; a later `init` still opens the deck.
- [x] T020 [P] [US1] Create `src/embed/embed-store.ts` (Zustand, data-model "Embed state": `phase`, `fatal`, `problems`, `capabilities`, `hostError`, actions) with unit tests in `src/embed/embed-store.test.ts` for every transition in data-model.md.
- [x] T021 [US1] Create `src/embed/embed-notices.tsx`: waiting (`role="status"`, spinner + "Opening deck…"), slow (status text from T019), fatal (`role="alert"`, side-specific text from R12), problems (`role="alert"`, "This deck file has problems, so it is shown as it was. Fix the file to keep editing here." + the 062 problem entries via `src/editor/import/import-report-panel.tsx` in read-only form). Tokens only (no hard-coded colours).
- [x] T022 [US1] Create `src/embed/embed-app.tsx`: `EmbedApp({ transport })` — sends `ready`, handles `init` (version check → R12 later in US5; theme via `setThemeFromHost`; capabilities into the store), builds the doc with `@sododeck/model` (`createDeck()` for empty text, else `applyDeckText` on a fresh empty doc with `hostOrigin`, so the open path and the outside-change path are the same code), renders a `createMemoryRouter` with `/deck/:deckId` (+ `rules/:ruleId?` child, lazy `RulesPage`) at initial entry `/deck/host`, whose element is `EditorShell` with `save = { mode: 'host', flush, markExported: noop }`, `pictures = memoryPictureStore()` (replaced in US4), `services = null`, the host context from T013 with `openLink: null`, `saveFile: null` (filled in US5); runs `freeLegacyStickies` / `fitMissingFrames` like the web shell (untracked). Make T019 pass.
- [x] T023 [US1] Create `embed.html` (root `#root`, `<script type="module" src="/src/embed/main.tsx">`, title "Sododeck", same font preloads as `index.html`) and `src/embed/main.tsx` (imports `./../index.css`, renders `<StrictMode><TooltipProvider><EmbedApp transport={parentWindowTransport()} /></TooltipProvider></StrictMode>`; no `initTheme`, `getLibraryDb`, `initTelemetry`).
- [x] T024 [US1] Create `vite.embed.config.ts` (R1: `root` = app dir, `base: './'`, plugins `react()` + `tailwindcss()` only, `define.__APP_VERSION__` as in `vite.config.ts`, `worker.format: 'es'`, `build: { outDir: 'dist-embed', target: 'es2022', sourcemap: false, rollupOptions: { input: 'embed.html' } }`) and set `apps/app/package.json` `build` to `vite build && vite build -c vite.embed.config.ts && node scripts/check-embed-bundle.mjs`.
- [x] T025 [US1] Create `scripts/check-embed-bundle.mjs`: reads every file in `dist-embed/`, fails (exit 1, listing file and marker) on any of `Dexie`, `workbox`, `serviceWorker.register`, `posthog`, `@sentry`, `sododeck:theme`, `indexedDB.open`; also fails when `dist-embed/embed.html` is missing or references an absolute `/assets/` URL. Run the build; fix any leak by moving the import behind `DeckServicesContext` (do not weaken the markers).

**Checkpoint**: US1 tests green; `pnpm --filter @sododeck/app build` produces `dist-embed/` and the check passes.

---

## Phase 4: User Story 2 - Edits flow back to the host as a file (P1)

**Goal**: each burst of edits reaches the host as one complete, valid, canonical file within 200 ms; flush; errors only when the host refuses or does not answer.

**Independent test**: with the fake host, move a card → one `change` within 200 ms whose text has the new position; a burst → one message per 100 ms window; `flush` → pending `change` then `flushed`; refused → error with the reason, cleared on the next ok.

- [x] T026 [P] [US2] Write failing unit tests in `src/embed/host-persistence.test.ts` (fake timers, a test doc and editor): (a) one own edit → exactly one `send({ type: 'change', seq: 1, text })` 100 ms later, `text === serializeDeck(...)` of the doc; (b) edits at 0, 30, 60, 90 ms → one message at 100 ms with the latest state, a further edit at 120 ms → a second message at 220 ms, `seq` 2; (c) an update with `hostOrigin` or `storageOrigin` sends nothing; (d) `flush()` with a pending edit sends at once then resolves; with nothing pending resolves at once; (e) `handleResult({ seq, ok: false, reason })` calls `onError(reason)`; no result for 5 s → `onError('The program hosting this editor did not take the last change.')`; a later `ok` calls `onError(null)`; (f) undo of an edit sends the file without it; (g) `setBlocked(true)` drops the dirty flag and sends nothing until `setBlocked(false)` and a new edit.
- [x] T027 [US2] Implement `src/embed/host-persistence.ts` per contracts/app-embed.md and research R4/R11 (snapshot via `readDeck(doc)`; bytes via the async `pictureBytes(deck)` option, which `embed-app.tsx` sets to `readPictureBytes(pictureStore, deck)` from `src/images/read-pictures.ts`, so pictures added before US4 are embedded in the file; the send awaits it and re-checks the dirty flag). Make T026 pass.
- [x] T028 [US2] Wire it in `src/embed/embed-app.tsx`: attach after the doc is built, `send` = transport, route `change-result` to `handleResult`, `flush { requestId }` → `await flush()` then send `flushed { requestId }`; `onError` → `embed-store.hostError`, shown by a `role="alert"` banner in `embed-notices.tsx` with the reason; `save.flush` = persistence flush. Component tests in `src/embed/embed-app.test.tsx`: move a card (via keyboard nudge on a selected card) → fake host `lastText()` has the new position and validates; `refuseNextChange('Disk full')` + edit → alert "Disk full"; next edit clears it; `fakeHost.flush()` resolves after the pending change arrives; no "Saved" text anywhere.
- [x] T029 [US2] Timing check for SC-002 in `src/embed/host-persistence.perf.test.ts` (same pattern as `src/storage/deck-persistence.perf.test.ts`): on the bench generator's 500 / 1,000 deck, one edit → the `change` is produced ≤ 200 ms after the edit with real timers (allow CI slack as that file does); record the measured time in the test output.

**Checkpoint**: US1 + US2 green.

---

## Phase 5: User Story 3 - Outside changes appear in place (P1)

**Goal**: `external-change` merges with 066, keeps selection and viewport, is never echoed; stale own echoes are ignored; invalid files block editing until fixed.

**Independent test**: select a card, the fake host renames another component → title updates, selection and viewport stay, no `change` follows; an invalid file → alert + `inert` editor + no `change`; a valid file → editable again.

- [x] T030 [P] [US3] Write failing unit tests in `src/embed/host-persistence.test.ts` for `applyExternal(text)`: (a) a text equal to one of the last 8 sent → `'echo'`, doc untouched; (b) a sent text older than the last applied outside change is no longer treated as echo; (c) a valid different text → `ApplyResult` applied, observers see `origin: 'remote'`, nothing is sent afterwards (advance timers); (d) a pending own edit to another object survives the merge and is sent with the merged state; (e) an invalid text → `{ status: 'refused' }`, doc unchanged.
- [x] T031 [US3] Implement `applyExternal` and the `recentSent` ring (≤ 8, cleared on an applied outside change) in `src/embed/host-persistence.ts`. Make T030 pass.
- [x] T032 [P] [US3] Write failing component tests in `src/embed/embed-app.test.tsx`: (1) select a card, `sendExternal` with another component renamed → the new title is visible, the card is still selected (`aria-selected`/selected state by role), the React Flow viewport transform is unchanged, and the fake host log has no `change` after it (advance 500 ms); (2) the user edits, then an outside change, then undo → only the user's edit is undone; (3) `sendExternal(lastText())` → nothing changes, nothing sent; (4) `sendExternal(invalid)` → alert with the problem text, the editor region has the `inert` attribute, a keyboard delete on the selected card does nothing, no `change` is sent, `fakeHost.flush()` resolves at once; (5) then `sendExternal(valid)` → alert gone, `inert` removed, editing sends `change` again; (6) a second `init` with a different file is merged like `external-change`.
- [x] T033 [US3] Wire `external-change` (and a repeated `init`) in `src/embed/embed-app.tsx`: `applyExternal` → `'echo'`: nothing; refused → `embed-store` `blocked` with `entries`, `persistence.setBlocked(true)`; applied → `setBlocked(false)`, clear problems, put `result.bytes` into the picture store. Wrap the `EditorShell` in a container with `inert={phase === 'blocked'}` and render the problems notice above it. For a refused `init`, store the problems and open the deck on the first valid `external-change`. Make T032 pass.

**Checkpoint**: all P1 stories green — this is the shippable core for 069.

---

## Phase 6: User Story 5 - A host that does less, or a different protocol version (P2)

**Goal**: only what the host can do is offered; links and exports go through the host; a version mismatch stops with a clear message; Mermaid only by paste.

**Independent test**: capabilities off → no open-link and no download actions; on → `open-link` / `export-file` messages and no frame navigation; `protocolVersion: 2` → "This editor needs an update", no deck.

- [x] T034 [P] [US5] Write failing component tests in `src/embed/embed-capabilities.test.tsx`: (1) `openLinks: false` → a card's link shows its text and a copy action, no "Open link" action; (2) `openLinks: true` → activating the link sends `open-link { href }` and `window.open` / location are never called (spies); (3) `exportFiles: false` → the export dialog has no download/save actions and the deck menu has no download; clipboard copy stays; (4) `exportFiles: true` → exporting a PNG sends `export-file { name, mime: 'image/png', bytes }`; (5) `init.protocolVersion: 2` → alert "This editor needs an update", no canvas, `fatal { code: 'protocol-version' }` sent once, later `external-change` ignored; `protocolVersion: 0` → the alert names updating the extension or plug-in; (6) the Mermaid import dialog has a paste box and no file chooser (no "Choose file"/file input), and pasting a flowchart adds it to the open deck.
- [x] T035 [US5] In `src/embed/embed-app.tsx`, provide `EmbedHostContext` from capabilities: `openLink` → send `open-link` (only for links accepted by `parseLinkInput`), `saveFile` → `blob.arrayBuffer()` → send `export-file`; `null` when the capability is off. Implement the version check of R12 (send `fatal`, `embed-store.fatal`).
- [x] T036 [US5] In `src/editor/import/mermaid-import-dialog.tsx`, hide the file chooser when `useSaveControls().mode === 'host'` (paste only, clarification Q5). Make T034 pass.

---

## Phase 7: User Story 6 - Try and test the contract without a real host (P2)

**Goal**: a dev-only page to drive the embed by hand; absent from production.

**Independent test**: `pnpm dev`, `/embed-host` works per quickstart steps 1–5, 7, 9; the production `dist/` has no `embed-host` chunk.

- [x] T037 [US6] Create `src/routes/embed-host-page.tsx`: an iframe of `/embed.html`, `createFakeHost(frameTransport(iframe, location.origin), …)`; controls (labelled, keyboard-operable, tokens only): sample picker (from `src/samples/`), paste box + "Send as outside change", scheme toggle, capability checkboxes (open links, export files, pictures), protocol version number, "Simulate outside change" (renames the first component of `lastText()` to "<title> (edited outside)"), "Refuse next change", "Stop answering changes", "Flush", picture answers (stored / failed / missing); a message log table (direction, type, size, time since previous) and "Reload editor" (recreates the iframe and re-sends `init` with current settings).
- [x] T038 [US6] Register `/embed-host` in `src/app/router.tsx` inside the existing `import.meta.env.DEV` block, next to `/design`. Component test `src/routes/embed-host-page.test.tsx`: renders the controls and an iframe titled "Embedded editor". After `pnpm --filter @sododeck/app build`, verify (in the T025 script or a separate check in the same script) that no file in `dist/` contains `embed-host-page` (FR-024).

---

## Phase 8: User Story 4 - Pictures through the host (P2) — after 068 is merged

**Goal**: with the `pictures` ability, the host stores picture bytes and the file records their paths; without it, pictures stay embedded.

**Independent test**: fake host with pictures on: add an image → `picture-put`, `picture-stored`, next `change` has `path` and no `data`; reopen → `picture-get` → shown; missing → missing look with reason; pictures off → `change` embeds `data`.

- [ ] T039 [US4] Rebase on `origin/main` after 068 is merged; `pnpm install`; all tests green.
- [ ] T040 [P] [US4] Write failing tests in `packages/model/test/picture-path.test.ts`: `editor.setPicturePath(id, 'assets/a.png')` writes `meta.assets[id].path`, `serializeDeck` then has `path` and no `data` for it, `loadDeck` of that text gives an equal deck (round-trip); it is not undoable (`canUndo()` false after it alone) and does not end a typing burst; equal value → no change event; invalid path (`/abs.png`, `a\\b.png`) → `DeckEditError` `invalid`; unknown id → `not-found`; `null` removes the path.
- [ ] T041 [US4] Implement `setPicturePath` in `packages/model/src/ops/images.ts` (untracked origin, validate with 068's `checkPicturePath` from `@sododeck/schema`), expose it on `DeckEditor` in `packages/model/src/editor.ts`; add it to `packages/model/CLAUDE.md` ("Added by 067"). Make T040 pass.
- [ ] T042 [P] [US4] Write failing unit tests in `src/embed/host-picture-store.test.ts`: pictures off → `put` keeps bytes in memory, sends nothing, `getBytes` returns them; pictures on → `put` sends `picture-put` with id, type, name, bytes; `receive(picture-stored)` calls `onStored(id, path)`; `receive(picture-store-failed)` calls `onFailed(id, reason)` and the bytes stay; `get(id)` without bytes sends one `picture-get` (two concurrent gets → one message) and resolves with a `Blob` on `picture`, `null` on `picture-missing` or after 10 s; `missingReason(id)` returns the host's reason.
- [ ] T043 [US4] Implement `src/embed/host-picture-store.ts` (contracts/app-embed.md, R7). Make T042 pass.
- [ ] T044 [US4] Wire it in `src/embed/embed-app.tsx`: picture store from capabilities; `result.bytes` of `init` / `external-change` into it; `onStored` → `editor.setPicturePath(id, path)` (a path failing `checkPicturePath` → treated as `onFailed` with "The host gave an invalid picture path."); `onFailed` → toast "Picture kept inside the deck file: <reason>"; host-persistence `pictureBytes` = bytes for pictures **without** a `path`. Show the host's missing reason through the existing missing-picture look (`src/images/use-picture-url.ts` / image node) — extend it to read a reason from the store if 068 has not already.
- [ ] T045 [US4] Component tests in `src/embed/embed-pictures.test.tsx` (fake host): pictures on → paste an image file → log has `picture-put` then `picture-stored`, `lastText()` has `"path": "assets/…"` and no `data` for that id, the image renders; `init` with a deck naming a picture by path → `picture-get` → rendered; fake host answers missing → image shows the missing state with the reason; `refusePictures` → toast with the reason and `lastText()` embeds `data`; pictures off → `lastText()` embeds `data` and no picture messages are sent.

---

## Phase 9: Polish & cross-cutting

- [ ] T046 [P] No-network test (SC-005) in `src/embed/no-network.test.tsx`: stub `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`; run load, edit, outside change, export (PNG with `exportFiles`) and, if US4 is merged, picture flows with the fake host; assert zero calls.
- [ ] T047 [P] Write ADR `docs/decisions/0049-embeddable-editor-host-protocol.md` (context, decisions: iframe in every host (H1), separate embed build, whole-file messages with 100 ms window, origin pinning, echo ring, read-only on invalid files, host abilities, no "Saved" state, picture paths from the host, file as store in hosts — Principle IV note and the proposed constitution wording; consequences; alternatives from research.md). Renumber if 0049 is taken at merge time.
- [ ] T048 [P] Update docs: `AGENTS.md` repo map (`packages/host-protocol/`, `apps/app` embed entry) and dependency direction (`app → host-protocol`); `apps/app/CLAUDE.md` (embed entry and build, `DeckServicesContext`, `EmbedHostContext`, `SaveMode 'host'`, `/embed-host` dev page, bundle check); `docs/backlog-3.md` 067 status "implemented" with links (spec, tasks, ADR 0049) and a note that undo follows 066.
- [ ] T049 Run quickstart.md manual steps 1–9 in `pnpm dev` (step 6 only if US4 is merged) and take screenshots of the fake host page (loaded deck, blocked state, version mismatch) for the PR.
- [ ] T050 Full definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green; compare `apps/app/dist/` chunk list with T001 (no embed code in the web build beyond shared chunks; no `embed-host`); small Conventional Commits per phase (`feat(host-protocol): …`, `refactor(app): …`, `feat(app): 067 …`, `feat(model): …`, `docs: …`), no AI attribution lines; open the PR with the assumptions list.

---

## Dependencies & execution order

- **Phase 1 → Phase 2** → stories. Within Phase 2, the protocol package (T004–T010) and the app refactor (T011–T018) are independent of each other.
- **US1 (Phase 3)** needs Phase 2. **US2** needs US1 (the running embed). **US3** needs US2 (the persistence it extends). **US5** needs US1 only. **US6** needs US1 (more useful after US2/US3). **US4** needs US2 and **068 merged**.
- Suggested order: Setup → Foundational → US1 → US2 → US3 → US5 → US6 → (068 merged) US4 → Polish.

## Parallel opportunities

- Phase 2: T004/T006/T008/T010 (package, separate files) in parallel with T011–T013 and T015–T018 (separate app files); T014 after T011–T013.
- US1: T019 (tests) ‖ T020 (store) ‖ T021 (notices); then T022 → T023 → T024 → T025.
- US2: T026 ‖ T029 skeleton; US3: T030 ‖ T032 (different test files sections; coordinate edits in `embed-app.test.tsx`).
- US4: T040 (model) ‖ T042 (app store).
- Polish: T046 ‖ T047 ‖ T048.

```text
# Example: Phase 2 kickoff, two agents
Agent A: T004 → T005 → T006 → T007 → T008 → T009 → T010   (packages/host-protocol)
Agent B: T011 → T012 → T013 → T014; T015–T018 in any order   (apps/app refactor)
```

## Implementation strategy

- **MVP = US1 + US2 + US3** (all P1): a host can open, edit and receive outside changes safely — enough for 069 to start against the fake host's contract.
- Then US5 (abilities, version) and US6 (dev page) — both small.
- US4 waits for 068; until then the embed keeps pictures in memory and embeds them in the file (US4 scenario 4 behaviour already holds with `memoryPictureStore`).
- Each phase ends green (`pnpm --filter @sododeck/app test`) and is its own commit set.
