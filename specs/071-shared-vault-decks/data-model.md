# Data Model: Shared Vault Decks

No change to the deck schema, the `.sododeck` file or the `.sododeck.md` form. Host-side state only.

## DeckDocument (VS Code, extended)

| Field           | Meaning                                                                           |
| --------------- | --------------------------------------------------------------------------------- |
| `loc`           | the file's location                                                               |
| `kind`          | `plain` or `markdown`, from the name (`.md` suffix)                               |
| `text`          | the deck text the canvas last sent (or started with): always deck text            |
| `fileText`      | the file text last read or written; `previous` for `toMarkdown`                   |
| `savedDeckText` | `decode(fileText)`, what a clean document's `text` equals                         |
| `lastWritten`   | file text of our last save, to recognise its echo                                 |
| `problems`      | set when a note cannot be decoded; the document is then read-only and never dirty |
| `dirty`         | `text !== savedDeckText \|\| missing` (unreadable: false)                         |

Transitions:

- open: read file → `fileText`; `decode` → `text`, `savedDeckText` (or `problems`).
- canvas change: `text` replaced (seq rule unchanged).
- save: `encode(kind, text, fileText)` → write → `fileText`, `savedDeckText = text`, `lastWritten`.
- disk read: equals `lastWritten` or `fileText` → nothing. Else `decode`: if deck text equals `text` or `savedDeckText` → only `fileText` refreshed; otherwise replaced, clean, canvas told (`external-change`).
- revert: disk wins, same as a disk replace.

## FileKind / Decoded

Same shape as `apps/obsidian/src/file-codec.ts`: `Decoded = { ok: true; deckText } | { ok: false; problems: { message; fix }[] }`.

## NoteSwapFacts (pure input to `shouldSwapToCanvas`)

`{ fileName, hasMarker, chosenText: boolean }` → swap iff name ends `.sododeck.md`, `hasMarker`, and not `chosenText`.

## CopyResult (both hosts)

`{ ok: true; path } | { ok: false; reason }`; reasons: not a deck, no free name, could not write.

## Picture link (note)

`assets[id].path` as written by either host. Resolution order for a note: relative to the note, then unique path-ending match in the workspace; both inside the workspace; bytes must hash to `id`.
