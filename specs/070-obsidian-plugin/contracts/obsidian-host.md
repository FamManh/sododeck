# Contract: the Obsidian host (`apps/obsidian`)

Normative text for the plugin's host side. Protocol: `packages/host-protocol` (067, version 1). Format: [markdown-form.md](markdown-form.md) and the deck format.

## Manifest

```json
{
  "id": "sododeck",
  "name": "Sododeck",
  "version": "<semver>",
  "minAppVersion": "1.5.7",
  "description": "Open and edit Sododeck architecture decks (.sododeck.md and .sododeck) as a canvas. Works offline; sends nothing over the network; reads and writes only your vault.",
  "author": "<author>",
  "isDesktopOnly": false
}
```

`versions.json` maps each plugin version to its `minAppVersion`. `minAppVersion` is raised only if a used API needs it (`getAvailablePathForAttachment` is 1.5.7). Release assets: `main.js`, `manifest.json`, `styles.css`.

## Files and views

| File | Recognised by | View | Codec |
| --- | --- | --- | --- |
| `*.sododeck` | extension registration (`registerExtensions(['sododeck'])`) | deck view | passthrough (canonical JSON text) |
| `*.md` with front matter `sododeck-plugin: parsed` | marker via the metadata cache, then the leaf's view is swapped | deck view | `toMarkdown` / `fromMarkdown` |
| any other Markdown file, `.sododeck.json`, any other file | not ours | the app's own | n/a |

- A leaf with state `sododeckSource: true` stays a Markdown view (the user chose "Open this deck as Markdown"). Removing the marker returns the view to Markdown.
- The deck view is a `TextFileView`. `getViewData()` returns the text to write; `setViewData(data, clear)` receives the file text; `clear()` destroys the frame state.
- One frame (one `HostSession`) per open deck view. Closing the view destroys the frame.

## The frame

