# @sododeck/host-protocol

**Responsibility:** the message contract between the embedded editor (`apps/app` embed build) and a host program (code editor extension, note-taking plug-in, web page). Normative text: `README.md` (from `specs/067-embed-host-protocol/contracts/host-protocol.md`).

**Boundaries:** no React, no Yjs, no `@sododeck/model`; depends on `zod` only. Messages carry deck file **text**; validating the deck is the editor's job. TypeScript source, no build step.

## API (`src/index.ts`)

- `PROTOCOL_VERSION` (1), `Capabilities`, `EditorMessage`, `HostMessage`, `editorMessageSchema`, `hostMessageSchema`, `parseEditorMessage(value)` / `parseHostMessage(value)` → message or `null`. Unknown keys are stripped, unknown `type`s give `null`, capabilities default to `false`, `reason` is cut to 300 characters. A picture's media type is `mime` (the `type` key is the discriminator).
- `Transport<Out, In>` (`send`, `listen` → unlisten); `parentWindowTransport(win?)` (editor side: only `event.source === parent`, sends only `ready` before `init`, then pins the target origin to the first valid `init`), `frameTransport(frame, origin)` (host side), `memoryTransportPair()` (`{ editor, host }`, async, structured clone).
- `createFakeHost(hostTransport, options?)` → `FakeHost`:
  - options (`FakeHostOptions`, also mutable as `fake.options`): `text`, `theme`, `capabilities`, `protocolVersion` (default 1), `autoInit` (`false`: do not answer `ready` with `init`; call `sendInit()`), `answerChanges` (`false`: never answer `change`), `pictures` (`Map<id, { mime, bytes }>` served for `picture-get`), `refusePictures`.
  - `log: { dir: 'in' | 'out', message, at }[]` (in = from the editor), `lastText()`, `sendInit()` (also automatic on `ready`), `sendExternal(text)`, `setTheme(scheme)`, `flush()` (resolves on the matching `flushed`), `refuseNextChange(reason)` (one `change-result ok: false`).
  - `picture-put` is answered `picture-stored { path: 'assets/<name>' }`, or `picture-store-failed` with `refusePictures`; `picture-get` of an unknown id is `picture-missing`.
