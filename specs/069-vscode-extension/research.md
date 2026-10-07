# Research: Sododeck in VS Code

Decisions for plan.md. Facts about the VS Code API come from its published extension docs (custom editors, webviews, API reference). Items that depend on behaviour the docs do not pin down are marked **spike** and are the first tasks.

## R1. Which custom editor type

**Decision**: `CustomEditorProvider` with an own `DeckDocument` (the latest text the canvas sent, plus the last saved text), not `CustomTextEditorProvider`.

**Rationale**:
- The canvas owns the document and its undo (Principle I). With a content-change event (`CustomDocumentContentChangeEvent`) VS Code marks the tab changed but does not run its own undo stack; with the text type every canvas change becomes a text edit on VS Code's undo stack, so Ctrl+Z could undo the text model and the canvas separately.
- Save As: the custom editor API has `saveCustomDocumentAs`, where FR-017a copies the picture files. The text type saves through VS Code and gives no hook.
- Each 067 `change` carries the complete latest text, so the document model is one string; save, backup and revert are a few lines each.
- "Open as text" works through `vscode.openWith(uri, 'default')`.

**Alternatives considered**: `CustomTextEditorProvider` (the guide's recommendation for text formats; free save, backup and clean-document reload): rejected for the two reasons above. Cost accepted: the extension writes, backs up, watches and reverts itself.

**Note**: the guide says an editor must fire only edit events or only content-change events. We fire only content-change events (R2).

## R2. Dirty state and undo

**Decision**: fire `onDidChangeCustomDocument` with a **content-change** event on each `change` whose text differs from the saved text; keep `DeckDocument.text`. The canvas's own undo handles Ctrl+Z.

**Rationale**: edit events with undo/redo callbacks would need a host-to-editor undo message that 067 does not have (and would duplicate the canvas's history). The docs: content-change events mean the only way to clear the mark is save or revert. That is why R3 exists.

**spike S3 (undo and keys)**: confirm that Ctrl/Cmd+Z, Ctrl+Y, Ctrl+S and the editor's other bindings reach the canvas when the webview has focus, that undo does not also reach VS Code (no text editor is involved, so nothing to undo), and that Ctrl+S still triggers VS Code's save. Fallback: the shim forwards keys.

## R3. Clearing the changed mark after an outside change (FR-013)

**Decision**: when a file change arrives (R6) while the document is dirty: send `external-change`, set `DeckDocument.text = savedText = diskText`, and clear the mark by VS Code's own revert (`revertCustomDocument` is ours: it reads the disk text, sets both texts, sends `external-change`, and VS Code clears the mark). Trigger it with the `workbench.action.files.revert` command for the document's editor; for a tab in the background, trigger when it becomes visible (`onDidChangeViewState`), while showing the disk text at once via `external-change`.

**Rationale**: the docs say the mark clears on save or revert only. A silent re-save would work but writes the disk file, which is wrong if the disk changes again.

**spike S1**: confirm the revert command accepts the document URI and runs `revertCustomDocument` without a prompt for a dirty custom editor. **Fallback** if it cannot be triggered programmatically: the tab stays marked as changed until the user saves or reverts (saving writes text equal to the disk file, harmless), and FR-013's "mark clears" becomes "mark clears when the tab is next saved or reverted; the canvas already equals the file". The spec would be reworded; the design is otherwise unchanged.

## R4. Hosting the embed build in a webview

**Decision**: the extension builds the webview page itself (`webview-html.ts`): it reads `media/embed/embed.html` (copied from 067's `apps/app/dist-embed/`), rewrites each asset URL with `webview.asWebviewUri`, injects a CSP `<meta>` and a nonce, and loads `webview-shim.js` first. The shim presents the webview's channel to the embed as the embed's parent window: it replaces `window.parent` with an object whose `postMessage(message)` calls the webview API's `postMessage`, and re-dispatches messages from the extension as `message` events whose `source` is that object. 067's embed then runs unchanged (it accepts messages only from its parent).

**Rationale**: a webview is already an isolated frame, so no extra iframe is needed. The shim is ~40 lines, lives in the extension, and lets 069 proceed while 067 is being built.

**Gap G1 (to 067, optional)**: let the embed take an injected transport (for example `window.__sododeckHost = { post, onMessage }` read before start) so no `window.parent` replacement is needed. If 067 adds it before 069 is built, the shim shrinks to a few lines; otherwise it stays and `TODO(067)` marks it.

**Alternatives considered**: an `<iframe src=asWebviewUri(embed.html)>` inside the webview (an extra frame, and its resource loading and CSP are less certain); a webview per feature (no).

**spike S2** includes: the embed loads and shows a deck in a real webview through the shim.

## R5. Workers, fonts and the content policy

**Decision**: CSP: `default-src 'none'; script-src 'nonce-<n>' ${cspSource}; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data: blob:; font-src ${cspSource}; connect-src ${cspSource} blob: data:; worker-src blob:`. Workers run from **blob** URLs: the embed's workers (layout, validation, Monaco if the embed has it) must be inlined into the bundle, because a worker script cannot be created directly from the webview's resource origin (a different origin from the page).

**Rationale**: matches FR-024 (only bundled files, workers allowed, no remote source). `connect-src` allows only the extension's own origin and blob/data, so even a bug cannot reach the network.

**Gap G2 (to 067)**: the embed build must produce inline (blob) workers, or the extension build must be able to inline them. If 067's embed already uses separate worker files, the extension's build script rewrites them to blob loaders (`scripts/build.ts`), or 067 adds an `inlineWorkers` option; settled by spike S2. `TODO(067)` marks the workaround.

**spike S2**: real webview with the CSP above, a 500/1,000 deck, layout worker running, fonts loading; measure SC-001.

## R6. Disk sync and echo

**Decision**: one `FileSystemWatcher` per open document (the single file, `RelativePattern`) plus a re-check when the tab becomes visible and when the window regains focus (watchers can miss changes on some remote filesystems). On any event: read the file; if the text equals `lastWritten` (our own save) or equals `DeckDocument.savedText` or equals the text the canvas last sent, ignore; otherwise it is an outside change (R3). Compare content, never timestamps.

**Rationale**: FR-012 (ignore own writes) and 067 rule 2 (send `external-change` only for changes that did not come from the editor). Content comparison is robust against editors that touch files, `git checkout` rewriting the same bytes and atomic-rename writers.

**Edge**: the file vanishes: the document keeps its text, the tab is marked changed so VS Code offers save; a rename follows VS Code's own handling for custom editors (`onDidRenameFiles` rebinds the document's uri when VS Code does not).

## R7. Save, save as, revert, backup, hot exit

**Decision**:
- `saveCustomDocument`: send `flush`, await `flushed` (timeout 2 s, then continue with the last text and show a warning), write `DeckDocument.text` to the uri with `workspace.fs.writeFile` (file scheme, not a symlink: write a temp sibling and rename over it; otherwise write directly), set `savedText = lastWritten = text`.
- `saveCustomDocumentAs`: flush, then `save-as.ts` copies picture files (FR-017a) and writes the rewritten text to the new uri; the old document and files are untouched.
- `revertCustomDocument`: read the disk text, set both texts, send `external-change`.
- `backupCustomDocument`: write `DeckDocument.text` to `context.destination`; `openCustomDocument` with `backupId` starts from the backup text (dirty) and reads the disk text separately as `savedText`.
- Never write the deck file except in save and save as (FR-010).

**Rationale**: these are the custom-editor lifecycle methods, one per FR-006 item.

## R8. Pictures

**Decision**:
- **Setting** `sododeck.pictures.storage`: `"embed"` (default) or `"file"`. Capability `pictures` is declared only when the setting is `"file"`, the deck has a `file`-like writable uri (not untitled), and the workspace is trusted (FR-016, FR-026, Q3, Q1). When any of these change while open, the extension sends a second `init` (067: treated as an outside change with the new capabilities).
- **Store** (`picture-put {id,type,name,bytes}`): the file name is `<first 16 hex of id>.<ext from type>` in `<deck base name>.assets/` next to the deck. If the name exists: identical bytes (hash) → reuse; different → add `-2`, `-3`… Answer `picture-stored {id, path: '<deck base name>.assets/<file>'}`. The path is checked with the model's `checkPicturePath` before answering; a violation (for example a `:` in the deck's name, which 068 forbids) answers `picture-store-failed` with the rule's plain text and the picture stays embedded (FR-021).
- **Serve** (`picture-get {id}`): find the entry by id in the document text through the model (`assets[id].path`), resolve against the deck's folder, check containment (R9), read it, check size ≤ 5 MiB and SHA-256 equals the id (FR-020), answer `picture` or `picture-missing {reason}` (reasons: not found, outside the workspace, unreadable, "the file changed", workspace not trusted).
- **Never overwrite** an existing file with different content (FR-017).

**Rationale**: reuses 068's path rules and picture ids; names derived from the id are stable, collision-free in practice and independent of titles (Principle III).

## R9. Workspace containment

**Decision**: `workspace-guard.ts` resolves `deckFolder + path` lexically (handling leading `..`), then, for the `file` scheme, takes `fs.realpath` of the existing target (or of its nearest existing parent for a file about to be written) and checks the result is inside a workspace folder's real path (or inside the deck's own folder when the deck is outside any workspace). Other schemes (remote file systems are reached through the same extension host, virtual file systems have no links) are checked lexically. A failed check is a refusal with a reason; nothing outside is read or written.

