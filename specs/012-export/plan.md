# Implementation Plan: Export

**Branch**: `012-export` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-export/spec.md`, clarified on 2026-09-28: JSON is
always the whole deck (scope disabled for JSON); only JSON, PNG and SVG ship (PDF and Mermaid are
deferred, backlog "Later").

**Dependencies**: 007 (flow mode), 010 (drill, collapse, levels), 011 (views) and 018 (tools
island, deck menu, ⌘K) are merged on `main` (`92258e7`). 017 (`node.size`, `edge.route`) and 020
(`node.style`) are **not** merged; the renderer has one seam for each (`TODO(017)`, `TODO(020)`).
I checked these names on `main`:

- **View / graph:** `viewStateOf`, `subtitleOf` (`views/view-state.ts`), `visibleGraph`,
  `scopeOf` (`visible-graph.ts`), `effectiveLevel` (`levels.ts`).
- **Geometry:** `nodeSize`, `groupBounds`, `NODE_SIZE`, `COLLAPSED_CARD_SIZE`, `GROUP_PADDING`,
  `displayPosition` (`canvas-geometry.ts`); `facingSides` (`deck-to-flow.ts`); `DOT_RADIUS`
  (local in `deck-edge.tsx`, to be exported); `FLOW_STROKES` (`flow-strokes.ts`);
  `getSmoothStepPath` (`@xyflow/react`).
- **Flows / stickies:** `analyzeFlow` (model), `flowOverlay` (`flows/flow-overlay.ts`),
  `stickyFlowState` (`stickies/sticky-flow.ts`), `stickyCanvasPosition` / `stickyLabel` (model),
  `STICKY_TINT`.
- **Store:** `useUiStore` (`currentViewId`, `revealed`, `drill`, `activeFlow`, `notesDisplay`,
  `announce`, `palette` / `openPalette` pattern, `resetForDeck`).
- **App:** `useExportDeck`, `readDeck` / `useDeckSnapshot`, `useSaveControls().markExported`,
  `downloadText` / `safeFileName` (`storage/download.ts`), `supportsClipboardWrite`,
  `buildCommands` / `CommandContext.exportDeck`, `generateBenchDeck`.
- **`packages/ui`:** `Dialog*`, `RadioGroup*`, `SegmentedControl*`, `Switch`, `Button`,
  `Tooltip*`, `useToast`, `KIND_STYLE` / `KIND_FALLBACK` / `ICON_STROKE_WIDTH`, `focusRing`.
- **Model / schema:** `serializeDeck`, `fromJSON` / `toJSON`, `parseSododeckFile`.

## Summary

The three Export entry points open an **Export deck** dialog with JSON, PNG and SVG.

- **JSON** (R9): the whole deck from `readDeck`; `serializeDeck` for pretty output, a re-stringify
  for compact output, and a pure `withoutKnowledge()` for "Include descriptions, links and rules"
  off. No model API change. Round-trip and schema-validity tests.
- **Images** (R1–R7): a pure `buildScene()` reuses the canvas's view, visible-graph, geometry and
  flow helpers to place cards, groups, collapsed cards, ports, edges (smooth-step paths, dots,
  label pills, step badges) and stickies for the scope (whole deck / current view / selected
  flow). A pure `renderSvg()` writes a standalone SVG with light tokens, lucide icon paths and
  embedded Geist fonts. PNG = that SVG drawn on a canvas at 1× / 2× / 3× within browser size
  limits.
- **Dialog** (R11): lazy-loaded, built only from existing `packages/ui` parts; state is local with
  a request key so stale previews are dropped; live updates from the deck snapshot; Copy and
  Download with toasts and announcements; backups (library, inspector, autosave error) unchanged.
- **Work placement** (R8): main thread with a < 50 ms budget for 500 / 1,000, checked by a perf
  test and a new bench scenario; the pure modules are worker-ready if the budget fails.
- **ADR 0016** (R13).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed, **no new dependency**.

- `@xyflow/react` 12: `getSmoothStepPath`, `Position` only (pure functions).
- `@fontsource-variable/geist`, `@fontsource-variable/geist-mono` (dependencies of `packages/ui`):
  woff2 files imported with Vite `?inline` in `@sododeck/ui/lib/embedded-fonts`, loaded only by the
  lazy export chunk.
- `lucide-react`: icon geometry copied into `icon-paths.ts`, guarded by a drift test (R7).
- `@sododeck/ui`: `Dialog*`, `RadioGroup*`, `SegmentedControl*`, `Switch`, `Button`, `Tooltip*`,
  `useToast`.
- `@sododeck/model` / `@sododeck/schema`: `serializeDeck`, `fromJSON`, `toJSON`, `analyzeFlow`,
  `stickyCanvasPosition`, `stickyLabel`, `parseSododeckFile` (tests).

**Storage**: no document or schema change. New UI-store field `exportDialog` (see
[data-model.md](data-model.md)). Library metadata `exportedAt` is set by JSON downloads, as today.

**Testing**:

- **Vitest, pure:** `export-file-name`, `json-export` (`withoutKnowledge`, compact, `formatBytes`,
  round-trip over sample + generated decks, `parseSododeckFile` validity), `scene` (each scope,
  views, drill, collapsed, flow filter + badges, stickies, bounds, empty), `edge-geometry`,
  `truncate`, `png-size`, `render-svg` (parses as XML, escaping, background vs transparent, fonts
  present, no external references), `icon-paths` drift test against lucide-react.
- **Vitest, store:** `openExport` / `closeExport` / `resetForDeck`.
- **Testing Library, by role and name** (per [contract](contracts/export-ui.md)):
  `export-dialog` (defaults inside / outside flow mode, JSON scope note, scope restore, options,
  footers, Copy / Download toasts, empty / preparing / error / retry, too-large scale, keyboard,
  focus return), `tools-island`, `deck-menu`, `command-palette` entry points.
- **Existing tests updated:** `tools-island.test.tsx` (Export opens the dialog),
  `routes/editor-page.test.tsx` (download + `exportedAt` via the dialog), command tests if the
  context key is renamed.
- **Perf:** `scene.perf.test.ts` (500 / 1,000, regression ceiling); `pnpm bench` before / after +
  new `export-preview` scenario.
- **E2E:** no new tests (constitution VI); smoke suite unchanged.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox and Safari. Clipboard write
feature-detected (`supportsClipboardWrite`). PNG limits sized for Safari's canvas area cap.

**Project Type**: web app (monorepo). Changes in `apps/app`, plus one module in `packages/ui` (`lib/embedded-fonts.ts`, because the
font packages are `packages/ui` dependencies) and docs. `packages/model` and `packages/schema` are
untouched.

**Performance Goals** (SC-003):

- Dialog opens < 300 ms (chunk prefetched on idle).
- `buildScene + renderSvg` < 50 ms at 500 / 1,000 in the bench browser (no long task); preview
  ready < 2 s; 2× PNG download < 5 s.
- No canvas regression: the canvas code only gains exported, cache-free helpers.

**Constraints**: no network; no document writes; no new dependency; images always light; export
never calls `toFlowNodes` / `toFlowEdges` (their caches serve React Flow).

**Scale/Scope**: about 16 new files in `editor/export/`, 1 in `lib/`, about 9 changed files,
1 ADR, 1 bench scenario.

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: passes, with one condition on V._

| Principle                        | Status         | How                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth        | ✅             | Export only reads `useDeckSnapshot` / `readDeck` and UI-store values; the scene, SVG and JSON are throwaway derived values. The only new state is the dialog's open flag (store) and its local choices; nothing duplicates document data.                                                                                                                               |
| II. Schema-owned format          | ✅             | No schema or model change. JSON is `serializeDeck` output (compact = same content re-stringified). `withoutKnowledge` output is validated with `parseSododeckFile`; round-trip tests for default options (FR-020).                                                                                                                                                      |
| III. Stable identity             | ✅             | The scene keys every shape by object id and never by title. File names come from names, but nothing references them.                                                                                                                                                                                                                                                    |
| IV. Local-first, private         | ✅             | Everything is generated in the page; fonts are inlined from bundled packages (no CDN, no fetch); the only request is the app's own lazy chunk. Clipboard writes only on an explicit Copy, feature-detected. The smoke "no third-party requests" test stays.                                                                                                             |
| V. Performance off main thread   | ✅ (condition) | Scene + SVG are linear string building, not layout / import / bulk validation, and need the page's loaded fonts for measurement (R8). Condition: < 50 ms at 500 / 1,000 in the bench; if it fails, the pure modules move to a worker (no redesign). PNG decode / encode are async; `drawImage` is the only synchronous step and cannot run in a worker for SVG sources. |
| VI. Strict types, tested         | ✅             | Pure modules unit-tested; dialog tested by role / name per the contract; no new e2e.                                                                                                                                                                                                                                                                                    |
| VII. Accessible                  | ✅             | Radio groups with arrow keys, labelled switches, disabled items with tooltips and descriptions, preview alt text, live "Preparing…", announced toasts, focus trap and return, reduced motion (dialog animation off). Nothing depends on colour alone.                                                                                                                   |
| VIII. Simplicity, justified deps | ✅             | No new dependency: SVG by hand, PNG via the platform canvas, fonts from existing packages, icons copied with a drift test. No new `packages/ui` component (one font module only). ADR 0016 records the rendering decision.                                                                                                                                              |

## Project Structure

### Documentation (this feature)

```text
specs/012-export/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R13
├── data-model.md        # Phase 1: store field, dialog state, scene, limits
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── export-ui.md     # user-visible contract (roles, names, texts, outputs)
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
apps/app/src/
├── editor/export/                          # NEW
│   ├── export-dialog.tsx (+test)           # lazy default export for React.lazy; format list, scope, options, preview, footer
│   ├── export-dialog-state.ts (+test)      # reducer, defaults (FR-004), request key, transitions
│   ├── use-export-result.ts                # debounced generation for the current key; drops stale results
│   ├── export-file-name.ts (+test)         # exportFileName, formatBytes (R10)
│   ├── json-export.ts (+test)              # jsonExport(file, options), withoutKnowledge (R9)
│   ├── scene.ts (+test, +perf test)        # buildScene(input): ExportScene (R1, R2)
│   ├── edge-geometry.ts (+test)            # handle points, edgePath() seam for 017, bounds of a path
│   ├── render-svg.ts (+test)               # renderSvg(scene, options) → string; escaping
│   ├── export-palette.ts                   # light token values used by the renderer
│   ├── export-fonts.ts                     # ensureFontsLoaded()
│   ├── icon-paths.ts (+drift test)         # lucide geometry for kinds, Shapes, Table, Layers, StickyNote
│   ├── text-measure.ts (+test)             # canvas measurer with cache; fixed-width fallback; truncate()
│   ├── png-size.ts (+test)                 # pngSize, largestScale, limits
│   └── rasterize.ts                        # SVG → PNG Blob (browser only; mocked in tests)
├── lib/clipboard.ts (+test)                # copyText (or reuse 019's if merged)
├── storage/download.ts (+test)             # + downloadBlob; downloadText wraps it
├── state/ui-store.ts (+test)               # + exportDialog, openExport, closeExport; resetForDeck
├── editor/shell/shell-chrome.tsx           # mounts the lazy ExportDialog; idle prefetch of the chunk
├── editor/shell/tools-island.tsx (+test)   # Export → openExport
├── editor/shell/deck-menu.tsx (+test)      # "Export…" → openExport
├── editor/command-palette/*.ts(x) (+tests) # CommandContext: openExport; title unchanged
├── editor/deck-to-flow.ts                  # export cache-free portNodes (renamed exportable helper)
├── editor/deck-edge.tsx                    # export DOT_RADIUS
├── routes/editor-page.test.tsx             # export via dialog
└── bench/ + apps/app/bench/perf.bench.ts   # + export-preview scenario
packages/ui/src/lib/embedded-fonts.ts       # NEW ?inline Geist woff2 → @font-face CSS (fonts are ui deps)
docs/decisions/0016-export-rendering.md     # NEW ADR
apps/app/CLAUDE.md                          # export module, entry points, backup paths unchanged
.agents/skills/react-flow/SKILL.md          # note: export helpers reuse canvas geometry (per apps/app/CLAUDE.md rule)
docs/backlog.md                             # 012 status on merge
```

**Structure Decision**: one new folder `apps/app/src/editor/export/` holds the dialog and the pure
export pipeline; it depends on editor helpers (views, graph, geometry, flows, stickies) and never
the reverse. `packages/ui` gains only `lib/embedded-fonts.ts`; dependency direction is unchanged. The dialog and its
fonts load lazily, keeping the editor bundle the same size.

## Spec alignment made during planning

Four spec statements were made precise from research (applied to `spec.md`):

- **FR-008 / US3 "Whole deck"**: the top level of the deck with every group expanded and no view
  filter; components nested inside another component appear as their parent card (with its
  child-count), as on the canvas (R2).
- **FR-028**: SVG text stays editable text; embedded fonts render in browsers; tools that ignore
  embedded fonts substitute a similar font (R4).
- **SC-003**: "canvas stays at 60 fps while an export is prepared" → "no main-thread task longer
  than 50 ms while a preview is prepared, except the final PNG draw" (the dialog is modal; R8).
- **Assumption "full detail level"** → cards are drawn as at 100 % zoom (kind icon, title,
  subtitle); labels are always drawn; stickies in their one-line form (R2).

## Complexity Tracking

No constitution violation. Principle V is met under the measured condition in the Constitution
Check; the fallback (worker) is designed in R8.
