# Contract: app and model additions (067)

## `@sododeck/host-protocol` (new package, TypeScript source)

```ts
export const PROTOCOL_VERSION = 1;

export type Capabilities = { openLinks: boolean; exportFiles: boolean; pictures: boolean };
export type EditorMessage = Ready | Change | Flushed | PicturePut | PictureGet | OpenLink | ExportFile | Fatal;
export type HostMessage = Init | ExternalChange | ChangeResult | Flush | Theme
  | PictureStored | PictureStoreFailed | Picture | PictureMissing;

export const editorMessageSchema: z.ZodType<EditorMessage>;
export const hostMessageSchema: z.ZodType<HostMessage>;
/** Narrow unknown input; `null` for anything that is not a valid message of that side. */
export function parseEditorMessage(value: unknown): EditorMessage | null;
export function parseHostMessage(value: unknown): HostMessage | null;

export interface Transport<Out, In> {
  send(message: Out): void;
  listen(handler: (message: In) => void): () => void;
}
/** Editor side: posts to `window.parent`, accepts only `event.source === window.parent`,
 *  pins the target origin to the origin of the first valid `init`. */
export function parentWindowTransport(win?: Window): Transport<EditorMessage, HostMessage>;
/** Host side: posts to an iframe's window, accepts only `event.source === frame.contentWindow`. */
export function frameTransport(frame: HTMLIFrameElement, origin: string): Transport<HostMessage, EditorMessage>;
/** In-memory pair for tests: messages are delivered asynchronously (microtask), as clones. */
export function memoryTransportPair(): {
  editor: Transport<EditorMessage, HostMessage>;
  host: Transport<HostMessage, EditorMessage>;
};

/** Scripted host: records traffic, answers change / flush / pictures per its options. */
export function createFakeHost(
  transport: Transport<HostMessage, EditorMessage>,
  options?: FakeHostOptions,
): FakeHost;
```

Boundaries: no React, no Yjs, no `@sododeck/model`; depends on `zod` only. Unknown keys are stripped (forward compatible), unknown `type`s parse to `null`.

## `@sododeck/model`

```ts
// DeckEditor (068's AssetMeta.path required)
/** Records where the host stored a picture: `path` written into `meta.assets[id]` (and `data`
 *  dropped from the file for it); `null` removes the path. Untracked origin: saved and synced,
 *  never an undo step. Validates the path with the schema's `checkPicturePath`
 *  (DeckEditError 'invalid'); 'not-found' when the deck has no such picture. No change event when equal. */
setPicturePath(id: AssetId, path: string | null): void;
```

Round-trip test: a deck with a path set by the op serialises with `path` and no `data`, and loads back equal.

## `apps/app`

| Module                              | Kind    | Contract                                                                                                                                                                                                           |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `embed.html`, `vite.embed.config.ts` | build   | Embed entry → `dist-embed/` (`base: './'`, no PWA plugin). `pnpm --filter @sododeck/app build` builds both; `scripts/check-embed-bundle.mjs` fails on library, service worker, telemetry or `localStorage` theme code |
| `src/embed/main.tsx`                | entry   | Renders `EmbedApp` with `parentWindowTransport()`. No `initTheme`, `getLibraryDb`, `initTelemetry`                                                                                                                 |
| `src/embed/embed-app.tsx`           | React   | `EmbedApp({ transport })`: handshake, version check, waiting / fatal / problems states, memory router, `EditorShell` in host mode                                                                                  |
| `src/embed/embed-store.ts`          | Zustand | UI-only: `phase` (`waiting` / `fatal` / `open` / `blocked`), problems, capabilities, host error                                                                                                                    |
| `src/embed/host-persistence.ts`     | pure-ish | `attachHostPersistence(doc, send, { flushMs = 100, ackTimeoutMs = 5000, snapshot, pictureBytes, onError })` → `{ flush(): Promise<void>; applyExternal(text): ApplyResult \| 'echo'; handleResult(msg); setBlocked(b); destroy() }` |
| `src/embed/host-picture-store.ts`   | store   | `hostPictureStore(send, capabilities, onStored)` implements `PictureStore` + `receive(msg)` for picture answers                                                                                                     |
| `src/embed/host-origin.ts`          | const   | `hostOrigin` (frozen object); `storage/origins.ts` `isOwnUpdate` returns false for it                                                                                                                              |
| `src/editor/editor-shell.tsx`       | React   | `EditorShell({ doc, save, pictures, services, host, extras })` moved out of `routes/editor-page.tsx`; imports no storage module                                                                                    |
| `src/editor/deck-services.ts`       | context | `DeckServicesContext: { openLibrary(); duplicateDeck(); importAsNewDeck(file) } \| null` (web: library-backed; embed: `null`, controls hidden)                                                                      |
| `src/editor/embed-host-context.ts`  | context | `EmbedHostContext` + `useOpenLink()` and `useSaveFile()` (web defaults: `window.open`, `downloadBlob`; embed: host messages, or `null` when the capability is off → control not rendered)                          |
| `src/editor/save-context.ts`        | type    | `SaveMode` gains `'host'`: no save indicator; ⌘S → flush                                                                                                                                                           |
| `src/theme/theme-store.ts`          | fn      | `setThemeFromHost(scheme)`: class + store, no `localStorage`; unknown → light                                                                                                                                      |
| `src/lib/features.ts`               | fn      | `supportsWorkers()` also false when constructing a module worker throws (sandboxed frame)                                                                                                                         |
| `src/routes/embed-host-page.tsx`    | dev     | `/embed-host` route, `import.meta.env.DEV` only: iframe of `/embed.html`, deck picker / paste, scheme + capability toggles, simulate outside change, refuse next change, picture answers, message log          |

### Unchanged behaviour (regression contract)

- The web app at `/`, `/deck/:id`: library, storage, multi-tab channel, offline cache, telemetry settings, save indicator, theme toggle — identical; existing tests unchanged except for moved imports.
- `pnpm e2e` smoke suite (incl. no third-party requests) passes unchanged.
