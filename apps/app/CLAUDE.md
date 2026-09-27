# @sododeck/app — the editor (app.sododeck.com)

Vite + React SPA. No backend, no login: everything runs and is stored in the browser.

## Map

| Path                                                                                                           | What                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/router.tsx`                                                                                           | Routes: `/` library, `/deck/:deckId` editor (lazy; `new` = empty deck, else the demo until 005), `/bench` benchmark (lazy, unlinked), `/design` gallery (dev only) |
| `src/routes/`                                                                                                  | Page components                                                                                                                                                    |
| `src/editor/`                                                                                                  | Editor shell: top bar, left panel (outline tree, palette), canvas (React Flow), inspector, JSON panel (Monaco)                                                     |
| `src/editor/canvas.tsx`, `deck-node.tsx`, `deck-edge.tsx`, `group-boundary-node.tsx`                           | Controlled canvas and its node/edge views (ADR 0006)                                                                                                               |
| `src/editor/deck-to-flow.ts`, `canvas-geometry.ts`, `connection-rules.ts`, `outline.ts`, `describe-removal.ts` | Pure view models (unit-tested)                                                                                                                                     |
| `src/editor/use-canvas-handlers.ts`, `canvas-actions.ts`                                                       | React Flow events → editor writes and UI state; shared add/connect/focus actions                                                                                   |
| `src/editor/use-canvas-shortcuts.ts`                                                                           | The keyboard map: canvas keys and document-wide undo/redo/Delete/Esc                                                                                               |
| `src/editor/edge-popover.tsx`, `connect-popover.tsx`, `confirm-delete-dialog.tsx`, `announcer.tsx`             | Connection popover, keyboard connect, delete confirmation + Undo toast, live region                                                                                |
| `src/editor/json-panel.tsx`, `json-panel-header.tsx`, `json-viewer.tsx`, `json-resize-handle.tsx`              | Read-only JSON panel (004): Deck and Selection tabs, Copy, collapse/resize; Monaco wrapper (lazy)                                                                  |
| `src/editor/json-panel-view.ts`, `line-diff.ts`, `panel-height.ts`, `cooldown.ts`, `monaco-theme.ts`           | Pure view models of the JSON panel (unit-tested)                                                                                                                   |
| `src/model/use-deck-snapshot.ts`                                                                               | The ONLY way views read the Yjs document (incremental snapshot from `@sododeck/model`; `readDeck` for handlers)                                                    |
| `src/model/editor-context.tsx`, `use-editor.ts`                                                                | `EditorProvider` (one `DeckEditor` per open deck), `useEditor()`, `useHistory()` — the only way views write                                                        |
| `src/state/ui-store.ts`                                                                                        | Zustand, UI-only state (selection, focus, popovers, pending delete, Labels, announcements, panels)                                                                 |
| `src/theme/`                                                                                                   | Light/dark theme (UI preference, localStorage)                                                                                                                     |
| `src/storage/`                                                                                                 | Dexie library metadata DB (M1)                                                                                                                                     |
| `src/layout/`                                                                                                  | ELK auto-layout, runs in a Web Worker (M4)                                                                                                                         |
| `src/lib/features.ts`                                                                                          | Feature detection for browser-only APIs                                                                                                                            |
| `src/routes/design-gallery-page.tsx`, `src/design-gallery/`                                                    | Dev-only review gallery of every `@sododeck/ui` block (excluded from production builds)                                                                            |
| `src/lib/env.ts`, `src/telemetry/`                                                                             | Sentry / PostHog, off by default, lazy chunks                                                                                                                      |
| `src/bench/`, `bench/`                                                                                         | 500-node benchmark generator and Playwright perf test                                                                                                              |
| `tests/e2e/`                                                                                                   | Playwright smoke tests (run against `vite preview`)                                                                                                                |
| `public/_redirects`, `public/_headers`, `wrangler.toml`                                                        | Cloudflare Pages                                                                                                                                                   |

## Rules (in addition to the root CLAUDE.md)

- Document data lives only in the Yjs doc. Components read a `SododeckFile` snapshot from `useDeckSnapshot(doc)` and write only through `useEditor()` (the `DeckEditor`). Never copy document data into Zustand, React state or React Flow state.
- The canvas is controlled and derived (ADR 0006): `nodes`/`edges` come from the snapshot every render; React Flow never owns document state. Drags write positions to the document inside an editor gesture (one undo step).
- Canvas recipes (new node/edge types, visual modes, zoom levels, viewport) are in the project skill `.agents/skills/react-flow/SKILL.md`. Update it when a file, helper or pattern it names changes.
- No React Flow built-in delete or keyboard handling (`deleteKeyCode={null}`, `disableKeyboardA11y`, nodes/edges not focusable). Keys live in `src/editor/use-canvas-shortcuts.ts`; deletes go through the confirmation dialog, whose counts come from `previewRemoval`.
- Zustand is for UI state only. If it would be saved in the `.sododeck.json` file, it doesn't belong in Zustand.
- The JSON panel (004) only reads: `useDeckSnapshot` → text from `@sododeck/model` (`serializeDeck` for Deck, `serializeEntry`/`serializeEntries` for Selection) → Monaco. Never `JSON.stringify` deck data in the app. Its only writes are `editor.undo()`/`redo()` (⌘Z / ⇧⌘Z / Ctrl+Y inside the viewer). Deck text is throttled to 250 ms and computed only while its tab is visible (`use-throttled-deck-text.ts`).
- JSON viewer (`json-viewer.tsx`): one Monaco model per tab (`DECK_MODEL_PATH`, `SELECTION_MODEL_PATH`; the latter must not match the schema's `*.sododeck.json`). `defaultValue` only seeds a new model; later text goes in as one minimal `applyEdits` from `lineDiff`, never `value`/`setValue` (they reset folds and scroll). `readOnly` + `readOnlyMessage`, no `domReadOnly` (it blocks the read-only hint and event). Themes `sododeck-light`/`-dark` are built from CSS tokens (`monaco-theme.ts`, contrast-tested) and rebuilt when the app theme changes.
- JSON panel preferences `{ open, height, tab }` live in the UI store (`jsonPanel`) and in `localStorage["sododeck.jsonPanel"]` (`state/json-panel-prefs.ts`). The app never switches the tab by itself.
- Monaco is bundled locally via deep imports in `src/editor/monaco-setup.ts`. Never use the CDN loader. Re-check the deep import paths when upgrading `monaco-editor`.
- Heavy modules (React Flow canvas, Monaco, telemetry SDKs) are code-split. Keep the library route light.
- Telemetry must never include diagram content: no autocapture, no session replay, no UI/console breadcrumbs, no document data in error messages or event properties.
- The e2e test `makes no third-party network requests` guards rule 5. Don't weaken it; if telemetry is enabled in a test, assert its requests carry no content.
- Anything browser-specific goes through `src/lib/features.ts`.
- The `/design` gallery is registered only when `import.meta.env.DEV`; keep its code and CSS inside `src/design-gallery/` so production builds never include it (check: `grep -r design-gallery dist` finds nothing).

## Commands

`pnpm dev` (5173) · `pnpm build` · `pnpm preview` (4173) · `pnpm test` · `pnpm e2e` · `pnpm bench` (`BENCH_CPU_THROTTLE=4`, `BENCH_NODES`, `BENCH_EDGES`)

## Env

See `.env.example`. All `VITE_*` values are baked into the public bundle at build time, so never put secrets there. Telemetry turns on only when the flag is exactly `true` and a key is set.
