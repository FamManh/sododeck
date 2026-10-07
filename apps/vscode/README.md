# Sododeck for VS Code

Draw architecture and flow diagrams in VS Code. Open a `.sododeck` file and it becomes an interactive canvas right next to your code, saved as plain JSON that lives in your repository.

Sododeck is local-first: the extension makes **no network requests, sends no telemetry and uploads nothing**.

## Getting started

1. Run **Sododeck: New Sododeck deck** from the Command Palette (or right-click a folder in the Explorer).
2. Draw on the canvas. The tab shows it has changed, like any file.
3. Save with `Cmd/Ctrl+S`. Commit the `.sododeck` file with your code.

Any existing `*.sododeck` or `*.sododeck.json` file opens as a canvas automatically.

## Features

### Works like a normal file

Save, Save As, Revert, unsaved-changes prompts and hot exit all use VS Code's own behavior. The file on disk is tidy, stable JSON, so a change to a diagram shows up as a small, readable diff in version control.

### Follows the file on disk

After a `git pull`, a branch switch, or a tool or AI agent rewriting the file, the open canvas updates in place without reloading. If you had unsaved edits in that tab, the file on disk wins and a short notice tells you so. A file that is not valid is never overwritten: the canvas shows what is wrong, and **Open as text** shows the raw JSON.

### Pictures embedded or next to the deck

By default pictures are stored inside the deck file. Switch the setting to save new pictures as image files in a folder next to the deck (`my-deck.assets/`), which keeps the deck small and the pictures reviewable in a pull request. Pictures are only read or written inside your workspace.

### Light and dark

The canvas follows your VS Code color theme and switches live.

### Private by design

No network requests, no telemetry, no accounts. Everything the canvas needs ships inside the extension.

## Commands

| Command                            | What it does                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Sododeck: New Sododeck deck**    | Creates an empty deck and opens it. Never overwrites an existing file.                                  |
| **Sododeck: Open in Sododeck web** | Shows the file in your file manager and opens the web app in your browser, so you can drag the file in. |
| **Sododeck: Open as text**         | Opens the raw JSON of the current deck in the text editor.                                              |

## Settings

```jsonc
{
  // "embed" (default): pictures stay inside the deck file.
  // "file": new pictures are saved as image files in <deck>.assets/ next to the deck.
  "sododeck.pictures.storage": "embed",
}
```

## Restricted Mode

In an untrusted workspace the canvas still opens and saves the deck. Picture files next to the deck are not read or written until you trust the workspace.

## Limits

- One canvas per file: opening the same deck twice shows the first tab.
- No deck library inside VS Code; use the web app for that.
- Desktop VS Code, including remote workspaces (SSH, containers, WSL). Not yet tested on vscode.dev.

## Links

- Web app: <https://app.sododeck.com>
- Website and docs: <https://sododeck.com>
- Issues: <https://github.com/FamManh/sododeck/issues>
