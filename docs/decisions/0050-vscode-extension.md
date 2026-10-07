# 0050. VS Code extension

- **Status:** Accepted
- **Date:** 2026-10-07
- **Feature:** 069 (`specs/069-vscode-extension/`)
- **Builds on:** ADR 0047 (outside changes), 0048 (picture file refs), 0049 (host protocol)

## Context

Teams keep `.sododeck` files in repositories. In VS Code the file is the store, so the canvas must open it, save through VS Code, follow outside changes (pull, agent writes) and keep picture files inside the workspace, with no network.

## Decisions

1. **Custom editor with an own document** (`CustomEditorProvider`), not the text-based type. The canvas owns the document and its undo (Principle I); the text type would put every canvas change on VS Code's text undo stack and gives no Save As hook (needed to copy picture files). Cost accepted: the extension writes, backs up, watches and reverts itself. Changed state uses content-change events only.
2. **Host logic is pure and port-driven.** `src/ports.ts` lists what is needed from VS Code; three files implement or register it. Everything else is tested with fakes and a scripted editor over 067's in-memory transport.
3. **Webview shim (R4).** The embed speaks to `window.parent`; `webview-shim.js` presents the webview channel as that parent (about 30 lines). Deleted if 067 adds a pluggable transport (gap G1).
4. **Content policy (R5).** `default-src 'none'`, scripts by nonce, own files only, `worker-src blob:`, no remote source anywhere. A bundle guard fails the build on network modules, `fetch`, telemetry, or remote URLs. **Open:** the embed's workers are separate files; a webview needs blob loaders. Not verified without a real VS Code (spike S2, gap G2); see "Unverified" below.
5. **Disk sync compares content (R6).** A watch event reads the file; equal to the canvas text, the saved text or our last write means nothing happens. A different text goes to the canvas; if the tab had unsaved edits it is replaced, the changed mark is cleared and one notice is shown. **The file wins and undo does not bring the edits back** (066/067: an outside change is never an undo step). This corrects the backlog's draft criterion.
6. **Save** flushes the canvas (2 s timeout), writes the canvas text byte for byte through a temp file and rename (symlinks written in place).
7. **Pictures (R8, R9).** Setting `sododeck.pictures.storage` (`embed` default, `file`). Files go to `<deck>.assets/<16 hex of id>.<ext>`, never overwriting a different file. Every path is judged on its resolved real location, inside a workspace folder (or the deck's own folder for a deck outside any workspace). Save As copies the files and rewrites `path` through the model.
8. **Packaging.** `esbuild` bundle `dist/extension.cjs` (the package is ES-module typed for tooling, VS Code loads the extension with `require`), plus `media/embed/**`. Package name is `sododeck` (the workspace filter is `sododeck`). Two dev dependencies: `@types/vscode` (typings) and `@vscode/vsce` (packaging). No runtime dependency.

## Unverified (needs the Extension Development Host)

Spikes S1 (programmatic revert clears the tab's changed mark), S2 (workers and CSP in a real webview, typed arrays across `postMessage`, timing of the 500-node deck) and S3 (keyboard and undo inside the webview) are listed in `specs/069-vscode-extension/tasks.md` and were not run by the agent that wrote the code. Fallbacks are in `research.md`.

## Consequences

The extension is released separately from the web app (`docs/release/vscode-extension.md`). Principle IV is kept: no network from the extension or the canvas; "Open in Sododeck web" only opens the user's browser.
