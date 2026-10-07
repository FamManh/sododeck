# Sododeck for VS Code

Open `.sododeck` files as an architecture and flow canvas, right next to your code.

## What it does

- Opens `*.sododeck` and `*.sododeck.json` files as the Sododeck canvas. Edit on the canvas; the tab shows it changed.
- Saves with VS Code's normal save, Save As, revert, and hot exit. The file is plain, tidy JSON, so changes show up cleanly in version control.
- Follows the file on disk. After a `git pull`, a branch switch, or a tool rewriting the file, the open canvas shows the new version in place. If you had unsaved edits, the file wins and you get a short notice.
- Pictures stay inside the deck file by default. Turn on **Sododeck › Pictures › Storage: file** and new pictures are saved as image files in a folder next to the deck (`my-deck.assets/`).
- Follows your light or dark theme.
- **Open as text** shows the raw JSON when you need it.

## Commands

- **Sododeck: New Sododeck deck** creates an empty deck and opens it.
- **Sododeck: Open in Sododeck web** shows the file in your file manager and opens the web app in your browser. You drag the file in; nothing is uploaded for you.

## What it does not do

- No network requests, no telemetry, no upload. Everything runs on your machine.
- No deck library and no second canvas on the same file. One tab shows one deck.
- Picture files are only read or written inside your workspace.

## Restricted Mode

In an untrusted workspace the canvas still opens and saves the deck. Picture files next to the deck are not read or written until you trust the workspace.