**Rationale**: FR-019 and SC-007: "judged on the resolved location including links". Tests cover `..` runs, absolute-looking names, symlinks inside pointing out, symlinked deck folders, case differences and Windows separators.

## R10. Theme, links, exports, commands

- **Theme**: `window.activeColorTheme.kind` → light for `Light` and `HighContrastLight`, dark for `Dark` and `HighContrast`; `onDidChangeActiveColorTheme` → `theme` message (FR-022).
- **Links** (`open-link`): `http:` / `https:` → `env.openExternal` (a user action; the extension itself makes no request); a relative href → resolve against the deck's folder, containment check, `vscode.open`. Declared capability `openLinks: true`.
- **Exports** (`export-file`): `window.showSaveDialog` with the suggested name, then `workspace.fs.writeFile`. Capability `exportFiles: true`.
- **Commands**: `sododeck.newDeck` (save dialog, never overwrites, writes the model's empty deck, opens it with `vscode.openWith`); `sododeck.openInWeb` (reveal the file in the OS file manager and open the web app's address in the browser; the user drags it in; nothing is sent).

## R11. Trust, remote and virtual workspaces

**Decision**: manifest `capabilities.untrustedWorkspaces: { supported: "limited", description: "Picture files next to the deck are not read or written until the workspace is trusted." }`, `virtualWorkspaces: true`. The trust state is read from `workspace.isTrusted` and `onDidGrantWorkspaceTrust`. The extension runs in the extension host that owns the files, so remote workspaces work through `workspace.fs` with no extra code; `realpath` is used only where the scheme is `file` in that host.

