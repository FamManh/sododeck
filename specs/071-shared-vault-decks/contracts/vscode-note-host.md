# Contract: VS Code host for `.sododeck.md` (extends `specs/069-vscode-extension/contracts/extension-host.md`)

Everything in the 069 contract holds. Only the differences are listed.

## Contributions (package.json)

| Item                   | Value                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Custom editor selector | adds `*.sododeck.md`, `priority: "option"` (plain `.sododeck` and `.sododeck.json` stay `default`)                                   |
| Commands               | `sododeck.newDeck` title **New Sododeck**; `sododeck.newNote` **New Sododeck note**; `sododeck.copyAsSododeck` **Copy as .sododeck** |
| Menus                  | explorer folder: New Sododeck, New Sododeck note; explorer file with name ending `.sododeck.json`: Copy as .sododeck                 |
| Setting                | none new; `sododeck.pictures.storage` applies to notes as to decks                                                                   |

## Opening a note

1. A text editor opens `X.sododeck.md`.
2. If the text has the marker (`isDeckMarkdown`) and the user did not choose "Open as text" for it in this session → reopen with the canvas.
3. Otherwise it stays text. "Open as text" on a canvas adds the file to the chosen-text set.

## File ↔ deck text

| Event                   | Behavior                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| open / hot-exit restore | `decode(markdown, fileText)`; on failure show the reason page and `Open as text`; file untouched |
| save                    | flush, then `encode(markdown, text, fileText)`; write via `writeDeckFile`                        |
| save as                 | destination name decides the kind; encode accordingly                                            |
| backup                  | writes the encoded file text                                                                     |
| outside change          | decode; if only the user's text changed, refresh `fileText` and send nothing                     |

## Pictures in a note

| Operation     | Behavior                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `picture-put` | as 069 (sibling `<name>.assets/`, relative path); the note's link list is produced by `toMarkdown` for plain relative paths only            |
| `picture-get` | relative to the note → else unique path-ending match in the workspace → guard → hash check; failures answer `picture-missing` with a reason |

## Copy as .sododeck (both hosts)

Input: a `.sododeck.json` file. Validate with the model; write `<name>.sododeck` next to it with the same text; never overwrite; original untouched. Errors: "not a Sododeck deck", "<name> already exists, used <name> 1", "could not write: <reason>".
