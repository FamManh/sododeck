# Contract: deck file naming and opening

## Saving

| Where                                 | File name                         | MIME               |
| ------------------------------------- | --------------------------------- | ------------------ |
| Library card menu → Export            | `<safeFileName(name)>.sododeck`   | `application/json` |
| Editor deck menu / inspector / status | `<safeFileName(name)>.sododeck`   | `application/json` |
| Export dialog → JSON (subtitle)       | label `.sododeck · re-importable` | n/a                |

`DECK_EXTENSION = '.sododeck'` is one constant in `storage/download.ts`; `deckFileName(name)`
is the only function that builds the name. A name that already ends in `.sododeck` or
`.sododeck.json` is not extended twice (the name is the deck name, not a file name, so this only
matters for decks named after a file). Content: `serializeDeck()` output, unchanged.

## Opening

1. File inputs: `accept=".sododeck,.json,application/json"` (library Import, editor deck menu).
   Drag and drop takes any file; the content decides.
2. Order of detection for text read from a file:
   1. Text (after BOM and whitespace) starts with `{` → deck JSON → existing `importFile`
      (including `unsupported-version` and `invalid-deck` messages).
   2. Otherwise → Mermaid detection (`import-mermaid/detect.ts`).
   3. Anything else → "That file is not a valid .sododeck file." (message text updated).
3. `.sododeck.json` and plain `.json` follow the same path; behaviour is identical to today.

## Visible text

- Buttons and labels: "Export .sododeck", "Import deck file (.sododeck)".
- Where a hint helps: "Older .sododeck.json files also open."

## Not changed

Monaco model path `sododeck://deck/current.sododeck.json` and its schema `fileMatch`
(internal; the JSON panel is read-only), sample file names under `apps/app/src/samples/`, the
`$schema` URL, `FORMAT_VERSION`, `FORMAT_REVISION`.
