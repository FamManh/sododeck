# apps/vscode — Sododeck for VS Code (069)

The extension is a **host** for the embedded editor (067): it opens `.sododeck` files in a custom-editor webview, speaks `@sododeck/host-protocol`, and turns VS Code's file lifecycle (open, save, save as, revert, backup, file watcher, theme, trust) into protocol messages. Spec: `specs/069-vscode-extension/`; notes and shared folders: `specs/071-shared-vault-decks/` (ADR 0053). Decisions: `docs/decisions/0050-vscode-extension.md`.

## Boundaries

- **Only three files import `vscode`**: `src/extension.ts`, `src/deck-editor-provider.ts`, `src/vscode-ports.ts`. Everything else is pure, takes the interfaces of `src/ports.ts`, and is tested with the fakes in `test/fakes.ts` and the scripted editor in `test/fake-editor.ts`.
- Never import `apps/app`. The build **copies** `apps/app/dist-embed/` to `media/embed/`.
- `file-codec.ts` is the only place that turns file text into deck text and back (a `.sododeck.md` note goes through `@sododeck/model`'s Markdown form; the canvas never sees Markdown). It duplicates the Obsidian host's codec on purpose: hosts do not import each other. The document keeps `text` (deck text) and `fileText` (last file text, the `previous` that preserves the user's own text in a note).
- `note-swap.ts` decides when a text editor becomes the canvas; the glue is `registerNoteSwap` in `vscode-ports.ts`. Two view types share one provider: `sododeck.canvas` (default) and `sododeck.note` (option, for `*.sododeck.md`).
- Note pictures: `picture-host.ts` tries the path relative to the note, then one unique workspace file whose path ends with the link (`FilePort.findByPathEnd`); every candidate passes `workspace-guard.ts`.
- Never reformat `change.text`; the canvas's text is canonical and is saved byte for byte.
- The deck file is written only by save, save as, the new-deck, new-note and copy commands (`file-writer.ts`).
- Pictures: every read or write goes through `workspace-guard.ts` (resolved real location, inside the workspace).
- No network module, no `fetch`, no telemetry API: `scripts/check-bundle.ts` fails the build.
- `@sododeck/model` is the only Yjs ↔ JSON converter; Save As path rewriting goes through it (`save-as.ts`).

## Run

- `pnpm --filter sododeck build` (needs `pnpm --filter @sododeck/app build` first; turbo does it), then F5 "Run Extension" in VS Code with this folder, or `pnpm --filter sododeck package` for a `.vsix` in `dist/`.
- The package name is `sododeck` (VS Code requires an unscoped lowercase name), so filter with `sododeck`, not `@sododeck/vscode`.
- `pnpm --filter sododeck test` runs the unit tests; real-editor behaviour is checked with `specs/069-vscode-extension/quickstart.md`.

## Read first

`specs/067-embed-host-protocol/contracts/host-protocol.md` and `specs/069-vscode-extension/contracts/extension-host.md`.
