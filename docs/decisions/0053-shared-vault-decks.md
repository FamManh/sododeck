# 0053. Shared vault decks

- **Status:** Accepted (the real-app spikes S1–S3 are not yet checked, see "Open")
- **Date:** 2026-10-08
- **Feature:** 071 (`specs/071-shared-vault-decks/`)
- **Amends:** nothing; builds on ADR 0050 (the VS Code host), ADR 0051 (the note form) and ADR 0052 (the Obsidian plugin)

## Context

One folder should work as an Obsidian vault and as a VS Code workspace. Plain `.sododeck` files already
open in both. The `.sododeck.md` note form (search by card text, backlinks, links that follow moves)
opened only in Obsidian, and a `.sododeck.json` only in VS Code.

## Decision

1. **The codec sits at the file edge.** `DeckDocument.text` stays the deck text the canvas speaks; a new
   `fileText` holds the last file text read or written. `file-codec.ts` (`kindOf`, `decode`, `encode`) converts
   through `@sododeck/model`, so `host-session` and the protocol are untouched. A change on disk that
   alters only the user's own text refreshes `fileText` and tells the canvas nothing.
2. **The codec is duplicated per host.** `apps/vscode/src/file-codec.ts` has the shape of the Obsidian
   one. Hosts may not import each other (ADR 0050, 0052), and the copy is about twenty lines.
3. **A note is an option plus a swap.** VS Code takes `priority` per contribution and cannot decline a
   custom editor per file content. A second view type, `sododeck.note`, covers `*.sododeck.md` with
   priority `option`; a small swap (`note-swap.ts`, pure decision) reopens a marked note as the canvas,
   unless the user chose "Open as text". An unmarked Markdown file is never touched.
4. **Note pictures are found by path ending.** The other host writes short links, not paths relative to
   the note. For a note, `picture-get` tries the relative path, then one unique file in the workspace
   whose path ends with the link (`FilePort.findByPathEnd`). Each candidate passes the workspace guard
   and the hash check. Two matches are refused, with a reason that says so.
5. **Copy a `.sododeck.json` as `.sododeck`** in both hosts: validate with the model, never overwrite,
   original untouched.

## Consequences

- No change to the schema, the model or the embedded editor.
- Save As between `.sododeck` and `.sododeck.md` converts the form for free.
- A note's picture folder is `<name>.assets` (`.sododeck.md` and `.md` stripped), the same name a
  `.sododeck` of the same stem would use. The files are hash-named, so a shared folder holds the same
  bytes under one name.

## Open

- S1: whether the text tab flashes before the swap, in a real VS Code. Fallback: keep the option only
  and document "Reopen Editor With…".
- S2: that Obsidian resolves `<name>.assets/<file>` from a note in another folder, and keeps it on a move.
- S3: the copy picker on a phone.