## R12. Packaging and release

**Decision**: `esbuild` bundles `src/extension.ts` to `dist/extension.js` (CommonJS, `vscode` external, minified, no source maps in the package); `vsce package --no-dependencies` produces `dist/sododeck-<version>.vsix` including `media/embed/**`, README, CHANGELOG, icon. `.vscodeignore` excludes sources and tests. `docs/release/vscode-extension.md` is the checklist (version, changelog, bundle guard, install in a clean profile, network watch, marketplace and Open VSX publish commands with tokens, tag); building never publishes (FR-029). `vsce` and `@types/vscode` are the only new packages, both dev-only.

## Gaps for 067 and spikes

| Id | Item | Needed for | Fallback if 067 does not change |
| --- | --- | --- | --- |
| G1 | Pluggable transport for the embed | simpler shim | the shim replaces `window.parent` (R4) |
| G2 | Inline (blob) workers in the embed build | strict CSP | build script rewrites worker loaders (R5) |
| G3 | A scripted fake **editor** next to 067's fake host | host-side tests | `apps/vscode/test/fake-editor.ts` on `memoryTransportPair` |
| S1 | Programmatic revert clears the mark | FR-013 | the mark clears on next save or revert; spec reworded |
| S2 | Real webview: shim, CSP, workers, fonts, typed arrays, 500-node timing | everything | per-item fallbacks above |
| S3 | Keys and undo inside the webview | US1, US2 | shim forwards keys |

If a spike fails in a way no fallback covers, stop and report before building on it.
