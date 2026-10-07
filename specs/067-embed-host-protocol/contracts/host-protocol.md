# Contract: Sododeck host protocol, version 1

The document a host author reads (SC-007). It becomes `packages/host-protocol/README.md` when implemented. Types and Zod schemas live in `@sododeck/host-protocol`; this page is normative for both sides.

## Model

- The **host** embeds the editor in a frame (`<iframe src=".../embed.html">`, or a code editor's webview that loads `embed.html`). One frame = one editor = one deck file.
- The **file is the store.** The host owns the bytes on disk, dirty state, save, backup and where pictures live. The editor owns the canvas, the open document, selection, viewport and undo.
- Messages are plain JSON-compatible objects sent with `postMessage` (or the host's transport). Every message has `type`. `Uint8Array` fields are sent as is (structured clone).
- **Deck files travel as text** (`text: string`, the exact `.sododeck` file contents, UTF-8 decoded).

## Handshake

```
editor                                   host
  │── ready {protocolVersion, editorVersion} ──▶
  │◀── init {protocolVersion, text, theme, capabilities} ──
  │   (shows the deck, or its problems)
```

- The editor sends `ready` once, after it has loaded. It is the only message sent before `init` and carries no deck content.
- The editor accepts messages only from its parent window. From `init` on, it sends only to the origin `init` came from.
- `init.protocolVersion` must equal the editor's (`1`). Otherwise the editor sends `fatal` and shows which side needs an update; it then ignores everything but a later `init` with a matching version.
- No `init` within 10 s: the editor shows "The program hosting this editor did not send a deck" and keeps waiting.
- A second `init` is treated as `external-change` (theme and capabilities are taken from it too).

## Editor → host

| `type`          | Fields                                                    | When                                                                                                                                                                      |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ready`         | `protocolVersion: 1`, `editorVersion: string`             | Once, on load                                                                                                                                                             |
| `change`        | `seq: number`, `text: string`                             | ≤ 100 ms after the first edit of a burst; one per burst window; always the complete latest file, valid, canonical. `seq` increases by 1 per message. Never after a merge. |
| `flushed`       | `requestId: string`                                       | Answer to `flush`, after any pending `change` was sent                                                                                                                    |
| `picture-put`   | `id: string`, `type: string`, `name: string`, `bytes: Uint8Array` | A new picture, only when `capabilities.pictures`. `id` is the picture's SHA-256 (lowercase hex), as in the file's `assets` key                                           |
| `picture-get`   | `id: string`                                              | The deck names a picture the editor has no bytes for, only when `capabilities.pictures`                                                                                   |
| `open-link`     | `href: string`                                            | The user opens a link, only when `capabilities.openLinks`. `href` is `http:`, `https:` or relative to the deck file                                                       |
| `export-file`   | `name: string`, `mime: string`, `bytes: Uint8Array`       | The user exports (image, document, deck copy), only when `capabilities.exportFiles`. The host chooses where to save (usually asks the user)                                |
| `fatal`         | `code: 'protocol-version'`, `editorVersion`, `protocolVersion: 1` | Version mismatch at `init`                                                                                                                                         |

## Host → editor

| `type`                 | Fields                                                                                  | Meaning                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`                 | `protocolVersion: 1`, `text: string`, `theme: 'light' \| 'dark'`, `capabilities: Capabilities` | Start. `text` may be empty (a new file): the editor opens an empty deck                                                                              |
| `external-change`      | `text: string`                                                                          | The file changed outside the editor. Send the whole new text. Sending back a text the editor sent is harmless (ignored)                                     |
| `change-result`        | `seq: number`, `ok: boolean`, `reason?: string`                                         | Answer to `change`: `ok: true` means the host took the text (it is the file's current contents, saved or not). `ok: false` + `reason` shows an error. Answer within 5 s |
| `flush`                | `requestId: string`                                                                     | Before saving or closing: the editor sends what is pending, then `flushed`                                                                                  |
| `theme`                | `scheme: 'light' \| 'dark'`                                                             | The host's scheme changed                                                                                                                                   |
| `picture-stored`       | `id: string`, `path: string`                                                            | Answer to `picture-put`: stored at `path`, relative to the deck file's folder, following the file format's picture path rules (068). The editor writes it into the file |
| `picture-store-failed` | `id: string`, `reason: string`                                                          | Answer to `picture-put`: not stored. The editor keeps the picture embedded in the file                                                                      |
| `picture`              | `id: string`, `type: string`, `bytes: Uint8Array`                                       | Answer to `picture-get`                                                                                                                                     |
| `picture-missing`      | `id: string`, `reason: string`                                                          | Answer to `picture-get` when the host has no such picture. The editor shows it as missing with `reason`                                                     |

```ts
type Capabilities = {
  openLinks: boolean;   // the host can open http(s) and relative links
  exportFiles: boolean; // the host can save files the user exports
  pictures: boolean;    // the host stores pictures and answers picture-put / picture-get
};
```

Unknown capability keys and unknown message fields are ignored by the editor; a missing capability key means `false`. Unknown message types are ignored by both sides.

## Rules for hosts

1. Treat every `change.text` as the file's new contents; mark the file dirty and save it your usual way. Do not reformat it (the editor's text is canonical; a reformatted text would come back as an outside change).
2. Send `external-change` only for changes that did not come from the editor's `change` (a stale echo is ignored, but costs a parse).
3. Before saving or closing, send `flush` and wait for `flushed` (the editor answers within 1 s even when nothing is pending).
4. Refuse a `picture-stored` path that would resolve outside your workspace or vault; answer `picture-store-failed` instead (068 containment rule).
5. Never send deck content to anything but the editor frame.

## Editor guarantees

- Outside changes are merged in place (066): selection, viewport and the user's undo history stay; the merge is not an undo step and never produces a `change`.
- An invalid `init` or `external-change` text is never applied: the editor shows its problems, becomes read-only, and sends no `change` until a valid `external-change` arrives.
- No network requests, no browser storage, no service worker, no telemetry.

## Versioning

`protocolVersion` changes only for incompatible changes (a removed or retyped field, a changed meaning). New optional fields, message types and capability keys keep version 1.
