# Research: Sododeck in Obsidian

Decisions for plan.md. Facts about the Obsidian API come from its published type declarations (`obsidian.d.ts`, read 2026-10-07: `TextFileView`, `Plugin.registerExtensions`, `FileManager.getAvailablePathForAttachment` since 1.5.7, `MetadataCache.fileToLinktext` and `getFirstLinkpathDest`, `Vault.process`, `createBinary`, `on('rename' | 'create' | 'modify')`, `Workspace.on('file-open' | 'active-leaf-change' | 'css-change' | 'file-menu')`) and from reading how a widely used drawing plugin for the same app detects its notes and handles renames (public source, studied for behaviour only; nothing is copied). Items the declarations do not pin down are marked **spike** and are the first tasks.

## R1. One view, two kinds of file

**Decision**: one view class extending `TextFileView` (`VIEW_TYPE = 'sododeck'`). `registerExtensions(['sododeck'], VIEW_TYPE)` handles plain `.sododeck` (the app then lists and opens them, as for any registered type). `.sododeck.md` is an ordinary Markdown note to the app, so it is handled by R2. The view's `getViewData()` returns the file text it last decided to write; `setViewData(data, clear)` is where a file arrives (open, or the app reloading after an outside change); `clear()` empties the frame state.

**Rationale**: `TextFileView` gives file load, unload-save and rename following for free, and one class keeps the two paths identical except for the codec (R5). The picture-list link updating needs the note to stay a Markdown file, which is why `.sododeck.md` is not given its own extension.

**Alternatives considered**: `ItemView` + own file handling (more code, no rename/unload handling); a separate view class per kind (duplicates the session).

## R2. Telling a deck from a note, and swapping the view

