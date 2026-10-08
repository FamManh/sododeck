# One folder, two tools

A folder of Sododeck decks can be an Obsidian vault and a VS Code workspace at the same time. Each deck opens as a canvas in both.

## The shared form: `.sododeck`

`.sododeck` is the plain file both tools open and save. Edit a deck in one tool and the other shows the change within a second of the file being written. If the other tool has unsaved edits in that deck, the file on disk wins and a short notice says so.

## What `.sododeck.md` adds

A `.sododeck.md` note holds the same deck as readable text plus the full deck data. In Obsidian this gives:

- search by card text,
- backlinks and links,
- picture links that follow when you move or rename a file.

VS Code opens a `.sododeck.md` note as a canvas too. Text you write before or after the generated part of the note is kept when you save. A Markdown file without the Sododeck marker stays a normal text file, and **Open as text** shows the Markdown of any note.

Pick `.sododeck.md` if you want those Obsidian gains; pick `.sododeck` if you want the simplest file. **Save As** in VS Code converts between the two by the new file's name.

## Bring in a `.sododeck.json`

Older decks may be `.sododeck.json` files. VS Code opens them directly. Obsidian does not, so in either tool run **Copy as .sododeck** (VS Code: right-click the file in the Explorer; Obsidian: the command **Copy .sododeck.json as .sododeck**). It writes a `.sododeck` next to the original, never overwrites a file, and leaves the original unchanged. Renaming the file to `.sododeck` works too.

## Pictures

- **`.sododeck`**: pictures are stored inside the file, or as image files in a folder `<name>.assets/` next to it, depending on the picture setting.
- **`.sododeck.md`**: pictures are image files, linked from the note under a Pictures list. In Obsidian they go to your attachment folder and the links follow moves. VS Code writes `<name>.assets/<file>` links and also finds pictures Obsidian linked by a short name, as long as they are inside the workspace and the name is unique.

Pictures are only read or written inside the folder you opened.

## Editing both at once

The file wins. If a deck changes on disk while you have unsaved edits to it in the other tool, the newer file replaces your edits after a notice. Save often, or keep a deck open in one tool at a time.
