# Research: Embed the editor in a host program (067)

Each item: **Decision**, **Rationale**, **Alternatives considered**. Codebase facts were read on `main` at `4f81537b` (066 merged) and on the `068-picture-file-refs` branch (`2327c5ba`).

## R1. A separate embed build, not a route of the web app

- **Decision:** a second Vite config, `apps/app/vite.embed.config.ts`, with its own HTML entry `apps/app/embed.html` → `src/embed/main.tsx`, building to `apps/app/dist-embed/` with `base: './'` and **without** `vite-plugin-pwa`. `apps/app`'s `build` script runs both builds (`vite build && vite build -c vite.embed.config.ts`); turbo's `outputs` gains `dist-embed/**`. Hosts (069, 070) copy `dist-embed/` the way the site copies the skill archive.
- **Rationale:** FR-020–FR-022 and SC-006 require the embed code to contain no library (Dexie), offline cache (workbox) or telemetry (Sentry, PostHog). A separate entry only pulls what it imports, and a separate config keeps the PWA plugin out entirely (it injects a service-worker registration into HTML pages it builds). Hosts load files from a non-root, non-http location (`vscode-webview://…`, `app://…`), so asset URLs must be relative (`base: './'`), which the web app cannot use with its client-side routes.
- **Alternatives:** (a) an `/embed` route in the SPA: drags in Dexie through the shared chunks, the service worker would control it, `base` stays `/`; rejected. (b) One Vite config with two `rollupOptions.input`s: shares `base` and the PWA plugin; rejected.

## R2. Keeping storage out of the editor code that both builds share

- **Decision:** split `routes/editor-page.tsx` into a storage-free `editor/editor-shell.tsx` (the `EditorShell` + `EditorChrome` + `CanvasScreen` it has today, taking `save`, `pictures`, `deckServices` and `extras` as props) and the web wiring that stays in `editor-page.tsx` (`stored` / `memory` / `demo`). The four editor modules that import storage today get it through a new React context, **`DeckServicesContext`** (`editor/deck-services.ts`): `deck-menu.tsx` (open library, duplicate), `import-dialog.tsx` and `mermaid-import-dialog.tsx` (import as a new deck), `deck-deleted-dialog.tsx` (rendered only by the web wiring). The web editor page provides the library-backed implementation; the embed provides `null`, and each control that needs it is not rendered.
- **Rationale:** a static `import … from '../storage/library-db-instance'` anywhere in the editor tree puts Dexie in the embed bundle. A context of capabilities is the same pattern as `SaveContext` and `PictureStoreContext` and keeps the editor testable with a fake.
- **Alternatives:** dynamic `import()` of storage inside each handler: Vite still emits the chunk into `dist-embed/` (SC-006 is about the delivered code), and every call site needs an embed check anyway; rejected.
- **Guard:** `apps/app/scripts/check-embed-bundle.mjs`, run after the embed build, fails when any emitted file contains a marker of the excluded code (`Dexie`, `workbox`, `serviceWorker.register`, `posthog`, `@sentry`, `sododeck:theme` localStorage key, `indexedDB.open`). It is a build step, not an e2e test.

## R3. Transport and who may talk to the editor

