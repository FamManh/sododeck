# Data Model: Sododeck in VS Code

No file-format change. These are the extension's in-memory shapes; none is persisted except through the deck file, picture files and the editor's own backup.

## DeckDocument (one per open file; the custom editor's document)

| Field         | Type           | Notes                                                                                                    |
| ------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `uri`         | URI            | The deck file; may be `untitled:` for a new unsaved deck                                                 |
| `text`        | string         | The latest file text from the canvas (`change.text`), or the text it was started with. Never reformatted |
| `savedText`   | string         | What the disk held when last read or written by us                                                       |
| `lastWritten` | string \| null | Text of our last save, used to ignore its echo (R6)                                                      |
| `lastSentSeq` | number         | Highest `change.seq` seen; stale or repeated seq ignored                                                 |
| `dirty`       | derived        | `text !== savedText` (VS Code's own mark follows the events we fire)                                     |
| `problems`    | list \| null   | From the model's check at open and at each outside change; drives the "Open as text" notice              |

**Transitions**

- open → `text = savedText = disk` (or backup text with `savedText = disk`, dirty).
- `change` (ok) → `text = change.text`; fire content-change if `text !== savedText`; answer `change-result ok`.
- save → flush, write, `savedText = lastWritten = text`.
- outside change (text ≠ `text`, ≠ `savedText`, ≠ `lastWritten`) → `external-change`; `text = savedText = disk`; clear mark (R3); notice if it was dirty.
- revert → `text = savedText = disk`, `external-change`.
- invalid disk text → keep `text`, show problems (067 read-only), no write ever.

## HostSession (one per webview)

| Field             | Type                              | Notes                                                |
| ----------------- | --------------------------------- | ---------------------------------------------------- |
| `phase`           | `'waiting' \| 'ready' \| 'fatal'` | `ready` message → `init`; version mismatch → `fatal` |
| `capabilities`    | `Capabilities` (067)              | Computed from the setting, deck location, trust (R8) |
| `scheme`          | `'light' \| 'dark'`               | From the colour theme kind                           |
| `pendingFlush`    | map requestId → resolver          | Save waits on `flushed`                              |
| `pendingPictures` | map id → state                    | In-flight `picture-put` / `picture-get`              |

## PictureEntry (read from the deck text through the model)

`{ id, type, size, name, path }` as in 068. The extension reads `path`; it writes `path` only through `picture-stored`, which the canvas puts in the file.

## Setting

| Key                         | Values          | Default | Scope                           |
| --------------------------- | --------------- | ------- | ------------------------------- |
| `sododeck.pictures.storage` | `embed`, `file` | `embed` | user, overridable per workspace |

## Messages

Exactly 067's protocol v1 (`specs/067-embed-host-protocol/contracts/host-protocol.md`); the mapping to VS Code is in `contracts/extension-host.md`.
