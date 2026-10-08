# Research: Shared Vault Decks

## R1. Where the codec sits in the VS Code host

- **Decision**: `DeckDocument.text` stays the deck text the canvas speaks. A new `fileText` holds the last file text read or written (the `previous` for `toMarkdown`), and a `kind` (`plain` | `markdown`) comes from the path. `file-codec.ts` has `kindOf`, `decode`, `encode` (same signatures as the Obsidian one). Open, save, revert, backup and disk sync call it; `host-session` is untouched.
- **Rationale**: the session, protocol and canvas already speak deck text; one conversion layer at the file edge is the smallest change and mirrors 070.
- **Alternatives**: convert inside `host-session` (mixes concerns, breaks 069 tests); store Markdown in `text` (the canvas would see Markdown).

## R2. Dirty state for notes

- **Decision**: dirty means `text !== savedDeckText`, where `savedDeckText` is the decoded deck text of the last disk read or write. A disk change that alters only the user's own text (outside the generated region) refreshes `fileText` and sends nothing.
- **Rationale**: the user typing a paragraph in a text editor must not replace the canvas or mark it dirty; and the next save must keep that paragraph (`previous` is the newest file text).
- **Alternatives**: compare file text (every outside edit looks like a deck change).

## R3. Opening: custom editor vs. text for `*.sododeck.md`

- **Decision**: register the canvas for `*.sododeck.md` with `priority: "option"`, plus a small swap: when a text editor opens a `*.sododeck.md` whose text passes `isDeckMarkdown`, reopen it with `vscode.openWith` the canvas, unless the user chose "Open as text" for that file in this session. `note-swap.ts` holds the pure decision.
- **Rationale**: VS Code cannot decline a custom editor per file content; `priority: "default"` would take every `*.sododeck.md`, marker or not (FR-006 forbids). Obsidian does the same swap (070 R2).
- **Alternatives**: `default` priority and show a "not a deck" page for unmarked files (fails FR-006: the file would not stay a text file); write `workbench.editorAssociations` (touches user settings).
- **Spike S1** (real VS Code): flicker of the text tab before the swap; whether closing the text tab loses the cursor/history. Fallback: keep `option` only and document "Reopen Editor With…".

## R4. Unreadable note

- **Decision**: `decode` fails → the document is read-only, never dirty, never saved; the webview page says why in plain words (problem entries of `fromMarkdown`) and `offerOpenAsText` is shown. The file is not touched.
- **Rationale**: FR-012; 070 does the same.

## R5. Picture links written by Obsidian

- **Finding**: Obsidian writes `fileToLinktext(file, fromPath)`: a file name or the shortest unique path, not a path relative to the note, and by default new pictures go to the vault's attachment folder. The VS Code guard joins `path` to the deck's folder only.
- **Decision**: for a note, `picture-get` tries the relative path first, then a unique match of a path ending (`findByPathEnd`) among the workspace's files, each judged by `resolveInside` and verified by the picture id hash. Several matches or none: `picture-missing` with a reason that names the cause.
- **Rationale**: the pictures Obsidian owns keep showing in VS Code (FR-019, US5) without an Obsidian-only path format.
- **Alternatives**: relative-only (pictures added in Obsidian show missing in VS Code: the user-visible half of the promise broken).
- **Spike S2**: confirm in real Obsidian that `billing.sododeck.assets/a.png` (what VS Code writes) resolves through `getFirstLinkpathDest` from a note in another folder; if not, VS Code writes the link list differently (needs model support; would be reported, not built here).

## R6. `.sododeck.json` copy command

- **Finding**: VS Code already opens `*.sododeck.json` (069), Obsidian does not. The VS Code command is a convenience; the Obsidian one is the needed one. Obsidian does not list `.json` files unless "detect all file extensions" is on, so the command is a palette picker (suggest modal) over vault files ending `.sododeck.json`.
- **Decision**: each host has a pure `copyAsSododeck(source text, folder files)`: validate with `inspectDeckText`, target = name without `.json`, never overwrite (` 1`, ` 2`… suffix), write the text unchanged.
- **Spike S3**: the picker on mobile.

## R7. Save As across kinds

- **Decision**: the destination's name picks the kind; saving a plain deck as `x.sododeck.md` (or the reverse) converts through the codec. Pictures follow 069's copy rule.
- **Rationale**: free, falls out of R1, and gives a manual conversion path.

## R8. New commands

- **Decision**: `sododeck.newDeck` title "New Sododeck" (was "New Sododeck deck"), still `.sododeck`; `sododeck.newNote` "New Sododeck note" creates `.sododeck.md` from `toMarkdown(emptyDeckText())`. The Obsidian command is already "New Sododeck"; only the docs/spec text of 070 mention the old name.

## R9. Docs

`docs/shared-folder.md` (new), both READMEs, the web app's export help (one string; found in tasks), `docs/backlog-3.md`, ADR 0053. Wording follows `AGENTS.md`: no other tools named; the notes app and the code editor are named only where the product names are needed (Obsidian and VS Code are the hosts' names).

## Spike results

- **S3** (copy picker on mobile): not done yet. The Obsidian command is built (`SuggestModal` over `.sododeck.json` files); a manual check on a phone is still to do.
- **S1** (swap flicker in VS Code): not checked in a real editor. The swap is built (`registerNoteSwap`); the fallback (option only, "Reopen Editor With…") is documented in the ADR.
- **S2** (Obsidian resolving `<name>.assets/<file>`): not checked in real Obsidian. VS Code writes `<name>.assets/<file>` where `<name>` is the note's file name without `.sododeck.md` or `.md` (not `billing.sododeck.assets` as first sketched in R5).
- **Findings for 070**: none; `toMarkdown` already writes the link list for plain relative paths, and paths with `[`, `|` or `#` get no link (covered in `apps/vscode/test/note-pictures.test.ts`).
