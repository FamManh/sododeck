# Data model: Embed the editor in a host program (067)

No file-format change in 067. The deck file is 068's format (picture `path`). All state below is UI-only or in-flight; the Yjs document stays the single source of truth for the deck.

## Protocol messages

Full field list and rules: [contracts/host-protocol.md](contracts/host-protocol.md). Validation (Zod, `@sododeck/host-protocol`):

| Field                  | Rule                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `type`                 | one of the listed literals; anything else → message ignored          |
| `protocolVersion`      | positive integer                                                     |
| `text`                 | string (may be empty only in `init`); size limit none in the protocol (the deck format's limits apply) |
| `seq`                  | non-negative integer                                                 |
| `requestId`            | string, 1…100                                                        |
| `theme`, `scheme`      | `'light' \| 'dark'`; any other string is accepted and read as light  |
| `capabilities`         | object; each of `openLinks`, `exportFiles`, `pictures` boolean, missing → false; extra keys dropped |
| `id` (pictures)        | 64 lowercase hex characters                                          |
| `bytes`                | `Uint8Array`                                                         |
| `path`                 | string; checked by the editor with 068's `checkPicturePath` before it is written (invalid → treated as `picture-store-failed`) |
| `href`                 | `http:`/`https:` URL or relative reference (same rule as `lib/links.ts` `parseLinkInput`) |
| `reason`               | string, shown to the user, truncated to 300 characters               |

## Embed state (`embed-store.ts`, Zustand, UI-only)

| Field          | Type                                                        | Notes                                                    |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| `phase`        | `'waiting' \| 'slow' \| 'fatal' \| 'open' \| 'blocked'`     | see transitions                                          |
| `fatal`        | `{ side: 'editor' \| 'host' } \| null`                      | which side needs an update                               |
| `problems`     | `ProblemEntry[]`                                            | from 066's refusal (062 entries); shown while `blocked`  |
| `capabilities` | `Capabilities`                                              | from the latest `init`                                   |
| `hostError`    | `string \| null`                                            | refused or unanswered `change`; cleared on the next ok   |

### Phase transitions

```
waiting ──(10 s, no init)──▶ slow ──init──▶ (same as below)
waiting ──init, version ≠ 1──▶ fatal ──init, version = 1──▶ …
waiting ──init, valid text──▶ open
waiting ──init, invalid text──▶ blocked (no deck shown)
open ──external-change invalid──▶ blocked (deck shown, inert)
blocked ──external-change valid──▶ open (merged; if no deck yet, opened)
open/blocked ──external-change equal to a recently sent text──▶ unchanged (echo)
```

## Host persistence (in `host-persistence.ts`, not React state)

| Field            | Type               | Notes                                                               |
| ---------------- | ------------------ | ------------------------------------------------------------------- |
| `dirty`          | boolean            | an own update since the last send                                   |
| `timer`          | timeout \| none    | armed by the first dirty update, 100 ms                             |
| `seq`            | number             | last `change.seq` sent                                              |
| `recentSent`     | string[] (≤ 8)     | texts sent since the last applied outside change (echo check, R5)   |
| `awaiting`       | `Map<seq, timeout>` | 5 s timers for `change-result`                                    |
| `blocked`        | boolean            | mirrors `phase === 'blocked'`: nothing is sent                      |

## Host picture store (in `host-picture-store.ts`)

| Field      | Type                                   | Notes                                                   |
| ---------- | -------------------------------------- | ------------------------------------------------------- |
| `bytes`    | `Map<AssetId, StoredPicture>`          | pictures the editor has (from files, answers, new ones) |
| `pending`  | `Map<AssetId, Promise<Blob \| null>>`  | one `picture-get` per id at a time; 10 s timeout → null |
| `missing`  | `Map<AssetId, string>`                 | reason from `picture-missing` / timeout                 |

## Model addition

`meta.assets[id].path` (068) is written by `editor.setPicturePath(id, path | null)` with the untracked origin. No other document key is added.

## Origins

| Origin          | Own update (sent to host)? | Undo tracked? |
| --------------- | -------------------------- | ------------- |
| editor tracked  | yes                        | yes           |
| editor untracked (frames, views, `setPicturePath`) | yes | no      |
| `hostOrigin` (066 merge of `init`/`external-change`) | **no** | no |