- **Decision:** the protocol is a set of plain messages over a **`Transport`** (`send(message)`, `listen(handler) → unlisten`). 067 ships `windowTransport(target, self)` (`postMessage` to `window.parent`) and `memoryTransportPair()` (tests, the fake host's unit tests). 069 adds the code editor's transport without touching the protocol.
  - The editor accepts a message only when `event.source === window.parent` (FR-004).
  - Before `init`, the editor sends only `ready` (no deck content), with target origin `'*'` because a host's origin is not known in advance (`vscode-webview://<random>`, `app://obsidian.md`). From `init` on it sends **only to `event.origin` of that `init`**, so deck content never goes to another origin.
  - Every received message is parsed with the protocol's Zod schemas; failures are dropped with one `console.warn` (FR-004, edge case "message the editor does not understand").
- **Rationale:** `postMessage` is the only channel between a frame and its parent; checking `source` blocks other frames and pop-ups; pinning the origin at `init` prevents a navigated parent from receiving content.
- **Alternatives:** a `hostOrigin` query parameter: the host's origin is random in the code editor and the parameter is spoofable by whoever builds the URL; rejected. `MessageChannel` port handed over in `init`: cleaner isolation but every host must create and transfer a port; kept as a later option (the `Transport` interface allows it).

## R4. Sending edits: whole file, dirty flag, 100 ms window

- **Decision:** `attachHostPersistence(doc, bridge, options)` (`src/embed/host-persistence.ts`), modelled on `attachDeckPersistence`: on a Yjs `update` with an own origin (`isOwnUpdate`, extended with `hostOrigin`), it sets a dirty flag and arms one timer for **100 ms after the first** dirty update (not a debounce). When the timer fires it serialises the whole deck (`serializeDeck(readDeck(doc), pictureBytes)`) and sends `change { seq, text }`. Updates during serialisation re-arm the timer. `flush` sends at once.
- **Rationale:** 100 ms after the first edit bounds delivery at ~100 ms + serialisation (≈ 10–30 ms for 500/1,000, measured in 066's bench) < 200 ms (FR-008, SC-002), and a typing burst produces one message per 100 ms window, never one per key. Sending the whole text (not Yjs updates) keeps the host simple and the disk file readable (backlog architecture). Because each message carries the full latest state, skipping intermediate states is safe (US2 scenario 2).
- **Alternatives:** debounce until idle: a long drag would send nothing for its whole length; rejected. Yjs updates: hosts store text; rejected by the backlog.

## R5. Echo and stale echoes

- **Decision:** (a) structural: an outside file is applied with `applyDeckText(doc, text, hostOrigin)` (066); `hostOrigin` is not an own origin, so the merge never triggers a send (FR-013). (b) Short-circuit: the persistence keeps the **texts sent since the last applied outside change** (at most 8, oldest dropped); an incoming `external-change` whose text equals any of them is ignored without parsing.
- **Rationale:** some hosts report the editor's own write back as a document change, possibly late. If the editor sent v2, then the user edited (v3 pending), a late echo of v2 applied by 066 would revert v3 on the canvas. Ignoring any recent own text prevents that. Equality of text is exact because the editor produced it in canonical form.
- **Alternatives:** compare with the last sent text only (backlog): misses the late-echo case; rejected. Sequence numbers in the host's echo: the host would have to track them through its file system; rejected.

## R6. Invalid outside files and the read-only state

- **Decision:** a refused `applyDeckText` (or an invalid `init` file) puts the embed in **`blocked`** state (`src/embed/embed-store.ts`, Zustand, UI-only): the editor root gets the HTML `inert` attribute (no pointer, keyboard or focus inside it; the canvas stays visible as it was), a notice above it lists the problems with the existing `ImportReportPanel` entries (062), and `host-persistence` sends nothing (its own dirty flag is cleared, and a `flush` is answered at once). The next valid `external-change` is applied and clears the state. For an invalid `init` file there is no deck to show: the notice alone is shown.
- **Rationale:** clarification Q1. `inert` guarantees no write path is missed (canvas, inspector, menus, keyboard shortcuts, paste) without touching every control, and is in all target browsers. The problem list reuses 062's plain-language entries.
- **Alternatives:** a model-level read-only editor flag that refuses writes: every UI control would still look enabled and throw; rejected. Disabling controls one by one: large surface, easy to miss one; rejected.

## R7. Pictures through the host (depends on 068)

- **Decision:** `hostPictureStore(bridge, capabilities)` (`src/embed/host-picture-store.ts`) implements the existing `PictureStore`:
  - It keeps an in-memory map (like `memoryPictureStore`) of bytes the editor has (from `init` / `external-change` embedded data via 066's `result.bytes`, from host answers, from new pictures).
  - With `capabilities.pictures`: `put(id, picture)` stores in memory, sends `picture-put { id, type, name, bytes }` and awaits `picture-stored { id, path }` → the editor writes `path` into the picture's entry with a new model op **`editor.setPicturePath(id, path | null)`** (untracked origin: saved and sent, never an undo step), so the next `change` carries facts + `path` and no data (068 format). `picture-store-failed { id, reason }` keeps the picture embedded and shows a toast with the reason (FR-015). `get(id)` with no bytes in memory sends `picture-get { id }` and awaits `picture { id, type, bytes }` or `picture-missing { id, reason }` (10 s timeout → missing, edge case).
  - Without `capabilities.pictures`: memory only; `serializeDeck` embeds bytes as in the web app's export (FR-016).
- **Rationale:** clarification Q3; the disk file then equals what the editor sent, so there is no rewrite loop. The document never holds bytes (055 R4) and, with 068, holds `path` in `meta.assets[id]`; `setPicturePath` is the only new model write.
- **Dependency:** `AssetMeta.path`, the path rules and `serializeDeck` writing `path` come from 068. Tasks put US4 after 068 is merged; the rest of 067 does not need it.
- **Alternatives:** see spec clarification (B, C); rejected there.

## R8. Host abilities instead of browser features

- **Decision:** `capabilities` in `init` is `{ openLinks: boolean; exportFiles: boolean; pictures: boolean }` (unknown keys ignored for forward compatibility). The embed provides an **`EmbedHostContext`** read by three hooks used by existing surfaces:
  - `useOpenLink()` (in `lib/links.ts` callers, `card-fields-block.tsx`, `links-field.tsx`): web → `window.open`; embed → `open-link { href }` when `openLinks`, else the link renders as text with a copy action and no open action (US5 scenario 1). Links never navigate the editor's frame (FR-018).
  - `useSaveFile()` (export dialog, deck menu "Download"): web → `downloadBlob`; embed → `export-file { name, mime, bytes }` when `exportFiles`, else the actions that need it are not rendered (FR-019). Copy-to-clipboard exports stay (they need no host).
  - `usePictureStore()` unchanged (R7).
- **Rationale:** mirrors `lib/features.ts` (Principle IV: feature-detect, hide what is missing). Three hooks cover every call site found (`window.open` in `lib/links.ts`; `target="_blank"` anchors in two components; `downloadBlob` / `downloadText` in the export dialog).

## R9. Theme from the host

- **Decision:** `init.theme` and `theme { scheme }` set the theme through a new `setThemeFromHost(scheme)` in `theme/theme-store.ts` (applies the `dark` class and updates the store, **without** `localStorage`); the embed never calls `initTheme`. Unknown schemes → light. The theme toggle in the editor chrome is hidden in the embed (the host owns it).
- **Rationale:** FR-007 and FR-020 (no browser storage). Tokens already switch on the `dark` class.

## R10. Routing inside the embed

- **Decision:** `createMemoryRouter` with the same deck route shape (`/deck/:deckId` with the `rules/:ruleId?` child) and one initial entry `/deck/host`; the loader is replaced by the embed's own state (no `deckLoader`). No other routes exist (FR-020).
- **Rationale:** `EditorChrome` and the rule editor rely on `useNavigate`, `useParams` and `useOutlet`; a memory router keeps them unchanged and never touches the host's address bar (a webview has none; Obsidian's must not change).
- **Alternatives:** hash router: writes to the frame's location; unnecessary.

## R11. Save state in the editor

- **Decision:** `SaveMode` gains `'host'`. In host mode the top bar shows no save indicator (clarification Q4). `host-persistence` tracks the last `seq` sent and the host's `change-result { seq, ok, reason? }`; an error state (toast-style banner with the host's reason, using the existing save error presentation) appears when the host refuses, or when no `change-result` for a sent `seq` arrives within **5 s**; it clears on the next `ok`. ⌘S in host mode calls `flush` (the host decides whether to save).
- **Rationale:** clarification Q4; reusing the save-status store keeps one error presentation.

## R12. Start-up and version handshake

- **Decision:** on load the editor sends `ready { protocolVersion: 1, editorVersion }` and waits for `init`. No `init` in **10 s** → a plain "The program hosting this editor did not send a deck" message (edge case). `init.protocolVersion` ≠ 1 → `fatal { code: 'protocol-version', editorVersion, protocolVersion: 1 }` is sent once and a message names the side to update: host newer → "This editor needs an update"; host older → "Update the extension or plug-in that opened this deck" (FR-003). A second `init` after the first is treated as `external-change` (edge case).
- **Rationale:** a single integer version, compared for equality, is the simplest rule that gives a clear message; minor additions (new optional fields, new capabilities) do not bump it because unknown keys are ignored.

## R13. Fake host and protocol tests

- **Decision:**
  - `packages/host-protocol/src/fake-host.ts`: `createFakeHost(transport, options)` — a scripted host (send `init`, `external-change`, `theme`, `flush`; answer `change` with ok/refused, pictures from a map) that records every message both ways. Used by component tests (with `memoryTransportPair`) and by the dev page.
  - `apps/app/src/routes/embed-host-page.tsx`: dev-only route `/embed-host` (same `import.meta.env.DEV` guard as `/design`), with an iframe of `/embed.html` (served by the dev server from `apps/app/embed.html`), sample picker / paste box, scheme and capability toggles, "simulate outside change" (applies a small random rename to the last file), "refuse next change", and the message log (FR-023, FR-024).
  - Component tests (`src/embed/*.test.tsx`) render `EmbedApp` with a memory transport and a fake host for every protocol flow in FR-025. No new e2e test (Principle VI).
- **Rationale:** one fake implementation shared by the dev page and tests keeps them from drifting (SC-007 is checked by writing the fake host against `contracts/host-protocol.md` only).

## R14. Network: none

- **Decision:** the embed entry imports no telemetry module and calls no `initTelemetry`; R2's bundle check covers the code; a component test stubs `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` and `navigator.sendBeacon` and runs load, edit, outside change, export and picture flows, asserting zero calls (SC-005). Fonts and Monaco are bundled already. Workers (layout, problems, images) load from the embed's own relative URLs; when the host forbids workers (`new Worker` throws), the existing in-process fallbacks (`supportsWorkers()`) are used — `supportsWorkers` is extended to catch a construction failure (edge case "background work").
- **Rationale:** Principle IV; no e2e test allowed for the iframe case, so the guarantee is code-level plus the fake-host manual check in quickstart.

## R15. Package placement and docs

- **Decision:** new package `packages/host-protocol` (`@sododeck/host-protocol`): TypeScript source, depends only on `zod` (already used by `@sododeck/schema`; no new dependency in the repo). Dependency direction: `app → host-protocol`; hosts (069, 070) → `host-protocol`. It does not import `@sododeck/model` (messages carry file **text**; validation of the deck is the editor's job). Docs: package `CLAUDE.md`, the AGENTS.md repo map and dependency line, `apps/app/CLAUDE.md` (embed entry, `DeckServicesContext`, host mode), `packages/model/CLAUDE.md` (`setPicturePath`), **ADR 0049** "Embeddable editor and host protocol" (iframe in every host, whole-file messages, origin pinning, embed build, file as store in hosts — the Principle IV note below).
- **ADR number:** 0047 is 066; 0048 is taken by 068 on its branch. If 065 merges first with an ADR, renumber at merge.
