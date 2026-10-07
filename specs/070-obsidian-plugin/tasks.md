# Tasks: Sododeck in Obsidian

**Input**: Design documents from `specs/070-obsidian-plugin/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md) (clarified 2026-10-07), [research.md](research.md) (R1–R14, G1–G3, S1–S5), [data-model.md](data-model.md), [contracts/markdown-form.md](contracts/markdown-form.md), [contracts/obsidian-host.md](contracts/obsidian-host.md), [quickstart.md](quickstart.md). Contract with the editor: `specs/067-embed-host-protocol/contracts/host-protocol.md`. Picture rules: `specs/068-picture-file-refs/contracts/contracts.md`.

**Gate**: 066, 067 and 068 are merged on `main` (checked in T001). 069 is **not** a dependency; if its `apps/vscode` lands first, reuse its fake editor and pure helpers instead of copying (T012 says how).

**Tests**: required by the constitution (Principle VI) and spec FR-040: unit tests for every pure module, the Markdown form by round-trip corpus and properties, the host session against a scripted fake editor on 067's `memoryTransportPair` with a fake vault; each written first and failing before the code that makes them pass. Glue that imports `obsidian` is kept thin and covered by the quickstart on desktop and phone. No new e2e (Principle VI); the smoke suite must stay green.

**Paths**: work in the worktree `../sododeck-070` (branch `070-obsidian-plugin`). Paths are relative to `apps/obsidian/` unless they start with `packages/`, `apps/app/`, `docs/`, `specs/` or are root files. Read `packages/model/CLAUDE.md` and `apps/app/CLAUDE.md` before touching what they own. Do not name other diagram or database tools in any repo file (AGENTS.md); describe the drawing-plugin behaviour studied in research only as "a widely used drawing plugin" if it must be mentioned.

**Split point**: the Markdown form in the model (T016–T017 and phase 4) plus the web-app tasks in phase 8 form **phase A** (model + web); the rest is **phase B** (plugin). If one PR is too large, ship A first (T016–T017, T026–T032 model parts, T045–T047, T049), then B.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 open, edit, autosave · US2 deck is part of the vault (readable text) · US3 follow the file · US4 pictures · US5 theme · US6 create, bring in and out · US7 install and trust

---

## Phase 1: Setup

- [ ] T001 In `../sododeck-070`, rebase on the latest `origin/main`. Gate: `packages/host-protocol/`, `packages/model/src/apply-file.ts` and `checkPicturePath` in `@sododeck/schema` exist; `pnpm --filter @sododeck/app build` produces `apps/app/dist-embed/embed.html`. Then `pnpm install && pnpm test && pnpm build` for a green start. Note the exported names later tasks use: from `@sododeck/host-protocol` (`PROTOCOL_VERSION`, `parseEditorMessage`, `parseHostMessage`, `memoryTransportPair`, `Capabilities`), from `@sododeck/model` (`serializeDeck`, `inspectDeckText`, `canonicalize`, `emptySododeckFile` via `@sododeck/schema`, `pictureFileEntry`, `assetId`), from `@sododeck/schema` (`checkPicturePath`, `PATH_VIOLATION_TEXT`). If a gate fails, stop and report; do not copy code from other branches.
- [ ] T002 Create the app skeleton `apps/obsidian/` modelled on `packages/skill/`: `package.json` (name `@sododeck/obsidian`, `private` true, scripts `build`, `lint`, `typecheck`, `test`; dependencies `@sododeck/host-protocol`, `@sododeck/model`, `@sododeck/schema` as `workspace:*`; devDependencies `@sododeck/config`, `@sododeck/app` (build order only, never imported), `obsidian` (type declarations only), `esbuild`, `eslint`, `tsx`, `typescript`, `vitest`, versions matching the repo), `tsconfig.json` (shared config, DOM lib, `obsidian` types), `eslint.config.js`, `vitest.config.ts`, `.gitignore` (`main.js`, `embed.single.html`), `manifest.json` and `versions.json` per `contracts/obsidian-host.md` (version `0.1.0`, `minAppVersion` `1.5.7`), empty `styles.css`. The one new dev dependency (`obsidian` typings) is justified in ADR 0052 (T055). Ask the founder before adding any runtime dependency (none planned).
- [ ] T003 [P] Add `main.js`, `manifest.json`, `styles.css` as `build` outputs of the new workspace in root `turbo.json` (keep existing outputs); update `AGENTS.md` repo map and dependency direction (`apps/obsidian/` Obsidian plugin → host; `obsidian → host-protocol`, `obsidian → model → schema`; the plugin copies `apps/app`'s embed build and imports nothing from it) and the model line ("also the `.sododeck.md` form").
- [ ] T004 [P] Write failing tests in `test/check-bundle.test.ts` for `checkBundle(files)` per the guard in `contracts/obsidian-host.md` ("Bundle guard"): fails on `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts(` with a URL, analytics markers, the embed's forbidden markers, an absolute `src`/`href` in the inlined HTML, a remote `http(s):` URL outside comments/license text, a `main.js` over the budget constant, or a release folder with files other than `main.js`, `manifest.json`, `styles.css`; passes on a clean fixture. Implement `scripts/check-bundle.ts` (exports `checkBundle`, runnable after build).
- [ ] T005 Create `scripts/inline-embed.ts`: reads `../app/dist-embed/embed.html` and its assets and writes one self-contained `embed.single.html`: scripts and styles inlined, fonts and images as data URLs, every worker turned into a blob loader built from its inlined source (a small `new Worker(URL.createObjectURL(new Blob([src])))` wrapper replacing the `new URL(…, import.meta.url)` form), the CSP `<meta>` from `contracts/obsidian-host.md` added. Fails with a clear message if `dist-embed` is missing or any asset cannot be inlined. Failing test first in `test/inline-embed.test.ts` on a fixture embed folder (inlining, worker wrapper, no remaining relative `src`/`href`, CSP present). File gap G1 against 067 in `research.md` if its build can produce this directly.
- [ ] T006 Create `scripts/build.ts`: runs `inline-embed`, bundles `src/main.ts` with esbuild to `main.js` (CommonJS, ES2022, platform browser, `obsidian` and `electron` external, the single HTML imported as a text string, minified, no source map), then `check-bundle`. Add the `build` script (`tsx scripts/build.ts`). Record the first size in `research.md` and set the budget constant (target ≤ 12 MB, R3).

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the real-app spikes, the test doubles, the format wrapper in the model, the frame. Nothing below needs a story to exist.

### Spikes (manual, in a throwaway vault on desktop **and** a phone; record results in `research.md` under "Spike results" with numbers)

- [ ] T007 Spike S2: a minimal plugin view with the built `embed.single.html` in `iframe.srcdoc` under `sandbox="allow-scripts"` and the CSP of R3. Check: the deck shows; blob workers run in the opaque-origin frame; fonts load; no CSP violation; a 5 MiB `Uint8Array` crosses `postMessage` both ways intact; keyboard, touch and text paste work in the frame; the 500-node bench deck loads in ≤ 2 s on desktop and a 100-node deck in ≤ 5 s on a mid-range phone (SC-001); `main.js` size and plugin load time. Apply the fallbacks of R3 in order if something fails (add `allow-same-origin`; run without workers; desktop-only) and tell the founder before taking the last one.
- [ ] T008 Spike S3: a `TextFileView` subclass logging `setViewData`, `getViewData`, `save`, `onUnloadFile`. Check: `save()` writes immediately when called directly; an external change to the open file calls `setViewData(data, false)` and with which text; whether our own write also calls it (echo); what happens to `data` during an in-flight save; the order of events on close. Record whether the view needs a guard flag (R4/R9).
- [ ] T009 Spike S1: for a note with `sododeck-plugin: parsed`, swap the Markdown view for the view type on `file-open`, `active-leaf-change`, `layout-ready` and `layout-change`; measure the visible flash; restore a workspace with 5 deck tabs; test on the phone. Test the opt-out state flag and the marker removed (R2). Record the final event set; apply the fallback of R2 if needed.
- [ ] T010 Spike S4: write a note with a picture list line `- [[x.png]] %%<64 hex>%%` and a `%% … %%` JSON comment block; with "Automatically update internal links" on, move and rename the picture and the note: is the link rewritten? Also: how reading view, live preview, outline and search show `%%id%%` heading markers and the comment block; does a `[[link]]` inside the list item register in backlinks and the resolved-links map. If markers show in the outline, try an alternative marker place (end of the following line) and update `contracts/markdown-form.md` before T016.
- [ ] T011 Spike S5: create a file with the marker through the vault API and read `metadataCache` frontmatter immediately and after `changed`; deliver one by file copy (as a sync would). Record the delay. Implement the fallback of research S5 (read the first 200 bytes) only if the cache is empty for a noticeable time.

### Test doubles and shared pieces

- [ ] T012 [P] Create `src/ports.ts` (interfaces only: `VaultFilePort` (read text, write text, read binary, create binary, exists, resolve link text, available attachment path, link text for a file, on-vault-event), `ThemePort`, `SettingsPort`, `UiPort` (`notice`, `showErrorPane`), `ClockPort`) and `test/fake-editor.ts`: a scripted editor on `memoryTransportPair` with helpers `ready()`, `sendChange(text)`, `answerFlush()`, `recorded()`, `putPicture(...)`, `getPicture(id)`. If `apps/vscode/test/fake-editor.ts` exists on `main`, move the shared part to `packages/host-protocol` first (ask the founder: it is a package API change) instead of copying. Self-test: every message the fake sends passes `parseEditorMessage`.
- [ ] T013 [P] Create `test/fake-vault.ts`: in-memory files and folders, `TFile`-like records, modify/create/rename/delete events with a controllable clock, `getFirstLinkpathDest` with the app's behaviour (full path, folder-relative, shortest unique name), `fileToLinktext`, `getAvailablePathForAttachment` (configurable location, numbered dedupe), and a switch "update links on rename" that rewrites `[[link]]` text in notes. Tests for the fake itself in `test/fake-vault.test.ts` (it is the oracle for later tests).
- [ ] T014 [P] Failing tests then implementation of `src/vault-guard.ts` (pure): `joinInVault(deckPath, rel)` → normalised vault path or a refusal with a plain reason for: leading `..` past the root, absolute path, drive or scheme (`:`), backslash, empty; `reasonText(violation)` using `PATH_VIOLATION_TEXT` from `@sododeck/schema`. Cases: `../a.png` inside, `../../../x.png` from depth 1 refused, `/etc/x` refused, `C:\x` refused, `a/../b.png` refused by `checkPicturePath` (inner parent).
- [ ] T015 [P] Create `src/frame.ts` (glue over DOM, tested with jsdom where possible): `createFrame(container, html)` builds the `iframe` (`srcdoc`, `sandbox="allow-scripts"`, `title="Sododeck canvas"`, full size), returns `{ transport: Transport<HostMessage, EditorMessage>, destroy() }` whose `listen` accepts only `event.source === iframe.contentWindow` and `parseEditorMessage`-valid data, and whose `send` posts to `contentWindow` with target origin `'*'`. Tests: messages from another source or invalid shape are dropped; `destroy` removes the iframe and listeners.

### Format wrapper in the model (phase A foundation; the readable part is US2)

- [ ] T016 Write failing tests in `packages/model/test/markdown-form.test.ts` for the **wrapper** half of `contracts/markdown-form.md`: `isDeckMarkdown` (marker present, absent, marker only in body, CRLF, BOM); `toMarkdown(deckText)` produces front matter + owned region + deck block (no readable part yet) and `fromMarkdown` returns the same canonical `deckText` for every sample deck in `apps/app/src/samples/` and a corpus of edge decks (empty, huge, embedded pictures, titles with `%%`, backticks and fences in JSON strings); `%%` inside the block is escaped `%\u0025` and restored; a fence one backtick longer than the longest run is used; `previous` keeps text before `begin`, text after `end` and other front matter keys byte for byte; `toMarkdown(t, toMarkdown(t))` equals `toMarkdown(t)`; failure entries `md-no-marker`, `md-no-deck-block`, `md-deck-block-not-json`, `md-two-deck-blocks` with plain messages; a deck block that parses but is not a valid deck is returned (not a failure). Marker only (empty region) reads as the empty deck text.
- [ ] T017 Implement `packages/model/src/markdown-form.ts` (wrapper half) and add the four problem codes with messages in `packages/model/src/problem-codes.ts` following the existing pattern; export `MARKER_KEY`, `MARKER_VALUE`, `isDeckMarkdown`, `toMarkdown`, `fromMarkdown`, `FromMarkdown` from `packages/model/src/index.ts`. The module imports nothing from Yjs (add a test that fails if it, or anything it imports, reaches `yjs`: resolve the import graph in the test). Budget test: 500-node deck ≤ 50 ms each way.

**Checkpoint**: `pnpm --filter @sododeck/model test`, `pnpm --filter @sododeck/obsidian test` and `typecheck` green; spikes S1–S5 recorded; G1–G3 filed or marked unnecessary; any spec or contract change from a spike made and the founder told.

---

## Phase 3: User Story 1 - Open a deck from the vault and edit it, saved automatically (P1) 🎯 MVP

**Goal**: `.sododeck` and `.sododeck.md` files open as the canvas, edits reach the file within a second, close and background lose nothing.

**Independent test**: with the fake editor and fake vault: `ready` → `init`; `change` → write within one second and `change-result`; flush on close; empty and invalid files. In the app: quickstart C1, C2 on desktop and phone.

### Tests (write first)

- [ ] T018 [P] [US1] Write failing tests in `test/file-codec.test.ts`: plain: `decode`/`encode` are identity (canonical JSON never reformatted); markdown: `decode` = `fromMarkdown`, `encode` = `toMarkdown(deckText, previousFileText)`; kind chosen by file path (`.sododeck.md` → markdown, `.sododeck` → plain); a decode failure returns the entries.
- [ ] T019 [P] [US1] Write failing tests in `test/host-session.test.ts` (pure session on the fake editor and fake vault): `ready` → `init { text, theme, capabilities, protocolVersion: 1 }`; empty file (plain: empty or whitespace; markdown: marker only) → empty deck, **no write** (US1-6, FR-004, FR-009); invalid deck text → `init` still sent (the canvas shows problems), nothing written (FR-004); version mismatch → no deck content, nothing written, a notice naming the side (FR-005); `change` → exactly one write containing the encoded text, then `change-result { ok: true }`, within 1 s on the fake clock; a burst of 20 `change`s with the first write in flight → at most two writes and the last text is the file (FR-006, SC-013); a `change` whose encoded text equals the file → no write but `ok: true` (FR-013); opening, `theme` and merging an outside change never write (FR-009); write rejection → `change-result { ok: false, reason }`, a notice, text kept pending and retried on the next `change` and on `flush` (FR-010); malformed and unknown messages ignored without any effect (FR-035); a message from a source that is not the frame never reaches the session.
- [ ] T020 [P] [US1] Write failing tests in `test/host-flush.test.ts`: unload, close, `visibilitychange` to hidden and app quit each send `flush`, wait for `flushed` (fake clock 1.5 s timeout, then continue with the last known text and show a notice), write the pending text, then close; an edit sent in the last moment before close is in the file (FR-008, SC-002); after close nothing is sent or written; a second `flush` while one is waiting does not double-write.

### Implementation

- [ ] T021 [US1] Implement `src/file-codec.ts` (T018 green).
- [ ] T022 [US1] Implement `src/host-session.ts` (T019 and T020 green): the state of `data-model.md`; serialised writes with newest-wins queueing; ack after the write; no timers longer than the editor's own batch; capabilities computed from the setting and file kind (US4 fills pictures; here `pictures: false`, `openLinks: false`, `exportFiles: false`); theme read through `ThemePort` (US5 fills the event). Add `src/settings.ts` (pure part: defaults and `pictureStorage` validation) now so the session can read it.
- [ ] T023 [US1] Implement the glue `src/deck-view.ts` (a `TextFileView`, `VIEW_TYPE = 'sododeck'`): creates the frame in `onOpen`, builds the session with `obsidian-ports.ts` adapters, `setViewData` → decode + `init`/outside change (US3 completes), `getViewData` → last text, `onUnloadFile`/`onClose`/`visibilitychange`/`quit` → flush, `clear()` destroys the frame, a decode failure shows an error pane with the problems and an "Open as Markdown" action (FR-004). Add `src/obsidian-ports.ts` (the `VaultFilePort`, `ThemePort`, `UiPort` over `app.vault`, `fileManager`, `metadataCache`, `Notice`) and `test/fake-obsidian.ts` (minimal stub) with a glue test that the view wires `ready` → `init` and a `change` → `vault.modify` once.
- [ ] T024 [US1] Implement `src/main.ts` (Plugin): load/save settings, `registerView(VIEW_TYPE, …)`, `registerExtensions(['sododeck'], VIEW_TYPE)` (FR-007 plain), minimal command registration placeholder removed later by US6. Build with `pnpm --filter @sododeck/obsidian build`, copy to a clean vault, and run quickstart C2 (plain `.sododeck`: lists, opens, edits, autosaves to plain JSON) on desktop and phone.
- [ ] T025 [US1] Implement `src/md-swap.ts` (glue, applying spikes S1/S5): `isDeckNote(file)` through `metadataCache` frontmatter; swap on the events chosen in T009 via `leaf.setViewState({ type: VIEW_TYPE, state: { file: path } })`; opt-out when the leaf state has `sododeckSource: true`; swap back when the marker is removed; commands "Open this deck as Markdown" and "Open this deck as canvas" (R2). Unit tests with the fake obsidian for the decision function (`shouldSwap(file, leafState)`) including ordinary notes, marker removed, opt-out. Run quickstart C1 (markdown deck: open, edit, autosave, close after an edit) on desktop and phone.

**Checkpoint**: US1 works on both file kinds on desktop and phone; quickstart C1–C2 recorded.

---

## Phase 4: User Story 2 - The deck is part of the vault: search, backlinks, text editing (P1)

**Goal**: the readable part exists, is searchable and linkable, and edits to titles and notes are read back by id.

**Independent test**: `pnpm --filter @sododeck/model test -- markdown-form` (corpus, properties); in the app: quickstart C3.

### Tests (write first)

- [ ] T026 [P] [US2] Write failing tests in `packages/model/test/markdown-readable.test.ts` for the readable half of `contracts/markdown-form.md`: `toMarkdown` emits, for the sample decks, the headings, marker lines and bodies of the table (every kind and field), in the deck's own order; absent optional fields write no marker line, `""` writes an empty body; the picture list line for a `path` asset is `- [[path]] %%id%%` and for an embedded asset `- name %%id%%`; **reading** applies title and body edits by id (change one title → exactly that field changes in `deckText`; property over every row of the table), readable wins over the block on disagreement, an invalid new value (empty required title or sticky text) is ignored, a deleted heading or marker line changes nothing, a present empty body clears an optional field, unknown ids and headings without markers are ignored, the picture list link overrides `assets[id].path` only when it passes `checkPicturePath`, link alias and subpath are stripped; `edited` is true only when a value differs.
- [ ] T027 [P] [US2] Write failing tests in `packages/model/test/markdown-escaping.test.ts`: the escaping table of the contract (`%%`, body lines starting with `#`, region-closing look-alikes, title line breaks as `<br>`, `&#37;` literal) round-trips; property test over generated strings (letters, spaces, `%`, `#`, `\`, backticks, `<br>`, `&#37;`, newlines for bodies, unicode) for every prose field: `fromMarkdown(toMarkdown(deckWith(s)))` returns `s`; a body that contains `%% sododeck:end %%` cannot close the region.
- [ ] T028 [P] [US2] Write failing tests in `packages/model/test/markdown-user-text.test.ts`: text before `begin` and after `end`, extra front matter keys and **foreign blocks** (an extra heading and paragraphs inside the region) survive 10 write/read cycles with edits in between; a foreign block after a marked item stays after it; one before any marked item stays at the top; the user's own paragraph inside an object's body is read into that field (and written back as part of it); a deck with no `previous` writes empty outside text.
- [ ] T029 [P] [US2] Write a failing schema-sync test in `packages/model/test/markdown-fields-sync.test.ts`: the table of (kind, field) pairs exported by `markdown-form.ts` covers every field that `text-fields.ts` / the schema marks as markdown or `Text` prose, except an explicit ignore list with a reason each (for example `links[].label`, `FieldDef.name`); adding a prose field to the schema without updating the table fails this test.

### Implementation

- [ ] T030 [US2] Implement the readable half of `packages/model/src/markdown-form.ts` per the contract: one exported constant `READABLE_FIELDS` (kind, collection path, title field, body fields) used by writer, reader and T029; the owned-region writer and reader as a small line-based state machine (marker lines, headings, bodies, foreign blocks); the escaping functions; picture list read-back with `checkPicturePath`. T026–T029 green; budget ≤ 50 ms for the 500-node deck each way (re-run the T017 test).
- [ ] T031 [US2] Wire the session to the readable part: `file-codec.ts` already calls the model; add the test `test/host-markdown.test.ts` (session + fake vault): a text edit of a card title in the note (a vault modify) reaches the canvas as `external-change` with the new title and nothing else changed; a canvas edit then writes the note keeping the user's paragraph outside the region; an edit that changes only text outside the region sends nothing and writes nothing (R9 edge). Fix any gap found.
- [ ] T032 [US2] Update `docs/decisions/0051-deck-markdown-form.md` draft with the decisions made so far (marker, region, escaping, readable-wins, why plain JSON and not compressed, why no Markdown parser); finish it in T055. Run quickstart C3 on desktop (search finds a card title, backlinks list a linking note, the outgoing links of a card note appear, text edit reads back, own paragraph kept) and record the outline/search display found in T010.

**Checkpoint**: US2 demonstrated; `pnpm --filter @sododeck/model test` green; the readable-part table matches the schema.

---

## Phase 5: User Story 3 - The canvas follows the file: sync, other panes, agents (P1)

**Goal**: any outside change reaches the open canvas in place; own writes never echo; two panes never loop; invalid files and deletes are safe.

**Independent test**: session tests below; quickstart C4.

### Tests (write first)

- [ ] T033 [P] [US3] Write failing tests in `test/disk-sync.test.ts` for `src/disk-sync.ts` (pure compare): deck text equal to `lastDeckText` → ignore (own write and user-text-only changes); different → `external-change`; invalid decode → forwarded as `external-change` with the raw deck text and `invalid` set (writes blocked until a valid file, FR-021); a valid file after an invalid one clears `invalid`; compare is by content only, never by timestamp.
- [ ] T034 [P] [US3] Write failing tests in `test/host-sync.test.ts` (session + fake vault): outside change → `external-change` and no `change` or write back (US3-1, SC-005); the plugin's own write produces a vault event that sends nothing and writes nothing (US3-2); edits not yet written then an outside change → `external-change`, a notice "your last edits were replaced" shown once, no write of the replaced text (FR-020; use a held write to create the window); two sessions on one fake file, an edit in one → the other sends `external-change`, and the files settle after exactly one write (US3-8, FR-023, SC-003 "no write caused only by an echo"); rename → the session keeps working under the new path and writes there; delete → nothing written until a user edit and then **no** recreation (FR-022); a conflicted-copy file appearing next to the deck is ignored; a background view that missed events shows current content when it becomes visible (re-read on `onload`/active).

### Implementation

- [ ] T035 [US3] Implement `src/disk-sync.ts` and complete the session's file-change path and the view's `setViewData(data, false)`/rename/delete handling (apply the S3 guard if needed); add the notice texts of `contracts/obsidian-host.md`. T033–T034 green. Run quickstart C4 (terminal overwrite, sync from another device, broken block then fix, two panes) on desktop and phone; record the modified-time observation for the no-loop check.

**Checkpoint**: US1–US3 (all P1) done and demonstrated.

---

## Phase 6: User Story 4 - Pictures stay linked when files move (P2)

**Goal**: new pictures become vault files linked from the note, links survive moves and renames, missing/late/outside/mismatched pictures are handled.

**Independent test**: session tests with the fake vault; quickstart C5.

### Tests (write first)

- [ ] T036 [P] [US4] Write failing tests in `test/picture-host.test.ts` for `src/picture-host.ts` (pure, on the fake vault) store path of `contracts/obsidian-host.md`: name from the id and mime; the attachment location comes from `getAvailablePathForAttachment`; an existing identical file (same SHA-256) is reused without a write; a name clash with different bytes gets the app's deduplicated name and the existing file is untouched (US4-8); link text from `fileToLinktext`; a link text failing `checkPicturePath` → `picture-store-failed` with the rule's text and the picture stays embedded; write error → `picture-store-failed` + notice (US4-9); capability `pictures` only for `.sododeck.md` with setting `attachments`, never for plain `.sododeck` or setting `embedded` (FR-024, US4-2).
- [ ] T037 [P] [US4] Write failing tests in `test/picture-serve.test.ts`: `picture-get` resolves the note's link through the resolver, reads bytes, checks size ≤ 5 MiB and SHA-256 = id, answers `picture`; unknown id, missing file, unreadable file → `picture-missing` with a reason naming the path; a changed file → `picture-missing` "the file changed" (US4-10); a path leaving the vault, absolute, drive or scheme → refused with the guard's reason and **no read call reaches the vault** (US4-7, SC-009; assert on the fake's call log); plain `.sododeck` with a 068 relative path is resolved from the deck's folder and served; a link that only resolves by file name after a move without link update still serves (US4-5).
- [ ] T038 [P] [US4] Write failing tests in `test/picture-late.test.ts`: a picture reported missing is remembered; a vault `create`, `rename` or `modify` that makes it resolvable sends `picture` within the fake 2 s (SC-010, US4-6); the move scenario with "update links" on: the fake rewrites the note's link → the next read overrides `assets[id].path` and the picture shows (US4-3, US4-4; deck moved too); with "update links" off and a unique name it still resolves (US4-5); an unresolved id is not retried on every unrelated event (only events for paths that could match: same basename or the missing link's path).
- [ ] T039 [P] [US4] Write failing tests in `test/settings.test.ts`: default `attachments`; invalid stored value falls back to default; changing the setting while a deck is open recomputes capabilities and, only if they changed, sends a second `init` with the same text (US4-11).

### Implementation

- [ ] T040 [US4] Implement `src/picture-host.ts`, the serve/late logic in the session, and the second-`init` on capability change; finish `src/settings.ts` with the setting tab (glue, one dropdown "Save new pictures": "In the attachment folder (recommended)" / "Inside the deck file"). T036–T039 green. Wire the vault events in `obsidian-ports.ts`.
- [ ] T041 [US4] If spike S4 or G2 showed that an unsolicited `picture` does not refresh the editor, implement the fallback chosen in `research.md` (file the gap against 067 and change SC-010 wording in `spec.md`, tell the founder). Run quickstart C5 on desktop and phone (paste, move picture, move deck, setting switch, missing then arriving, outside-vault link) and record.

**Checkpoint**: US4 demonstrated; no read or write outside the vault in the call logs.

---

## Phase 7: User Story 5 - The canvas looks like it belongs in the app (P2)

**Goal**: light/dark at start and while open.

**Independent test**: session test; quickstart C6.

- [ ] T042 [P] [US5] Write failing tests in `test/host-theme.test.ts`: `init.theme` follows the `ThemePort` (`theme-dark` class → `dark`); a theme change sends `theme { scheme }` once within 1 s and nothing else (no reload, no `init`, selection untouched in the fake); duplicate notifications with the same scheme send nothing.
- [ ] T043 [US5] Implement the theme path: `ThemePort` over `document.body.classList` and `workspace.on('css-change')` in `obsidian-ports.ts`, session handling. T042 green. Run quickstart C6 on desktop and phone.

---

## Phase 8: User Story 6 - Create a deck and bring decks in and out (P2)

**Goal**: "New Sododeck deck" (palette, folder menu); the web app imports and exports `.sododeck.md`.

**Independent test**: `pnpm --filter @sododeck/app test`; quickstart A and C.

### Tests (write first)

- [ ] T044 [P] [US6] Write failing tests in `test/commands.test.ts`: the new deck is a valid `.sododeck.md` built from `serializeDeck(emptySododeckFile())` through `toMarkdown`; location is the folder of the active file or the vault root, or the chosen folder from the menu; name `Untitled deck.sododeck.md`, numbered `Untitled deck 1…` when taken, an existing file is never overwritten (US6-1, US6-2); the file opens as a deck (marker detected) and is not rewritten until the first edit.
- [ ] T045 [P] [US6] Write failing tests in `apps/app/src/library/use-import-files.test.ts` (extend the existing test): `kindOfText` returns `'deck-md'` for a text with front matter carrying the marker and `'unknown'` for an ordinary note; the file picker `accept` includes `.md`; dropping a `.md` without the marker shows the existing "not a valid .sododeck file" message (extend the text to name `.sododeck.md`).
- [ ] T046 [P] [US6] Write failing tests in `apps/app/src/storage/library-ops.test.ts` (extend): `importFile` of a `.sododeck.md` text goes through `fromMarkdown` then `inspectDeckText` and gives the same deck as importing its JSON; a damaged deck block yields the refusal entries from the model (shown by the existing problems dialog); `exportDeck` has a `markdown` format giving `toMarkdown(serializeDeck(…))`; exporting then importing is lossless; embedded pictures stay embedded (no link, name only in the list); `deckFileName(name, 'markdown')` yields `<name>.sododeck.md` and strips existing `.sododeck`, `.sododeck.json`, `.sododeck.md`.
- [ ] T047 [P] [US6] Write a failing component test in `apps/app/src/editor/…` (next to the export menu tests): the export menu lists "Export .sododeck.md" next to "Export .sododeck" (role and label), choosing it saves a file named `<deck>.sododeck.md` through the existing save hook; embed builds hide it only if the host cannot save files (existing capability rule).

### Implementation

- [ ] T048 [US6] Implement `src/commands.ts` (palette command and the `file-menu` entry for folders, opening the new file in a new leaf) and register them in `src/main.ts`; T044 green.
- [ ] T049 [US6] Implement the web-app side per `research.md` R14: `apps/app/src/storage/download.ts` (name helpers), `library/use-import-files.ts` (`kindOfText`, accept list), `library/import-messages.ts` (message), `storage/library-ops.ts` (`importFile`, `exportDeck` formats), `editor/use-export-deck.ts` and the export menu entries (`library/deck-menu.tsx`, `editor/save-status.tsx`, `editor/deck-inspector-storage.tsx`, `editor/export/formats.ts`). Keep `apps/app` importing the form only from `@sododeck/model`. T045–T047 green; the smoke suite untouched and green (`pnpm e2e`). Update `apps/app/CLAUDE.md` if the export or import boundary text changes.
- [ ] T050 [US6] Run quickstart A (web ↔ text editor ↔ web) and C step "bring in and out" (export `.sododeck.md` from the web app, drop it in the vault, open; edit in the vault, import into the web app).

---

## Phase 9: User Story 7 - Install and trust (P2)

**Goal**: an honest, installable package and release steps; zero network.

**Independent test**: build, install in a clean vault on desktop and phone, watch network; checklist dry run.

- [ ] T051 [P] [US7] Write `apps/obsidian/README.md` (community-list README): what it does, that it opens `.sododeck.md` (recommended) and `.sododeck`, how to bring a deck in from the web app, how titles and notes can be edited in text and that the readable text wins, the picture setting, the no-network and vault-only promises, supported devices, known limits (no `.sododeck.json`, no links from cards, search also sees the deck block), and how to report problems. Check the wording against the community list's current guidelines (plugin id must not contain "obsidian"; description rules) and fix `manifest.json` if needed.
- [ ] T052 [P] [US7] Write `docs/release/obsidian-plugin.md` per R13 (FR-039): version bump in `manifest.json` and `versions.json`, bundle guard, install in a clean vault on desktop and phone, network watch, GitHub release with exactly `main.js`, `manifest.json`, `styles.css`, the pull request to the community list repository with the entry fields, tag. Building never publishes. Add a test in `test/release-files.test.ts` that `manifest.json` and `versions.json` agree, `isDesktopOnly` matches the decision from S2, and the id has no forbidden word.
- [ ] T053 [US7] Run quickstart C7 and E: network watch over a full session on desktop and phone (zero requests); disable the plugin and confirm every deck is a readable note and every picture a file, byte-identical (SC-012); release dry run up to, but not including, publishing.

---

## Phase 10: Polish and cross-cutting

- [ ] T054 [P] Write `apps/obsidian/CLAUDE.md` (responsibility, boundaries: imports only `@sododeck/host-protocol`, `@sododeck/model`, `@sododeck/schema`, never `apps/app`; the only files importing `obsidian`; how to build, test and load into a vault; how the embed is inlined) and add the 070 section to `packages/model/CLAUDE.md` (the `.sododeck.md` API, no-Yjs rule, the field table and its sync test).
- [ ] T055 [P] Write `docs/decisions/0051-deck-markdown-form.md` (final) and `docs/decisions/0052-obsidian-plugin.md` (iframe `srcdoc` sandbox and its fallbacks, embed inlined in `main.js`, own save schedule, readable-wins, links the app rewrites, plain `.sododeck` kept, `obsidian` typings dependency reason, spike results), using the structure of ADR 0047–0049.
- [ ] T056 [P] Update `docs/backlog-3.md` 070 status to "implemented" with the links and any change from the spikes; update `README.md` if commands changed (`pnpm --filter @sododeck/obsidian build`).
- [ ] T057 Final pass: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all green; no skipped or `.only` tests; no `any`, no non-null `!`; no remote URL in any bundle; check the plan's Constitution Check table against what was built and update `plan.md` if anything changed.
- [ ] T058 Re-run the whole `quickstart.md` on desktop and phone with a fresh vault and record in the final report: what changed, what was skipped, what is uncertain (include the spike outcomes, the measured load times and sizes, and any wording changed in `spec.md`).

---

## Dependencies and order

- Phase 1 → Phase 2 → US1 → (US2, US3 in either order after US1; US2's model work does not need the plugin, so it can run in parallel with US1 after T017) → US4 (needs US1 and US3's sync path for late pictures) → US5, US6, US7 (independent of each other after US1; US6's web-app tasks T045–T047, T049 need only T017 and T030).
- Phase A (model + web) = T016–T017, T026–T032 (model parts), T045–T047, T049. Phase B (plugin) = everything else. Shipping A first is the split point.
- Spikes T007–T011 gate T015, T017, T022–T025, T030, T040: read their results before starting those.

## Parallel examples

```text
After Phase 1:        T007 (frame spike) ∥ T008 (TextFileView spike) ∥ T010 (links spike)
Phase 2 doubles:      T012 ∥ T013 ∥ T014 ∥ T015
US1 tests:            T018 ∥ T019 ∥ T020
US2 model tests:      T026 ∥ T027 ∥ T028 ∥ T029          (model package, no plugin needed)
US4 tests:            T036 ∥ T037 ∥ T038 ∥ T039
US6 tests:            T044 ∥ T045 ∥ T046 ∥ T047
Release docs:         T051 ∥ T052
```

## Implementation strategy

- **MVP**: Phase 1, Phase 2, US1 (both file kinds open, edit, autosave, flush). It already proves the iframe, the codec and the swap, the riskiest parts.
- **Incremental**: US2 (the reason for the Markdown form) and US3 (the reason the plugin is safe) complete the P1 set; ship phase A to the web app as soon as US2's model work and T045–T049 are green; US4 then US5–US7.
- **Stop rules**: if S2 fails with no fallback (the canvas cannot run in the frame on mobile), stop and report before US1; if S1 shows the swap is unusable, fall back to the explicit "Open as Sododeck" command and tell the founder (it changes the wording of FR-007 and US1-1); if S4 shows the app does not rewrite the picture-list link, tell the founder before US4 (FR-025 and SC-007 depend on it).