- `iframe` with `srcdoc` = the single-file embed, `sandbox="allow-scripts"` (no `allow-same-origin`, no `allow-top-navigation`, no `allow-popups`), `title="Sododeck canvas"`, sized to fill the pane. CSP in the page: `default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:; connect-src blob: data:`.
- Transport: the host posts to `iframe.contentWindow` with target origin `'*'` (the frame's origin is opaque) and accepts a message only if `event.source === iframe.contentWindow` **and** it parses with `parseEditorMessage`. Everything else is ignored (067 rule 3, FR-035).
- Binary payloads (`picture`, `picture-put` bytes) are `Uint8Array`; large ones use transfer lists.
- Fallback sandbox (spike S2): adding `allow-same-origin` is allowed only if blob workers need it; recorded in ADR 0052.

## Session: events ↔ messages

| Trigger | Host does | Message |
| --- | --- | --- |
| frame sends `ready` | decode the file (codec), read theme, compute capabilities | → `init { protocolVersion: 1, text, theme, capabilities }` |
| `ready` with another version | nothing (the editor shows "update the plugin" and sends `fatal`); the host shows a `Notice` naming which side to update | – |
| `change { seq, text }` | encode (codec), compare with last written/read; if different: set view data, `save()`, remember it as last | → `change-result { seq, ok }` after the write; `ok: false, reason` on failure |
| view unload, close, app hidden, app quit | `flush` → await `flushed` (1.5 s) → write the pending text | → `flush { requestId }` |
| file changed in the vault (`setViewData(data, false)`) | decode; compare the deck text with the last sent/received; if different: | → `external-change { text }` |
| decode fails (no deck block, not JSON) | show the problems in the frame by sending the raw text? **No**: a Markdown file whose deck block cannot be read is shown as an error pane by the view (plain reason + "Open as Markdown"); no message | – |
| app theme class changes (`css-change`) | re-read `theme-dark` | → `theme { scheme }` |
| setting `pictureStorage` changes while open | recompute capabilities; if changed | → second `init` with the same text and new capabilities |
| `picture-put { id, mime, name, bytes }` | picture rules below | → `picture-stored { id, path }` or `picture-store-failed { id, reason }` |
| `picture-get { id }` | picture rules below | → `picture { id, mime, bytes }` or `picture-missing { id, reason }` |
| frame sends `open-link` / `export-file` | never (capabilities false); ignore | – |

Capabilities declared: `openLinks: false`, `exportFiles: false`, `pictures: true` only when the setting is `attachments` **and** the open file is a `.sododeck.md` note, else `false`.

Never sent: any message for a change that equals the file already on disk; `external-change` for the plugin's own write; anything on a closed view.

## Writing

- Writes are serialised per file: one in flight, the newest text queued; the result of each is reported with `change-result` for the `seq` it carried (a queued text replaced by a newer one reports the newer `seq` only; the editor handles a missing ack for an older `seq` as taken because a later `change` supersedes it, 067).
- A write that would produce a file equal to the current file is skipped (`change-result ok: true`).
- Failure: a `Notice` with the app's error in plain words, `change-result { ok: false, reason }`, the text stays pending and is retried on the next `change`, on `flush`, and on close. The plugin never drops a pending text silently.
- Nothing is written when: the frame has reported no change, the file is invalid (read-only canvas), the file was deleted (no recreation), or the view is closed.

## Pictures

**Store** (`picture-put`, only when `pictures` is declared):

1. `name = <first 16 hex of id>.<ext>` (`ext` from `mime`: png, jpg, webp, gif, svg, avif).
2. `target = fileManager.getAvailablePathForAttachment(name, deckPath)`.
3. If `basename(target) !== name`, a file with `name` exists in that folder: read it; if its SHA-256 equals `id`, **reuse** it (do not write); otherwise use `target` (the app's deduplicated name). Never overwrite.
4. New file: `vault.createBinary(target, bytes)` (the app creates the folder as its settings say).
5. `link = metadataCache.fileToLinktext(file, deckPath, false)`. If `checkPicturePath(link)` is not `null`, answer `picture-store-failed` with its plain text (the file written in step 4 stays; the picture is embedded). Else answer `picture-stored { id, path: link }`.
6. Any error: `picture-store-failed { reason }` and a `Notice`; the picture stays embedded (FR-029).

**Serve** (`picture-get`): find `assets[id].path` in the current deck text; `vault-guard` first (reason "outside the vault" for a path leaving the root, an absolute path or a scheme); resolve with `metadataCache.getFirstLinkpathDest(path, deckPath)` for a `.sododeck.md` note, or `normalizePath(join(dirname(deckPath), path))` + `vault.getFileByPath` for a plain `.sododeck`; not found → `picture-missing { reason: 'not found: <path>' }` and remember `id` as pending; found → `vault.readBinary`, size ≤ 5 MiB and SHA-256 = `id`, else `picture-missing { reason: 'the file changed' }`.

**Late and moved**: on vault `create`, `rename`, `modify`, re-resolve each pending id; when one now resolves and verifies, send `picture { id, mime, bytes }` (G2 in research).

**Reading overrides** (markdown-form rule 5): the visible `[[link]]` in the picture list is the truth for `assets[id].path`, so a move or rename done by the app reaches the deck on the next read; the plugin has no link-rewriting code.

## Commands, menu, settings

| Entry point | Title | Does |
| --- | --- | --- |
| Command palette | `New Sododeck deck` | create `<folder of active file or vault root>/Untitled deck.sododeck.md` (numbered if taken, never overwrite) from the empty deck, open it |
| Folder menu in the file list (`file-menu` for a folder) | `New Sododeck deck` | same, in that folder |
| Command palette (when the active leaf is a deck) | `Open this deck as Markdown` | leaf state `sododeckSource: true`, reopen as Markdown |
| Command palette (when the active leaf is a deck note shown as Markdown) | `Open this deck as canvas` | clear the flag, swap |
| Settings tab "Sododeck" | `Save new pictures` | `In the attachment folder (recommended)` / `Inside the deck file`; default the first; nothing else |

## Notices (plain words)

- Edits replaced: `Sododeck: this deck was changed outside the canvas, so your last edits were replaced.`
- Write failed: `Sododeck could not save "<name>": <reason>. Your edits are kept and will be saved on the next change.`
- Picture not stored: `Sododeck kept this picture inside the deck: <reason>.`
- Version mismatch: shown in the frame by the editor (067) and as a `Notice` naming the side to update.

## Bundle guard (`scripts/check-bundle.ts`, run after build)

Fails if `main.js`: contains `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, `importScripts` with a URL, `http://` or `https://` URLs other than allow-listed documentation strings in comments/license text, any `posthog`/`sentry`/analytics marker, or the embed's forbidden markers from `apps/app/scripts/check-embed-bundle.mjs`; if the embed HTML inside has an absolute `src`/`href`; or if `main.js` exceeds the size budget. Passes only on exact release asset names.
