# @sododeck/app — the editor (app.sododeck.com)

Vite + React SPA. No backend, no login: everything runs and is stored in the browser.

## Map

| Path                                                        | What                                                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/app/router.tsx`                                        | Routes: `/` library, `/deck/:deckId` editor (lazy), `/bench` benchmark (lazy, unlinked), `/design` gallery (dev only) |
| `src/routes/`                                               | Page components                                                                                                       |
| `src/editor/`                                               | Editor shell: top bar, outline, canvas (React Flow), inspector, JSON panel (Monaco)                                   |
| `src/model/use-deck-snapshot.ts`                            | The ONLY way views read the Yjs document                                                                              |
| `src/state/ui-store.ts`                                     | Zustand, UI-only state (selection, panels, modes)                                                                     |
| `src/theme/`                                                | Light/dark theme (UI preference, localStorage)                                                                        |
| `src/storage/`                                              | Dexie library metadata DB (M1)                                                                                        |
| `src/layout/`                                               | ELK auto-layout, runs in a Web Worker (M4)                                                                            |
| `src/lib/features.ts`                                       | Feature detection for browser-only APIs                                                                               |
| `src/routes/design-gallery-page.tsx`, `src/design-gallery/` | Dev-only review gallery of every `@sododeck/ui` block (excluded from production builds)                               |
| `src/lib/env.ts`, `src/telemetry/`                          | Sentry / PostHog, off by default, lazy chunks                                                                         |
| `src/bench/`, `bench/`                                      | 500-node benchmark generator and Playwright perf test                                                                 |
| `tests/e2e/`                                                | Playwright smoke tests (run against `vite preview`)                                                                   |
| `public/_redirects`, `public/_headers`, `wrangler.toml`     | Cloudflare Pages                                                                                                      |

## Rules (in addition to the root CLAUDE.md)

- Document data lives only in the Yjs doc. Components get a `SododeckFile` snapshot from `useDeckSnapshot(doc)` and (from M1) write through `@sododeck/model` functions. Never copy document data into Zustand, React state or React Flow state.
- Zustand is for UI state only. If it would be saved in the `.sododeck.json` file, it doesn't belong in Zustand.
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
