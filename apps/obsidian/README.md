# Sododeck for Obsidian

Open and edit [Sododeck](https://sododeck.com) architecture and flow diagrams inside your vault, as a canvas, next to your notes.

- **A deck is a note.** Decks are saved as `.sododeck.md` notes: the titles and descriptions of your cards, connections, flows and rules are readable text, so they show up in search and can be linked. Open a note and it opens as the canvas; "Open this deck as Markdown" shows the text.
- **Plain `.sododeck` files open too.** They are shown as the canvas and saved as the same plain file.
- **Saved as you work.** Edits reach the file within a second and when you close the pane or switch away. If the file changes outside the canvas (a sync, a script, an AI agent), the canvas updates in place.
- **Pictures stay linked.** Pictures you add are saved as files in your attachment folder and linked from the deck note, so Obsidian keeps the links correct when you move or rename them. (Setting: _Save new pictures_.)
- **Light and dark** follow Obsidian's theme.

## Private by design

The plugin makes no network requests of any kind and reads and writes only files in your vault. The canvas runs in an isolated frame that cannot reach the network, your other notes, or Obsidian itself.

## Bring a deck in

Export from the Sododeck web app (**Export .sododeck.md**) and drop the file into your vault, or run the command **New Sododeck deck** (also in the folder menu of the file list).

## Edit the text

In a `.sododeck.md` note you may change card titles and descriptions as text. Lines ending in `%%…%%` carry the id that ties the text to its card: keep them. Your text edits win over the saved deck data. Anything you write before or after the generated block stays as it is.

## Works on

Obsidian 1.5.7 or later, desktop and mobile.

## Known limits

- `.sododeck.json` files are not supported here; rename them to `.sododeck`.
- Cards cannot link to other notes yet.
- Obsidian's search also finds the generated deck data (ids and numbers), not only the readable text.

## Problems or ideas

Open an issue at <https://github.com/FamManh/sododeck/issues>.
