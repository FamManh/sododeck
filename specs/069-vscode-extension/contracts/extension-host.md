# Contract: the extension's surface

Three contracts: what the extension declares to VS Code (manifest), how each VS Code event maps to 067 messages, and the picture file rules.

## 1. Manifest contributions (`apps/vscode/package.json`)

```jsonc
{
  "name": "sododeck",
  "displayName": "Sododeck",
  "engines": { "vscode": "^1.90.0" },
  "main": "./dist/extension.js",
  "activationEvents": [], // custom editor + commands activate on use
  "capabilities": {
    "untrustedWorkspaces": {
      "supported": "limited",
      "description": "Picture files next to the deck are not read or written until the workspace is trusted.",
    },
    "virtualWorkspaces": true,
  },
  "contributes": {
    "customEditors": [
      {
        "viewType": "sododeck.canvas",
        "displayName": "Sododeck canvas",
        "selector": [{ "filenamePattern": "*.sododeck" }, { "filenamePattern": "*.sododeck.json" }],
        "priority": "default",
      },
    ],
    "commands": [
      { "command": "sododeck.newDeck", "title": "New Sododeck deck", "category": "Sododeck" },
      {
        "command": "sododeck.openInWeb",
        "title": "Open in Sododeck web",
        "category": "Sododeck",
        "enablement": "activeCustomEditorId == sododeck.canvas",
      },
    ],
    "menus": {
      "explorer/context": [
        {
          "command": "sododeck.newDeck",
          "when": "explorerResourceIsFolder",
          "group": "navigation",
        },
      ],
    },
    "configuration": {
      "title": "Sododeck",
      "properties": {
        "sododeck.pictures.storage": {
          "type": "string",
          "enum": ["embed", "file"],
          "default": "embed",
          "enumDescriptions": [
            "Keep pictures inside the deck file.",
            "Save new pictures as image files in a folder next to the deck.",
          ],
          "markdownDescription": "Where new pictures are stored. Existing pictures stay as they are.",
          "scope": "resource",
        },
      },
    },
  },
}
```

`supportsMultipleEditorsPerDocument` is `false` in the provider registration (FR-027).

## 2. VS Code event ↔ 067 message

| VS Code                                         | Extension does                                                 | 067 message                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Tab opens                                       | read file (or backup), model check, build webview page (R4)    | wait for `ready`, then `init { text, theme, capabilities }`                                   |
| `ready` received with another `protocolVersion` | show the editor's own "update" message (067 FR-003)            | `fatal` is the editor's; nothing else sent                                                    |
| `change { seq, text }`                          | store text, fire content-change if it differs from `savedText` | reply `change-result { seq, ok:true }` (`ok:false, reason` only if the document was disposed) |
| Save                                            | flush, write                                                   | `flush { requestId }` → await `flushed`                                                       |
| Save As                                         | flush, copy pictures, write new file                           | `flush` as above                                                                              |
| Revert                                          | read disk                                                      | `external-change { text }`                                                                    |
| Backup (hot exit)                               | write `text` to the backup destination                         | none                                                                                          |
| File watcher event                              | compare content (R6)                                           | `external-change { text }` only when it is an outside change                                  |
| Colour theme changes                            | map kind to scheme                                             | `theme { scheme }`                                                                            |
| Setting / trust changes                         | recompute capabilities                                         | second `init` (067: handled as an outside change with new theme and capabilities)             |
| `open-link { href }`                            | `openExternal` or open a workspace file                        | none                                                                                          |
| `export-file { name, mime, bytes }`             | save dialog + write                                            | none                                                                                          |
| `picture-put { id, type, name, bytes }`         | store (R8)                                                     | `picture-stored { id, path }` or `picture-store-failed { id, reason }`                        |
| `picture-get { id }`                            | read + verify (R8)                                             | `picture { id, type, bytes }` or `picture-missing { id, reason }`                             |
| Anything unknown or malformed                   | ignore (FR-025), count in a debug-only log                     | none                                                                                          |

Messages are accepted only from the webview of that document, checked with 067's Zod schemas. Deck content goes only to that webview.

## 3. Picture file rules

- Folder: `<deck base name>.assets/` next to the deck file (`docs/arch.sododeck` → `docs/arch.assets/`). For `x.sododeck.json` the base name is `x`.
- File: `<first 16 hex chars of picture id>.<ext>` with ext from the type (`png`, `jpg`, `gif`, `webp`; the 055 allowed list). Same name with identical bytes: reuse. Same name with other bytes: `-2`, `-3`…
- Path written into the deck: `<deck base name>.assets/<file>` (forward slashes, relative to the deck's folder), accepted only if `checkPicturePath` (068) returns null.
- Containment: the resolved real location must be inside a workspace folder (or the deck's own folder when the deck is outside any workspace). Applies to reads, writes, copies and to the `.assets` folder itself. Refusal reasons shown to the user: "outside the workspace", "workspace not trusted", "file not found", "the file changed", "could not be written".
- Save As: copy every file the deck points at that resolves inside the boundary into `<new base>.assets/` (same naming and no-overwrite rules), rewrite those entries' `path` in the new text through the model, leave others as they are.

## 4. Network and storage promises (testable)

- The bundle imports no network module (`http`, `https`, `net`, `tls`, `dgram`, `dns`) and calls no `fetch`, `XMLHttpRequest` or `WebSocket` (bundle guard).
- The webview page contains no `http:` or `https:` URL other than inside user-visible text, and its CSP has no remote source (test on the generated HTML).
- No telemetry API (`vscode.env.createTelemetryLogger`) is used.
