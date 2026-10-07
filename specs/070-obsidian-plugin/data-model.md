# Data model: Sododeck in Obsidian

No deck schema change. This feature adds one text container (the file's regions) and the host's in-memory state. Nothing here is stored outside the vault file and the plugin's one setting.

## File text (what is on disk)

| Part | Owner | Rule |
| --- | --- | --- |
| Front matter | shared | must contain `sododeck-plugin: parsed` for a `.md` deck; other keys kept verbatim on every write |
| Text before the owned region | user | copied from the previous file text; empty for a new file |
| **Owned region** (`%% sododeck:begin` … `%% sododeck:end %%`) | plugin | regenerated on write: readable part, picture list, deck block |
| Readable part | plugin writes, user may edit | titles and prose fields of the deck, each with an id marker; edits read back by id (readable wins) |
| Picture list | plugin writes, the app rewrites links | one line per picture; link text is the truth for `assets[id].path` on read |
| Deck block | plugin | the complete canonical deck JSON, `%%` escaped; truth for everything not in the readable part |
| Text after the owned region | user | copied from the previous file text |
| `.sododeck` file | plugin | the canonical deck JSON, nothing else (passthrough) |

## Readable-part entries (derived, never stored separately)

`ReadableEntry { id, field, kind: 'title' | 'body', value }`: produced by `toMarkdown` from the deck, consumed by `fromMarkdown`. `id` is the object's stable id (or `deck`); `field` is the schema field (`title`, `label`, `name`, `description`, `notes`, `text`). The set of (kind, field) pairs is the table in [contracts/markdown-form.md](contracts/markdown-form.md); it is generated from one constant in the model and checked against the schema's prose fields by a test.

## Host session state (memory only, per open deck view)

| Field | Type | Purpose |
| --- | --- | --- |
| `kind` | `'plain' \| 'markdown'` | which codec |
| `lastDeckText` | `string` | the deck text last sent to or received from the canvas; echo and equality checks (FR-013, FR-019) |
| `lastFileText` | `string` | the file text last read or written; `previous` for `toMarkdown`; skip-equal-write check (FR-013) |
| `pendingText` | `string \| undefined` | newest deck text not yet written; retried until written (FR-016) |
| `writeInFlight` | `Promise \| undefined` | serialises writes (R4) |
| `seq` | `number` | last `change.seq` seen; ack target |
| `capabilities` | `Capabilities` | what was declared in `init` (`pictures` only for `.sododeck.md` + setting `attachments`) |
| `theme` | `'light' \| 'dark'` | last scheme sent |
| `invalid` | `boolean` | the last decoded file was invalid; no writes until a valid file arrives (FR-021) |
| `pendingPictures` | `Set<AssetId>` | ids reported missing, re-resolved on vault events (FR-026) |
| `closed` | `boolean` | after unload: ignore everything, send nothing |

No deck data is held except the two texts above (Principle I): the canvas owns the document.

## Setting (persisted with `saveData`)

`{ pictureStorage: 'attachments' | 'embedded' }`, default `attachments`. Read when the capability is computed and when a picture is put.

## State transitions (session)

```text
created ──ready──▶ initialised ──change──▶ writing ──ok──▶ initialised
                       │  ▲                  │ fail
                       │  └──────retry───────┘ (pendingText kept)
                       ├─ file changed (valid) ─▶ external-change ─▶ initialised
                       ├─ file changed (invalid) ─▶ invalid (read-only canvas, no writes) ─valid file─▶ initialised
                       ├─ file deleted ─▶ missing (no writes) ─file back─▶ initialised
                       └─ unload/close/hidden/quit ─flush─▶ flushing ─▶ closed (write pending text first)
```

## Validation rules carried from the spec

- A write only follows a `change` (FR-015); never for an equal file (FR-013), an invalid file (FR-021) or a deleted file (FR-022).
- Picture link text passes `checkPicturePath` before it is stored (FR-027); anything resolving outside the vault is refused with its reason.
- A served picture must match its id and size (FR-028).
- Titles and notes read back from the readable part must be valid schema values or are ignored (markdown-form rule 3).
- Ids are never created, changed or removed by reading or writing the Markdown form (Principle III).