**Decision**: the marker is the front matter key `sododeck-plugin: parsed` (same idea as the drawing plugin's key; value `parsed` reserved so later versions can change it). Detection reads `metadataCache.getFileCache(file)?.frontmatter` (cheap, already indexed; no file read). The swap runs on `workspace.on('file-open')`, `active-leaf-change` and once at `onLayoutReady` for restored panes: if the leaf's view is a Markdown view whose file carries the marker (and the leaf's state does not carry `sododeckSource: true`), call `leaf.setViewState({ type: VIEW_TYPE, state: { file: file.path } })`. "View as text" for a deck sets `sododeckSource: true` for that leaf so the swap lets go; the command "Sododeck: Open this deck as Markdown" does the same. A marker removed by the user is seen through the metadata cache's `changed` event; the view then switches back to Markdown.

**Rationale**: the app picks a view by the last extension (`md`), so a note cannot be claimed at registration; the swap is the only route, and it is what the reference plugin does. A state flag is the standard way to opt a leaf out.

**spike S1**: how visible is the Markdown view for a moment before the swap (flash, scroll jump), and does it survive restoring a workspace with many deck tabs on mobile? **Fallback** if a flash is unavoidable: swap before first paint by also listening to `layout-change`, and show nothing heavy in the Markdown view (decks are mostly a comment block, so the flash is short); the documentation says so. If the swap proves unreliable on mobile the feature still works from "New Sododeck deck" and the command "Open as Sododeck" (explicit), and the spec's wording "opens" becomes "opens in one tap".

## R3. Delivering the embed inside `main.js`

**Decision**: the community release has exactly three assets (`main.js`, `manifest.json`, `styles.css`), so the embed travels inside `main.js`. `scripts/inline-embed.ts` turns 067's `dist-embed/` into **one HTML string**: scripts and styles inlined, fonts as data URLs, and each worker as a blob loader created from its inlined source (the same inlining 069 needs, gap G1/G2). The view creates `iframe` with `srcdoc = html` and `sandbox="allow-scripts"` (opaque origin: no access to the app's storage, DOM or cookies; no `allow-same-origin`). The frame's own policy is a `<meta>` CSP: `default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:; connect-src blob: data:` (no remote source of any kind; `connect-src` has no network origin so even a bug cannot reach out).

**Rationale**: FR-008 and FR-034 (isolated frame, only bundled files). A sandboxed `srcdoc` frame needs no resource URL scheme, which sidesteps the mobile "iframe resource URLs" risk from the backlog, and keeps the editor's CSS from leaking (H1).

**Cost**: size. Everything the embed needs (editor, layout engine, JSON panel editor, fonts) becomes a string in `main.js`; the bundle guard has a size budget (set at task time from the first measurement; target ≤ 12 MB) and S2 measures load time on a mid-range phone. The string is parsed once at plugin load, and the iframe `srcdoc` is assigned per open deck, so memory is paid once per frame.

**Gap G1 (to 067, optional)**: an embed build mode that emits the single inlined HTML directly (shared with 069's G2). If 067 offers it, `inline-embed.ts` shrinks to a copy; otherwise the script stays and `TODO(067)` marks it.

**spike S2**: in real Obsidian on desktop, iOS and Android: the frame starts the embed from `srcdoc` under the sandbox and CSP above; blob workers run in an opaque-origin frame; `postMessage` with typed arrays both ways; a 500/1,000 deck's load time and memory; keyboard input and touch in the frame; copy and paste of text. **Fallbacks**, in order: (a) `allow-same-origin` added to the sandbox if blob workers need it (it weakens isolation to "same origin as the app", acceptable only because the frame runs our own code and the CSP forbids network; recorded in ADR 0052); (b) run the canvas without workers (067 already falls back in process when `new Worker` throws; slower layout on big decks); (c) if the frame cannot start on mobile at all, ship desktop first with `isDesktopOnly` true and report.

## R4. Autosave schedule

**Decision**: do not use `requestSave` (debounced 2 s). On each embed `change` (already batched by the editor, ≤ 100 ms after the burst's first edit, 067), the session converts the text (R5), compares it with the last text it wrote or read, and if different sets `view.data` and awaits `view.save()`; saves are serialised (one in flight, the newest text queued) so a burst yields at most one write per in-flight period. `change-result {ok: true}` is sent after the write resolves, `ok: false` with the reason if it rejects (the editor shows the reason; the next `change` retries). On `onUnloadFile`, `onClose`, a `visibilitychange` to hidden, and the app's `quit` event: send `flush`, await `flushed` (timeout 1.5 s), write the pending text, then continue. No write is ever scheduled behind a timer longer than the editor's own 100 ms batch.

**Rationale**: FR-006 (≤ 1 s), FR-014 (no lost edit on close or background), the Edge Case about phones, and SC-002. Awaiting the write before acknowledging keeps the editor's "did not take the last change" timer honest.

**spike S3**: `TextFileView.save()` behaviour: does it write immediately when called directly; does the app's own reload on a vault `modify` event for the open file call `setViewData(data, false)` also for our own writes (echo), and with what text; does it ever clobber `data` while a save is in flight. The echo rule in R6 is independent of the answer (we compare text), so S3 only settles whether the view needs a guard flag.

## R5. Codec per file kind

**Decision**: `file-codec.ts`: for `.sododeck`, `decode(file text) = text` and `encode(deck text) = deck text` (067's canonical JSON, never reformatted). For `.sododeck.md`: `decode = fromMarkdown(md)` (the model, R6), `encode = toMarkdown(deckText, previousFileText)`, where `previousFileText` is the last file text read or written, so user text outside the owned region is kept (data-model). The 067 messages always carry canonical deck JSON; the Markdown never reaches the embed.

**Rationale**: the protocol and the embed stay unchanged (the plan's central saving). One codec seam keeps host logic free of format details.

## R6. The Markdown form: grammar owned by us, no Markdown parser

**Decision**: line-based reader and writer in `packages/model/src/markdown-form.ts`, specified in `contracts/markdown-form.md`. Summary: front matter with `sododeck-plugin: parsed` (other keys kept); user text before and after; one owned region delimited by `%% sododeck:begin %%` and `%% sododeck:end %%` lines, holding the readable part (headings per object, each heading ending in an id marker `%%<id>%%`; notes as the text under it) and the picture list (`- [[link]] %%<id>%%`), then the complete deck as a fenced `json` block inside a `%% … %%` comment. Reading: parse the block with the model's existing text entry (`parseDeckText` semantics), apply title/notes edits by id from the readable part (readable wins), return the deck text in canonical form. Writing: regenerate the owned region from the deck text; text outside it is copied from `previous`.

**Rationale**: the app indexes headings, links and text of a Markdown file and hides `%%` comments in reading view, which is what the founder wants (search, backlinks, links that update). A parser (remark etc.) would re-serialise and so normalise the user's text and add a runtime dependency (ask-first rule); the grammar here is small and fully specified, so a hand-written reader is simpler to keep byte-stable.

**Escaping** (contract §Escaping): `%%` inside text is written as `%&#37;` and read back; a line of notes starting with `#` is written with a leading backslash; a title with a line break is written with `<br>`; in the JSON block, `%%` is written as `%%`. All tested with a corpus.

**Why the JSON stays plain, not compressed**: the file must remain readable, diffable and agent-writable (the product's reason for a text file). The cost is that the app's search also indexes the JSON text (ids, numbers); accepted, and the comment hides it from reading view. Embedded picture bytes are base64 in the block; that is why the vault default is attachment files (US4).

**Alternatives considered**: compressing the block like the reference plugin (small and quiet in search, but opaque to git diff and to agents; rejected); one note per object (no); YAML front matter for titles (not searchable as body text, and the app limits it).

## R7. Picture links the app keeps correct

**Decision**: with the setting "attachment folder" (default), `picture-put` is handled as: 1) build the wanted name `<first 16 hex of id>.<ext of mime>`; 2) `fileManager.getAvailablePathForAttachment(name, deckPath)` gives the path the user's own settings choose (and a deduplicated name if the file exists); if the returned name differs from the wanted one, a file with the wanted name already exists there: read it, and if its SHA-256 equals the picture id, **reuse** it; otherwise keep the deduplicated path; 3) `vault.createBinary(path, bytes)`; 4) the link text is `metadataCache.fileToLinktext(file, deckPath, false)`; 5) if that text passes `checkPicturePath`, answer `picture-stored {id, path: linktext}`, else delete nothing, answer `picture-store-failed` with the rule's plain text and keep the picture embedded. The picture list line in the owned region is written from the deck's `assets[id].path` as `[[<path>]]`, and **reading overrides the block's path with the list's link** (the app rewrites the visible link on move or rename; the block's copy goes stale and is replaced at the next write).

**Serving** `picture-get {id}`: look up `assets[id].path` from the decoded deck, treat it as a link text and resolve it with `metadataCache.getFirstLinkpathDest(path, deckPath)` (the app's own resolver: shortest-name, folder-relative and full-path all work, so a move that the app did not rewrite still resolves when the name is unique); if no file, answer `picture-missing {reason}`. Read bytes with `vault.readBinary`, check size ≤ 5 MiB and SHA-256 = id (FR-028), answer `picture`.

For plain `.sododeck`: capability `pictures` is `false` (new pictures embedded). An existing 068 relative `path` is resolved from the deck's folder (`normalizePath`, then `vault.getFileByPath`) and served the same way; it is not rewritten.

**Late and moved pictures**: for each picture reported missing, the session remembers the id; on `vault.on('create' | 'rename' | 'modify')` for a path whose resolution now succeeds, it answers again with `picture` (G2: unsolicited `picture`; fallback below).

**Gap G2 (to 067)**: confirm that an unsolicited `picture` (or a repeated `picture-get` answer) for an id the editor reported missing refreshes the shown picture. **Fallback**: the session sends a second `init` with the same text (067: a second `init` is an outside change) which does not refresh pictures; so the fallback is an extra editor-side retry on a timer, or the picture shows after the next open. If neither is possible, SC-010 is reworded to "after reopening the deck".

**spike S4**: the app rewrites a link in the `- [[link]] %%id%%` list item when the picture or the deck is moved or renamed (setting on), with the link inside a user-visible list and a trailing comment; and what it does with `![[…]]` vs `[[…]]` (we use `[[…]]` so reading view does not draw every picture).

## R8. Vault boundary

**Decision**: `vault-guard.ts` joins a deck-relative path with `normalizePath`, rejects any result that leaves the vault root (leading `..` runs past the top), and rejects absolute paths and anything with a drive or scheme (`checkPicturePath` already refuses `:` and `\`). Link texts go to `getFirstLinkpathDest`, which can only return a `TFile` of the open vault, so a link cannot reach outside by construction; the guard still runs first so the **reason** can say "outside the vault". The vault API has no way to address a file outside the vault, and a symbolic link inside the vault is resolved by the host platform: on desktop the plugin does not follow or inspect links (the app's own file API treats them as the app does); on mobile links are not followed. Tests cover `..` runs, absolute and drive-looking paths, and a fake vault whose resolver tries to return an outside path.

**Rationale**: FR-027, SC-009. Honest about the limit: the plugin can only judge what the app lets it see.

## R9. Disk sync and echo

**Decision**: the view follows the open file through the app: `TextFileView` reloads on a vault change and calls `setViewData(data, false)`; the session then runs `decode` and compares the **deck text** with the last text it sent to or received from the canvas; equal → ignore (own write, or a change that does not alter the deck, such as a user edit outside the owned region); different → `external-change {text}`. In the other direction the editor ignores a text equal to one of its last 8 sent (067). No timestamps, no timers. Two panes on one deck behave as two outside writers: each sees the other's write as a vault change, converts and compares, so no loop forms (the second write is equal to the first, so FR-013's "do not write an equal file" ends it). An invalid file is sent as `external-change` too: the editor shows the problems read-only (067 FR-014) and the plugin writes nothing until a valid file arrives. A rename: `TextFileView` already follows `file`; a delete: the view shows the app's missing-file state, and the session does not write (FR-022) until a user edit, and then only if the file exists (it never recreates).

**Rationale**: FR-018, FR-019, FR-023; compare-by-content (as 069 R6) is robust against sync tools that rewrite a file with the same bytes.

**Edge**: an edit that changes only text outside the owned region (user's own paragraph) produces an equal deck text and so no message; the next write keeps it (`previous`).

## R10. Theme, links, exports

- **Theme**: `document.body.classList.contains('theme-dark')` at start; `workspace.on('css-change')` re-reads it and sends `theme` (FR-031). The app's "system" theme setting still ends up as one of the two classes, so no extra case.
- **`open-link` / `export-file`**: capabilities `openLinks` and `exportFiles` are `false` in this feature (no internal links to notes, spec out of scope; exports use the frame's own download when allowed). Decision recorded; the editor hides those actions (067 FR-017).

## R11. Commands, menu, settings

- `addCommand({ id: 'new-deck', name: 'New Sododeck deck' })` and `workspace.on('file-menu', …)` for a `TFolder`: create `<folder>/Untitled deck.sododeck.md` (numbered if taken; never overwrite), content from `toMarkdown(emptyDeckText)` where the empty deck text is the model's `serializeDeck(emptySododeckFile())`, then open it in a new leaf. Command "Open this deck as Markdown" (R2).
- One setting, `pictureStorage: 'attachments' | 'embedded'` (default `attachments`), in a plugin setting tab, saved with `saveData`. A change applies from the next `picture-put`; open decks get a second `init` only if the declared capability changes (so the editor shows or hides picture storing).

## R12. Mobile

**Decision**: nothing desktop-only is used: no Node `fs`, no Electron API, no `path` module (use `normalizePath`). The frame is the same on mobile. Memory: one frame per open deck; closed panes are destroyed (`clear()` removes the iframe). Large pictures (up to the format's 5 MiB) cross `postMessage` as transferable buffers. Background: R4's `visibilitychange` flush. **spike S2** measures all of it on a real phone.

## R13. Packaging and release

**Decision**: esbuild bundles `src/main.ts` to `main.js` (CommonJS, `obsidian` and Electron external, minified, no source map in the release); `manifest.json` (`id: sododeck`, `isDesktopOnly: false`, `minAppVersion`), `versions.json`, `styles.css` (tiny: the frame's container sizing). `docs/release/obsidian-plugin.md` is the checklist: version bump in manifest and versions, bundle guard, install in a clean vault on desktop and phone, network watch, create the GitHub release with the three files, submit or update the entry in the community plugin list (a pull request to the list repository with the plugin's id, name, author, description, repo), tag. Building never publishes (FR-039). The plugin id must not contain "obsidian" and the description must follow the list's rules (settled at task time from the list's current guidelines).

## R14. Web app, skill and 069

- **Web app** (`apps/app`): import recognises the form by content (`kindOfText`: a text that starts with front matter containing the marker is `deck-md`), converts with `fromMarkdown`, and continues through the existing `importFile`; the file-picker `accept` list gains `.md`; export gains "Export .sododeck.md" next to "Export .sododeck" (`deckFileName` variants). Embedded pictures stay embedded in the block; the picture list shows names without links (nothing to resolve in the web app).
- **Skill (027)**: unchanged; it writes and checks `.sododeck`. `.sododeck.md` support there is "Later" (an agent can still write `.sododeck` and the user exports the form from the web app).
- **069**: unchanged; opening `.sododeck.md` in the code editor is "Later".

## Gaps for 067 and spikes

| Id  | Item                                                                                                            | Needed for                       | Fallback if 067 does not change                                      |
| --- | --------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| G1  | An embed build mode that emits one inlined HTML (shared with 069 G2)                                            | `main.js` carries the embed      | `apps/obsidian/scripts/inline-embed.ts` does it (R3)                 |
| G2  | Unsolicited `picture` for an id the editor reported missing refreshes it                                        | late and moved pictures (SC-010) | editor retry, or "after reopening" wording (R7)                      |
| G3  | A scripted fake **editor** next to 067's fake host (shared with 069 G3)                                         | host-side tests                  | `apps/obsidian/test/fake-editor.ts` on `memoryTransportPair`         |
| S1  | Swap a deck note's Markdown view for the canvas without a visible flash; restore on mobile                      | `.sododeck.md` opening           | extra `layout-change` hook; explicit "Open as Sododeck" command (R2) |
| S2  | Sandboxed `srcdoc` frame: embed starts, blob workers, typed arrays, size and load time on desktop, iOS, Android | everything                       | per-item fallbacks in R3                                             |
| S3  | `TextFileView.save()` and reload semantics, echo                                                                | autosave and sync                | guard flag in the view (R4)                                          |
| S4  | The app rewrites the picture-list link on move and rename                                                       | picture links (US4)              | wiki link by name still resolves (R7); wording of FR-025             |
| S5  | Marker detection through the metadata cache immediately after create and after a sync-delivered file            | opening a fresh file, sync       | read the file's first 200 bytes when the cache has no entry yet      |

If a spike fails in a way no fallback covers, stop and report before building on it.

## Spike results (2026-10-07)

Run so far without a real Obsidian: a headless Chromium (Playwright) with the built `embed.single.html` in a sandboxed `srcdoc` frame, driven by a scripted host. **Not run** (they need the real app, and S2 also a phone): S1, S3, S4, S5 and the S2 mobile and Electron parts. Nothing below is a statement about Obsidian itself.

### S2 — frame, workers, size (partial: desktop Chromium only)

| Check                                                                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `iframe srcdoc` with `sandbox="allow-scripts"` and the CSP of R3 shows the deck | ✅ the canvas renders (Shop sample), light and dark, no console errors                                                                                                                                                                                                                                                                                                                                                                         |
| `ready` → `init` → render; `external-change`, `theme`, `flush` → `flushed`      | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Layout worker lays out a deck whose cards have no position                      | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Blob workers in the opaque-origin frame**                                     | ✅ classic blob workers start. ❌ **`type: 'module'` blob workers do not start** in the sandbox. The embed starts its workers with `type: 'module'`; `worker-loader.ts` drops `type` (the sources are bundled as classic scripts). All 8 worker files of the embed then start.                                                                                                                                                                 |
| Network                                                                         | ✅ `fetch('https://example.com')` is blocked by `connect-src`; `localStorage` throws (the editor copes, no errors); zero requests outside `data:`/`blob:`                                                                                                                                                                                                                                                                                      |
| `crypto.randomUUID`                                                             | needs a secure context: ✅ when the host page is `http://localhost` or `app://`; ❌ when the host is `about:blank`. Obsidian's origins (`app://obsidian.md`, `capacitor://localhost`, `http://localhost`) are treated as secure; to confirm on the phone                                                                                                                                                                                       |
| 5 MiB typed array through `postMessage` both ways                               | not measured (the protocol's picture messages are unit-tested through the in-memory transport)                                                                                                                                                                                                                                                                                                                                                 |
| Load time of the 500-node deck (≤ 2 s) and a 100-node deck on a phone (≤ 5 s)   | not measured                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| First measurement of the built plugin                                           | `embed.single.html` 12.6 MiB; `release/main.js` **13.29 MiB** (minified; the page is a JSON string inside it); loads as a CommonJS plugin class in 90 ms in Node with only `obsidian` required. Budget set to 16 MiB in `scripts/check-bundle.ts`. Where the size is: the page's main script 7.7 MiB (all lazily loaded chunks are inlined, the code editor among them), the layout engine 1.4 MiB, the SQL parsers 1.4 MiB, the rest 2.6 MiB. |

Fallbacks of R3 (a) `allow-same-origin`, (b) no workers, (c) desktop only were **not needed** in Chromium. The fallback the spike did need, and is built in, is the classic-worker loader above. Compressing the page inside `main.js` (about a quarter of the size) is the first lever if phone load time is too slow; ADR 0052 lists it.

### S1, S3, S4, S5 — not run

Each needs the real app. Their stated fallbacks (R2, R4, R7, S5) are unchanged. The code is written to be robust to the unknowns:

- **S3** (does a vault `modify` of the open file call `setViewData(data, false)`, echo included?): the session does not depend on the answer. It reads the file itself on every vault event for the deck's path and compares by content; `setViewData(data, false)` goes through the same comparison (`DeckView.setViewData` → `HostSession.onFileText`), so either path, both or neither is safe. Writes go through `view.data = text; view.save()`.
- **S5** (marker in the metadata cache right after a create or a sync delivery): `md-swap.ts` falls back to reading the file when the cache has no entry yet, and re-checks on the cache's `changed` event; "New Sododeck deck" opens the new file straight in the deck view.
- **S1** (flash on the view swap, restore of many deck tabs): the swap listens to `file-open`, `active-leaf-change`, `layout-change`, `metadataCache.changed` and `onLayoutReady`. The explicit commands "Open this deck as canvas" / "…as Markdown" exist as the stated fallback.
- **S4** (does the app rewrite `- [[link]] %%id%%` on a move?): tests use a fake vault that does; reading takes the visible link as the truth. If the real app does not rewrite links inside a list item with a trailing comment, FR-025 and SC-007 need the founder's decision before US4 is relied on (stop rule in `tasks.md`).
